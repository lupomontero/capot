var path = require('path');
var async = require('async');


module.exports = function (argv) {

  var config = require('./config')(argv);
  var pkg = require(path.join(config.cwd, 'package.json'));
  var log = require('./log')({ name: pkg.name });

  // TODO: We should use cluser module to spin one instance per cpu and then
  // manage killing and spinning children properly. 
  process.on('uncaughtException', function (err) {
    log.error(err);
    process.exit(1);
  });

  var capot = {
    pkg: pkg,
    config: config,
    log: log
  };

  async.applyEachSeries([
    require('./installer'),
    require('./changes'),
    require('./mailer'),
    require('./www'),
    require('./task'),
    require('./account'),
    require('./plugins')
  ], capot, function (err) {
    if (err) {
      log.error(err);
      process.exit(1);
    }
    capot.changes.start();
    log.info('Capot back-end has started ;-)');
  });

};



