var fs = require('fs');
var path = require('path');
var async = require('async');


module.exports = function (bonnet, cb) {

  var config = bonnet.config;

  function requireExtension(path, cb) {
    var ext;
    try { ext = require(path); } catch (ex) {}
    if (typeof ext !== 'function') {
      return setTimeout(cb.bind(null, new Error('Could not load ' + path)), 10);
    }
    ext(bonnet, cb);
  }

  function loadUserland(cb) {
    requireExtension(config.cwd, function (err) {
      if (!err) {
        bonnet.log.info('Extended Bonnet Server with userland');
      }
      cb();
    });
  }

  function loadPlugins(cb) {
    // read plugins from package.json and add those to pluginsPaths...
    var pluginsPaths = [];

    if (!pluginsPaths.length) { return cb(); }

    async.each(pluginsPaths, function (pluginPath, cb) {
      bonnet.log.info('Initialising plugin ' + pluginPath);
      requireExtension(pluginPath, function (err) {
        if (err) {
          bonnet.log.warn('Extension not loaded');
        } else {
          bonnet.log.info('Loaded!');
        }
        cb();
      });
    }, cb);
  }

  async.series([ loadUserland, loadPlugins ], cb);

};

