//
// Server
//


var Path = require('path');
var Hapi = require('hapi');
var Async = require('async');
var _ = require('lodash');
var Installer = require('./lib/installer');
var Routes = require('./routes');


var internals = {};


internals.createConfig = function (argv) {

  var env = process.env;

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
  }, _.omit(argv, [ '_' ]));
};


internals.requireExtension = function (server, path, cb) {

  var ext;
  try { ext = require(path); } catch (ex) { return cb(ex); }

  if (typeof ext !== 'function') {
    return setTimeout(cb.bind(null, new Error('Could not load ' + path)), 10);
  }

  ext(server, cb);
};


internals.loadUserland = function (server, cb) {

  var config = server.settings.app.config;

  internals.requireExtension(server, config.cwd, function (err) {

    if (err) {
      if (err.code !== 'MODULE_NOT_FOUND') {
        server.log('warn', err);
      }
      server.log('warn', 'Did not extend Capot Server with userland');
    } else {
      server.log('info', 'Extended Capot Server with userland');
    }

    cb();
  });
};


internals.loadPlugins = function (server, cb) {

  var config = server.settings.app.config;
  // read plugins from package.json and add those to pluginsPaths...
  var plugins = (server.settings.app.pkg.capot || {}).plugins || [];

  if (!plugins.length) { return cb(); }

  Async.each(plugins, function (plugin, cb) {

    server.log('info', 'Initialising plugin ' + plugin);
    var abs = (plugin.charAt(0) === '.') ? Path.join(config.cwd, plugin) : plugin;
    internals.requireExtension(server, abs, function (err) {

      if (err) {
        server.log('warn', err);
        server.log('warn', 'Plugin ' + plugin + ' not loaded');
      } else {
        server.log('info', 'Plugin ' + plugin + ' loaded!');
      }
      cb();
    });
  }, cb);
};


internals.createServer = function (config) {

  var Pkg = require(Path.join(config.cwd, 'package.json'));
  var server = new Hapi.Server({
    debug: {
      log: [ 'info', 'warn', 'error' ],
      request: [ 'error' ]
    },
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
  require('./auth'),
  require('./www'),
  require('./account'),
  require('./oauth')
];


module.exports = function (argv) {

  var config = internals.createConfig(argv);
  var plugins = internals.plugins.slice(0);

  if (config.debug) {
    require('longjohn');
    plugins = [ require('vision'), require('lout') ].concat(plugins);
  }

  var server = internals.createServer(config);

  function onError(err) {

    server.log('error', err);
    process.exit(1);
  }

  // TODO: We should use cluser module to spin one instance per cpu and then
  // manage killing and spinning children properly. 
  process.on('uncaughtException', onError);

  Async.series([
    Async.apply(Installer, server),
    server.register.bind(server, plugins),
    function (cb) { server.route(Routes); cb(); },
    Async.apply(internals.loadPlugins, server),
    Async.apply(internals.loadUserland, server),
    server.start.bind(server)
  ], function (err) {
  
    if (err) { return onError(err); }
    server.log('info', 'Web server started on port ' + config.port);
    server.log('info', 'Capot back-end has started ;-)');
  });

};

