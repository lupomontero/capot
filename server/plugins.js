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
    var pluginsPaths = [];

    if (!pluginsPaths.length) { return cb(); }

    async.each(pluginsPaths, function (pluginPath, cb) {
      capot.log.info('Initialising plugin ' + pluginPath);
      requireExtension(pluginPath, function (err) {
        if (err) {
          capot.log.warn('Extension not loaded');
        } else {
          capot.log.info('Loaded!');
        }
        cb();
      });
    }, cb);
  }

  async.series([ loadUserland, loadPlugins ], cb);

};

