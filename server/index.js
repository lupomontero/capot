//
// Server
//


var Path = require('path');
var Hapi = require('hapi');
var Bunyan = require('bunyan');
var Async = require('async');
var _ = require('lodash');
var Installer = require('./lib/installer');
var Routes = require('./routes');


var internals = {};


internals.createConfig = function (argv) {

  var env = process.env;

  return _.extend({}, {
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
  var log = server.app.log.child({ scope: 'userland' });

  internals.requireExtension(server, config.cwd, function (err) {

    if (err) {
      if (err.code !== 'MODULE_NOT_FOUND') {
        log.warn(err);
      }
      log.warn('Did not extend Capot Server with userland');
    } else {
      log.info('Extended Capot Server with userland');
    }

    cb();
  });
};


internals.loadPlugins = function (server, cb) {

  var log = server.app.log.child({ scope: 'plugins' });
  var config = server.settings.app.config;
  // read plugins from package.json and add those to pluginsPaths...
  var plugins = (server.settings.app.pkg.capot || {}).plugins || [];

  if (!plugins.length) { return cb(); }

  Async.each(plugins, function (plugin, cb) {

    log.info('Initialising plugin ' + plugin);
    var abs = (plugin.charAt(0) === '.') ? Path.join(config.cwd, plugin) : plugin;
    internals.requireExtension(server, abs, function (err) {

      if (err) {
        log.warn(err);
        log.warn('Plugin ' + plugin + ' not loaded');
      } else {
        log.info('Plugin ' + plugin + ' loaded!');
      }
      cb();
    });
  }, cb);
};


module.exports = function (argv) {

  if (argv.debug) {
    require('longjohn');
  }

  var config = internals.createConfig(argv);
  var Pkg = require(Path.join(config.cwd, 'package.json'));
  var server = new Hapi.Server({
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

  var log = server.app.log = Bunyan.createLogger({
    name: Pkg.name,
    level: 'debug'
  });

  function onError(err) {

    log.error(err);
    process.exit(1);
  }

  // TODO: We should use cluser module to spin one instance per cpu and then
  // manage killing and spinning children properly. 
  process.on('uncaughtException', onError);

  Installer(server, function (err) {

    if (err) { return onError(err); }

    server.register([
      require('vision'),
      require('lout'),
      require('h2o2'),
      require('inert'),
      require('./mailer'),
      require('./auth'),
      require('./www'),
      //require('./changes'),
      //require('./task'),
      //require('./account')
    ], function (err) {

      if (err) { return onError(err); }

      server.route(Routes);

      Async.applyEachSeries([
        internals.loadPlugins,
        internals.loadUserland
      ], server, function (err) {

        if (err) { return onError(err); }

        //server.app.changes.start();

        log.info('Starting server...');
        server.start(function () {

          log.info('Web server started on port ' + config.port);
          log.info('Capot back-end has started ;-)');
        });
      });
    });
  });

};

