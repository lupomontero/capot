var fs = require('fs');
var path = require('path');
var async = require('async');


module.exports = function (capot, cb) {

  var config = capot.config;

  function requireExtension(path, cb) {
    var ext;
    try { ext = require(path); } catch (ex) {}
    if (typeof ext !== 'function') {
      return setTimeout(cb.bind(null, new Error('Could not load ' + path)), 10);
    }
    ext(capot, cb);
  }

  function loadUserland(cb) {
    requireExtension(config.cwd, function (err) {
      if (!err) {
        capot.log.info('Extended Capot Server with userland');
      }
      cb();
    });
  }

  function loadPlugins(cb) {
    // read plugins from package.json and add those to pluginsPaths...
    var plugins = (capot.pkg.capot || {}).plugins || [];

    if (!plugins.length) { return cb(); }

    async.each(plugins, function (plugin, cb) {
      capot.log.info('Initialising plugin ' + plugin);
      if (plugin.charAt(0) === '.') {
        plugin = path.join(config.cwd, plugin);
      }
      requireExtension(plugin, function (err) {
        if (err) {
          capot.log.warn('Plugin not loaded');
        } else {
          capot.log.info('Loaded!');
        }
        cb();
      });
    }, cb);
  }

  async.series([ loadUserland, loadPlugins ], cb);

};

