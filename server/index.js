var path = require('path');
var async = require('async');


module.exports = function (argv) {

  var config = require('./config')(argv);
  var pkg = require(path.join(config.cwd, 'package.json'));
  var log = require('./log')({ name: pkg.name });

  var bonnet = {
    pkg: pkg,
    config: config,
    log: log
  };

  async.applyEachSeries([
    require('./installer'),
    require('./changes'),
    require('./task'),
    require('./account'),
    require('./www'),
    require('./plugins')
  ], bonnet, function (err) {
    if (err) {
      log.error(err);
      process.exit(1);
    }
    bonnet.changes.start();
    log.info('Bonnet back-end has started ;-)');
  });

};

