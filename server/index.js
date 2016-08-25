//
// Server
//


'use strict';


const Path = require('path');
const Hapi = require('hapi');
const Async = require('async');
const Good = require('good');
const Installer = require('./lib/installer');
const Settings = require('./lib/settings');
const Couch = require('./lib/couch');
const Routes = require('./routes');


const internals = {};


internals.hapiPlugins = [
  require('h2o2'),
  require('inert'),
  require('./mailer'),
  require('./session'),
  require('./www'),
  require('./account'),
  require('./oauth'),
  require('./changes')
];


internals.createLogger = function (server, cb) {

  const settings = server.settings.app;

  if (!settings.debug) {
    return cb();
  }

  const options = {
    ops: {
      interval: 10 * 1000
    },
    reporters: {
      console: [{
        module: 'good-console'
      }, 'stdout']
    }
  };

  server.register({
    register: Good,
    options: options
  }, cb);
};


internals.requireExtension = function (server, path, cb) {

  let ext;
  try {
    ext = require(path);
  }
  catch (ex) {
    return cb(ex);
  }

  if (!ext || typeof ext.register !== 'function') {
    return setTimeout(cb.bind(null, new Error('Could not load ' + path)), 10);
  }

  server.register(ext, cb);
};


internals.loadCapotPlugins = function (server, cb) {

  const settings = server.settings.app;
  // read capot plugins from package.json and add those to pluginsPaths...
  const capotPlugins = (server.settings.app.pkg.capot || {}).plugins || [];

  if (!capotPlugins.length) {
    return cb();
  }

  Async.each(capotPlugins, (plugin, eachCb) => {

    server.log('info', 'Initialising plugin ' + plugin);
    let abs = '';

    if (plugin.charAt(0) === '.') {
      abs = Path.join(settings.cwd, plugin);
    }
    else {
      abs = Path.join(settings.cwd, 'node_modules', plugin);
    }

    internals.requireExtension(server, abs, (err) => {

      if (err) {
        server.log('warn', err.message);
        server.log('warn', 'Plugin ' + plugin + ' not loaded');
      }
      else {
        server.log('info', 'Plugin ' + plugin + ' loaded!');
      }
      eachCb();
    });
  }, cb);
};


internals.createServer = function (settings) {

  const server = new Hapi.Server({
    //debug: {
    //  log: [ 'info', 'warn', 'error' ],
    //  request: [ 'error' ]
    //},
    connections: {
      routes: {
        payload: {
          maxBytes: 1048576 * 5 // 5Mb
        },
        files: {
          relativeTo: Path.join(settings.cwd, settings.www)
        }
      }
    },
    // application-specific configuration which can later be accessed via
    // server.settings.app. Note the difference between server.settings.app
    // which is used to store static configuration values and server.app which
    // is meant for storing run-time state
    app: settings
  });

  server.connection({ port: settings.port });

  return server;
};


module.exports = function (options, done) {

  const settings = Settings(options);
  let hapiPlugins = internals.hapiPlugins.slice(0);

  if (settings.debug) {
    require('longjohn');
    hapiPlugins = [require('vision'), require('lout')].concat(hapiPlugins);
  }

  const server = internals.createServer(settings);

  Async.series([
    Async.apply(internals.createLogger, server),
    Async.apply(Installer, server),
    server.register.bind(server, hapiPlugins),
    function (cb) {

      server.app.couch = Couch(server.settings.app.couchdb);
      server.route(Routes); cb();
    },
    Async.apply(internals.loadCapotPlugins, server)
  ], (err) => {

    if (err) {
      return done(err);
    }

    done(null, server);
  });

  return server;
};


//
// If script is run directly (not loaded as module) we invoke the module.
//
if (require.main === module) {
  const onError = function (err) {

    console.error(err);
    process.exit(1);
  };

  // TODO: We should use cluser module to spin one instance per cpu and then
  // manage killing and spinning children properly.
  process.on('uncaughtException', onError);

  module.exports({}, (err, server) => {

    if (err) {
      return onError(err);
    }

    server.start((err) => {

      if (err) {
        return onError(err);
      }

      server.app.changes.start();

      server.log(['info'], 'Web server started on port ' + server.info.port);
      server.log(['info'], 'Capot back-end has started ;-)');
    });
  });
}
