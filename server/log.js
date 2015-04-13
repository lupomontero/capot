var bunyan = require('bunyan');


module.exports = function (options) {

  return bunyan.createLogger({ name: options.name, level: 'debug' });

};

