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
const Routes = require('./lib/routes');


const internals = {};


internals.hapiPlugins = [
  require('h2o2'),
  require('inert'),
  require('nes'),
  require('./lib/mailer'),
  require('./lib/session'),
  require('./lib/www'),
  require('./lib/account'),
  require('./lib/oauth'),
  require('./lib/changes')
];


internals.createLogger = function (server, cb) {

  const options = {};

  if (server.settings.app.quiet !== true) {

    options.ops = { interval: 60 * 1000 };
    options.reporters = {
      console: [
        {
          module: 'good-squeeze',
          name: 'Squeeze',
          args: [{ ops: '*', response: '*', log: '*', error: '*' }]
        },
        {
          module: 'good-console'
        },
        'stdout'
      ]
    };
  }


  if (server.settings.app.debug) {
    options.reporters.console[0].args[0].request = '*';
  }

  server.register({ register: Good, options }, cb);
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
  const server = internals.createServer(settings);

  Async.series([
    Async.apply(internals.createLogger, server),
    Async.apply(Installer, server),
    server.register.bind(server, internals.hapiPlugins),
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
