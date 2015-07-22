var fs = require('fs');
var path = require('path');
var async = require('async');


module.exports = function (capot, cb) {

  var config = capot.config;
  var log = capot.log.child({ scope: 'plugins' });

  function requireExtension(path, cb) {
    var ext;
    try { ext = require(path); } catch (ex) { log.warn(ex.message); }
    if (typeof ext !== 'function') {
      return setTimeout(cb.bind(null, new Error('Could not load ' + path)), 10);
    }
    ext(capot, cb);
  }

  function loadUserland(cb) {
    requireExtension(config.cwd, function (err) {
      if (err) {
        log.warn('Did not extend Capot Server with userland');
      }
      if (!err) {
        log.info('Extended Capot Server with userland');
      }
      cb();
    });
  }

  function loadPlugins(cb) {
    // read plugins from package.json and add those to pluginsPaths...
    var plugins = (capot.pkg.capot || {}).plugins || [];

    if (!plugins.length) { return cb(); }

    async.each(plugins, function (plugin, cb) {
      log.info('Initialising plugin ' + plugin);
      var abs = (plugin.charAt(0) === '.') ? path.join(config.cwd, plugin) : plugin;
      requireExtension(abs, function (err) {
        if (err) {
          log.warn('Plugin ' + plugin + ' not loaded');
        } else {
          log.info('Plugin ' + plugin + ' loaded!');
        }
        cb();
      });
    }, cb);
  }

  async.series([ loadPlugins, loadUserland ], cb);

};

