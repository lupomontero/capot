//
// Installer
//
// * ensures there is a usable CouchDB we can access as admin.
// * modifies `server.settings.app.config.couchdb` when starting local CouchDB.
// * initialises databases (ensure existence, security doc, views, ...).
//

'use strict';


const Os = require('os');
const Fs = require('fs');
const Path = require('path');
const Read = require('read');
const _ = require('lodash');
const Async = require('async');
const Which = require('which');
const MultiCouch = require('multicouch');
const Couch = require('./couch');


const internals = {};


internals.ensureDataDir = function (config, cb) {

  Fs.exists(config.data, (exists) => {

    if (exists) {
      return cb();
    }

    Fs.mkdir(config.data, cb);
  });
};


internals.startCouchDBServer = function (server, config, cb) {

  const port = config.port + 1;
  const couchUrl = 'http://127.0.0.1:' + port;
  const couch = Couch({ url: couchUrl });
  const bin = Which.sync('couchdb');
  const couchServer = new MultiCouch({
    port: port,
    prefix: config.data,
    couchdb_path: bin
  });

  let retries = 10;

  const wait = function () {

    couch.get('/', (err, data) => {

      if (err) {
        if (!(retries--)) {
          return cb(err);
        }
        return setTimeout(wait, 1000);
      }

      const versionParts = data.version.split('.');
      const major = parseInt(versionParts[0], 10);
      const minor = parseInt(versionParts[1], 10);

      if (major !== 1 || minor < 6) {
        return cb(new Error('CouchDB version must be 1.6 or above'));
      }

      server.log('info', 'CouchDB Server ' + data.version + ' started on port ' + port);
      config.couchdb.url = couchUrl;
      cb();
    });
  };

  couchServer.on('start', wait);
  couchServer.on('error', (err) => {

    server.log('error', err);
  });

  const stop = function (code) {

    server.log('info', 'Stopping CouchDB Server...');
    process.removeListener('exit', stop);

    couchServer.once('stop', () => {

      server.log('info', 'CouchDB Server stopped.');
      process.exit(code);
    });

    couchServer.stop();
  };

  ['exit', 'SIGINT', 'SIGTERM'].forEach((eventName) => {

    process.once(eventName, stop);
  });

  couchServer.start();
};


internals.ensureAdminCredentials = function (server, config, cb) {

  const credentialsPath = Path.join(config.data, 'capot.json');

  const setCredentials = function (credentials) {

    _.extend(config.couchdb, _.pick(credentials, ['user', 'pass']));
    cb();
  };

  const saveCredentials = function () {

    const credentials = _.pick(config.couchdb, ['user', 'pass']);
    const json = JSON.stringify(credentials, null, 2);

    Fs.writeFile(credentialsPath, json, (err) => {

      if (err) {
        return cb(err);
      }
      setCredentials(credentials);
    });
  };

  const prompt = function () {

    Read({
      prompt: 'New password for "admin" user:',
      silent: true,
      timeout: 10 * 1000
    }, (err, answer) => {

      if (err) {
        return cb(err);
      }

      config.couchdb.pass = answer;
      saveCredentials();
    });
  };

  const getCredentials = function () {

    if (!config.couchdb.pass) {
      return prompt();
    }

    server.log('info', 'Using CouchDB credentials passed in environment');
    saveCredentials();
  };

  try {
    setCredentials(require(credentialsPath));
    server.log('info', 'Loaded CouchDB credentials from ' + credentialsPath);
  }
  catch (err) {
    getCredentials();
  }
};


internals.ensureAdminUser = function (config, cb) {

  const couch = Couch({ url: config.couchdb.url });

  couch.isAdminParty((err, isAdminParty) => {

    if (err) {
      return cb(err);
    }
    else if (isAdminParty && !config.couchdb.run) {
      return cb(new Error('Remote CouchDB is admin party!'));
    }
    else if (!isAdminParty) {
      return cb();
    }

    const url = '/_config/admins/' + encodeURIComponent(config.couchdb.user);
    couch.put(url, config.couchdb.pass, cb);
  });
};


internals.checkAdminCredentials = function (config, cb) {

  const couch = Couch({ url: config.couchdb.url });

  couch.post('/_session', {
    name: config.couchdb.user,
    password: config.couchdb.pass
  }, (err, data) => {

    const roles = (data || {}).roles || [];

    if (roles.indexOf('_admin') === -1) {
      return cb(new Error('Could not authenticate capot user on ' + config.couchdb.url));
    }

    cb();
  });
};


internals.ensureConfigValues = function (config, cb) {

  const couch = Couch(config.couchdb);

  Async.each([
    { key: 'couchdb/delayed_commits', val: 'false'  },
    { key: 'couch_httpd_auth/timeout', val: '1209600' },
    { key: 'couchdb/max_dbs_open', val: '1024' }
  ], (item, eachCb) => {

    couch.config.set(item.key, item.val, eachCb);
  }, cb);
};


internals.ensureUsersDesignDoc = function (config, cb) {

  const couch = Couch(config.couchdb);
  const usersDb = couch.db('_users');

  Async.series([
    function (seriesCb) {

      usersDb.addIndex('by_capot_id', {
        map: function (doc) {

          emit(doc.capotId, null);
        }
      }, seriesCb);
    },
    function (seriesCb) {

      usersDb.addIndex('by_reset_token', {
        map: function (doc) {

          if (doc.$reset && doc.$reset.token) {
            emit(doc.$reset.token, null);
          }
        }
      }, seriesCb);
    }
  ], cb);
};


internals.ensureAppDb = function (config, cb) {

  const couch = Couch(config.couchdb);
  couch.get('app', (err) => {

    if (err && err.statusCode !== 404) {
      return cb(err);
    }
    else if (!err) {
      return cb();
    }

    couch.put('app', cb);
  });
};


internals.ensureAppDbSecurity = function (config, cb) {

  const couch = Couch(config.couchdb);
  const db = couch.db('app');
  const securityDoc = {
    admins: { roles: ['_admin'] },
    members: { roles: ['_admin'] }
  };

  db.addSecurity(securityDoc, cb);
};


internals.ensureAppConfigDoc = function (config, cb) {

  const pkg = require(Path.join(config.cwd, 'package.json'));
  const couch = Couch(config.couchdb);
  const db = couch.db('app');

  db.get('config', (err) => {

    if (err && err.statusCode !== 404) {
      return cb(err);
    }
    else if (!err) {
      return cb();
    }

    db.put('config', {
      _id: 'config',
      app: {
        name: pkg.name,
        url: 'http://' + Os.hostname() + ':' + config.port
      }
    }, cb);
  });
};


module.exports = function (server, cb) {

  const config = server.settings.app.config;
  const tasks = [];

  if (!config.couchdb.url) {
    server.log('info', 'No CouchDB url in env, starting local CouchDB...');
    config.couchdb.run = true;
    tasks.push(internals.ensureDataDir);
    tasks.push(internals.startCouchDBServer.bind(null, server));
    tasks.push(internals.ensureAdminCredentials.bind(null, server));
  }
  else {
    server.log('info', 'Using remote CouchDB: ' + config.couchdb.url);
  }

  tasks.push(internals.ensureAdminUser);
  tasks.push(internals.checkAdminCredentials);
  tasks.push(internals.ensureConfigValues);
  tasks.push(internals.ensureUsersDesignDoc);
  tasks.push(internals.ensureAppDb);
  tasks.push(internals.ensureAppDbSecurity);
  tasks.push(internals.ensureAppConfigDoc);

  Async.applyEachSeries(tasks, config, cb);

};

