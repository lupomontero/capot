'use strict';


const Path = require('path');


module.exports = (options) => {

  options = options || {};

  const env = process.env;
  const cwd = options.cwd || env.CWD || process.cwd();
  const couchdb = options.couchdb || {};

  const settings = {
    debug: options.debug === true || env.DEBUG === 'true',
    quiet: options.quiet === true || env.QUIET === 'true',
    port: options.port || env.PORT || 3001,
    cwd,
    data: options.data || env.DATA || Path.join(cwd, 'data'),
    couchdb: {
      url: couchdb.url || env.COUCHDB_URL,
      user: couchdb.user || env.COUCHDB_USER || 'admin',
      pass: couchdb.pass || env.COUCHDB_PASS
    },
    pkg: require(Path.join(cwd, 'package.json'))
  };

  if (typeof settings.port === 'string') {
    settings.port = parseInt(settings.port, 10);
  }

  Object.keys(options).forEach((key) => {

    if (!settings.hasOwnProperty(key)) {
      settings[key] = options[key];
    }
  });

  return settings;
};
