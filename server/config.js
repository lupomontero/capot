var path = require('path');
var _ = require('lodash');
var env = process.env;


module.exports = function (argv) {

  return _.extend({}, {
    port: 3001,
    cwd: process.cwd(),
    data: path.join(process.cwd(), 'data'),
    couchdb: {
      url: env.COUCHDB_URL,
      user: env.COUCHDB_USER || 'admin',
      pass: env.COUCHDB_PASS
    }
  }, _.omit(argv, [ '_' ]));

};

