'use strict';


const Path = require('path');


module.exports = function (options) {

  options = options || {};

  const env = process.env;
  const cwd = options.cwd || env.CWD || process.cwd();
  const couchdb = options.couchdb || {};

  const settings = {
    debug: options.debug === true || env.DEBUG === 'true',
    port: options.port || env.PORT || 3001,
    cwd: cwd,
    data: Path.join(cwd, 'data'),
    couchdb: {
      url: couchdb.url || env.COUCHDB_URL,
      user: couchdb.user || env.COUCHDB_USER || 'admin',
      pass: couchdb.pass || env.COUCHDB_PASS
    },
    pkg: require(Path.join(cwd, 'package.json'))
  };

  Object.keys(options).forEach((key) => {

    if (!settings.hasOwnProperty(key)) {
      settings[key] = options[key];
    }
  });

  return settings;
};
