//
// Server
//


'use strict';


const Path = require('path');
const Hapi = require('hapi');
const Async = require('async');
const _ = require('lodash');
const Good = require('good');
const GoodConsole = require('good-console');
const Installer = require('./lib/installer');
const Routes = require('./routes');


const internals = {};


internals.createLogger = function (server, cb) {

  server.register({
    register: Good,
    options: {
      reporters: [{
        reporter: GoodConsole,
        events: {
          response: '*',
          log: '*'
        }
      }]
    }
  }, cb);
};


internals.createConfig = function (argv) {

  const env = process.env;

  return _.extend({}, {
    debug: argv.debug === true,
    port: 3001,
    cwd: process.cwd(),
    data: Path.join(process.cwd(), 'data'),
    couchdb: {
      url: env.COUCHDB_URL,
      user: env.COUCHDB_USER || 'admin',
      pass: env.COUCHDB_PASS
    }
  }, _.omit(argv, ['_']));
};


internals.requireExtension = function (server, path, cb) {

  let ext;
  try {
    ext = require(path);
  }
  catch (ex) {
    return cb(ex);
  }

  if (typeof ext !== 'function') {
    return setTimeout(cb.bind(null, new Error('Could not load ' + path)), 10);
  }

  ext(server, cb);
};


internals.loadUserland = function (server, cb) {

  const config = server.settings.app.config;

  internals.requireExtension(server, config.cwd, (err) => {

    if (err) {
      if (err.code !== 'MODULE_NOT_FOUND') {
        server.log('warn', err);
      }
      server.log('warn', 'Did not extend Capot Server with userland');
    }
    else {
      server.log('info', 'Extended Capot Server with userland');
    }

    cb();
  });
};


internals.loadPlugins = function (server, cb) {

  const config = server.settings.app.config;
  // read plugins from package.json and add those to pluginsPaths...
  const plugins = (server.settings.app.pkg.capot || {}).plugins || [];

  if (!plugins.length) {
    return cb();
  }

  Async.each(plugins, (plugin, cb) => {

    server.log('info', 'Initialising plugin ' + plugin);
    const abs = (plugin.charAt(0) === '.') ? Path.join(config.cwd, plugin) : plugin;
    internals.requireExtension(server, abs, (err) => {

      if (err) {
        server.log('warn', err);
        server.log('warn', 'Plugin ' + plugin + ' not loaded');
      }
      else {
        server.log('info', 'Plugin ' + plugin + ' loaded!');
      }
      cb();
    });
  }, cb);
};


internals.createServer = function (config) {

  const Pkg = require(Path.join(config.cwd, 'package.json'));
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
          relativeTo: Path.join(config.cwd, config.www || 'www')
        }
      }
    },
    // application-specific configuration which can later be accessed via
    // server.settings.app. Note the difference between server.settings.app
    // which is used to store static configuration values and server.app which
    // is meant for storing run-time state
    app: {
      config: config,
      pkg: Pkg
    }
  });

  server.connection({ port: config.port });

  return server;
};


internals.plugins = [
  require('h2o2'),
  require('inert'),
  require('./mailer'),
  require('./session'),
  require('./www'),
  require('./account'),
  require('./oauth'),
  require('./changes')
];


module.exports = function (argv) {

  const config = internals.createConfig(argv);
  let plugins = internals.plugins.slice(0);

  if (config.debug) {
    require('longjohn');
    plugins = [require('vision'), require('lout')].concat(plugins);
  }

  const server = internals.createServer(config);

  const onError = function (err) {

    server.log('error', err);
    process.exit(1);
  };

  // TODO: We should use cluser module to spin one instance per cpu and then
  // manage killing and spinning children properly.
  process.on('uncaughtException', onError);

  Async.series([
    Async.apply(internals.createLogger, server),
    Async.apply(Installer, server),
    server.register.bind(server, plugins),
    function (cb) {

      server.route(Routes); cb();
    },
    Async.apply(internals.loadPlugins, server),
    Async.apply(internals.loadUserland, server),
    server.start.bind(server)
  ], (err) => {

    if (err) {
      return onError(err);
    }

    server.app.changes.start();
    server.log(['info'], 'Web server started on port ' + config.port);
    server.log(['info'], 'Capot back-end has started ;-)');
  });

};

