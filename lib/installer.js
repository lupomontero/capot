//
// Installer
//
// * ensures there is a usable CouchDB we can access as admin.
// * modifies `server.settings.app.couchdb` when starting local CouchDB.
// * initialises databases (ensure existence, security doc, views, ...).
//

'use strict';


const Os = require('os');
const Fs = require('fs');
const Path = require('path');
const Read = require('read');
const _ = require('lodash'); // TODO: remove lodash dependency
const Async = require('async');
const Which = require('which');
const MultiCouch = require('multicouch');
const Couch = require('./couch');


const internals = {};


internals.ensureDataDir = (settings, cb) => {

  Fs.exists(settings.data, (exists) => {

    if (exists) {
      return cb();
    }

    Fs.mkdir(settings.data, cb);
  });
};


internals.startCouchDBServer = (server, settings, cb) => {

  const port = settings.port + 1;
  const couchUrl = 'http://127.0.0.1:' + port;
  const couch = Couch({ url: couchUrl });
  const bin = Which.sync('couchdb');
  const couchServer = new MultiCouch({
    port,
    prefix: settings.data,
    couchdb_path: bin
  });

  let retries = 10;

  const wait = () => {

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
      settings.couchdb.url = couchUrl;
      cb();
    });
  };

  couchServer.on('start', wait);
  couchServer.on('error', (err) => {

    server.log('error', err);
  });

  const stop = (code) => {

    server.log('info', 'Stopping CouchDB Server...');

    ['exit', 'SIGINT', 'SIGTERM'].forEach((eventName) => {

      process.removeListener(eventName, stop);
    });

    couchServer.once('stop', () => {

      server.log('info', 'CouchDB Server stopped.');
      process.exit(code);
    });

    couchServer.stop();
  };

  ['exit', 'SIGINT', 'SIGTERM'].forEach((eventName) => {

    process.on(eventName, stop);
  });

  couchServer.start();
};


internals.ensureAdminCredentials = (server, settings, cb) => {

  const credentialsPath = Path.join(settings.data, 'capot.json');

  const setCredentials = (credentials) => {

    _.extend(settings.couchdb, _.pick(credentials, ['user', 'pass']));
    cb();
  };

  const saveCredentials = () => {

    const credentials = _.pick(settings.couchdb, ['user', 'pass']);
    const json = JSON.stringify(credentials, null, 2);

    Fs.writeFile(credentialsPath, json, (err) => {

      if (err) {
        return cb(err);
      }
      setCredentials(credentials);
    });
  };

  const prompt = () => {

    Read({
      prompt: 'New password for "admin" user:',
      silent: true,
      timeout: 10 * 1000
    }, (err, answer) => {

      if (err) {
        return cb(err);
      }

      settings.couchdb.pass = answer;
      saveCredentials();
    });
  };

  const getCredentials = () => {

    if (!settings.couchdb.pass) {
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


internals.ensureAdminUser = (settings, cb) => {

  const couch = Couch({ url: settings.couchdb.url });

  couch.isAdminParty((err, isAdminParty) => {

    if (err) {
      return cb(err);
    }
    else if (isAdminParty && !settings.couchdb.run) {
      return cb(new Error('Remote CouchDB is admin party!'));
    }
    else if (!isAdminParty) {
      return cb();
    }

    const url = '/_config/admins/' + encodeURIComponent(settings.couchdb.user);
    couch.put(url, settings.couchdb.pass, cb);
  });
};


internals.checkAdminCredentials = (settings, cb) => {

  const couch = Couch({ url: settings.couchdb.url });

  couch.post('/_session', {
    name: settings.couchdb.user,
    password: settings.couchdb.pass
  }, (err, data) => {

    if (err) {
      data = {};
    }

    const roles = (data || {}).roles || [];

    if (roles.indexOf('_admin') === -1) {
      return cb(new Error('Could not authenticate capot user on ' + settings.couchdb.url));
    }

    cb();
  });
};


internals.ensureConfigValues = (settings, cb) => {

  const couch = Couch(settings.couchdb);

  Async.each([
    { key: 'couchdb/delayed_commits', val: 'false'  },
    { key: 'couch_httpd_auth/timeout', val: '1209600' },
    { key: 'couchdb/max_dbs_open', val: '1024' },
    { key: 'httpd/enable_cors', val: 'true' }
  ], (item, eachCb) => {

    couch.config.set(item.key, item.val, eachCb);
  }, cb);
};


internals.ensureUsersDesignDoc = (settings, cb) => {

  const couch = Couch(settings.couchdb);
  const usersDb = couch.db('_users');

  Async.series([
    (seriesCb) => {

      usersDb.addIndex('by_uid', {
        map: function (doc) {

          emit(doc.uid, null);
        }
      }, seriesCb);
    },
    (seriesCb) => {

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


internals.ensureAppDb = (settings, cb) => {

  const couch = Couch(settings.couchdb);
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


internals.ensureAppDbSecurity = (settings, cb) => {

  const couch = Couch(settings.couchdb);
  const db = couch.db('app');
  const securityDoc = {
    admins: { roles: ['_admin'] },
    members: { roles: ['_admin'] }
  };

  db.addSecurity(securityDoc, cb);
};


internals.ensureAppConfigDoc = (settings, cb) => {

  const pkg = require(Path.join(settings.cwd, 'package.json'));
  const couch = Couch(settings.couchdb);
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
        url: 'http://' + Os.hostname() + ':' + settings.port
      }
    }, cb);
  });
};


module.exports = (server, cb) => {

  const settings = server.settings.app;
  const tasks = [];

  if (!settings.couchdb.url) {
    server.log('info', 'No CouchDB url in env, starting local CouchDB...');
    settings.couchdb.run = true;
    tasks.push(internals.ensureDataDir);
    tasks.push(internals.startCouchDBServer.bind(null, server));
    tasks.push(internals.ensureAdminCredentials.bind(null, server));
  }
  else {
    server.log('info', 'Using remote CouchDB: ' + settings.couchdb.url);
  }

  tasks.push(internals.ensureAdminUser);
  tasks.push(internals.checkAdminCredentials);
  tasks.push(internals.ensureConfigValues);
  tasks.push(internals.ensureUsersDesignDoc);
  tasks.push(internals.ensureAppDb);
  tasks.push(internals.ensureAppDbSecurity);
  tasks.push(internals.ensureAppConfigDoc);

  Async.applyEachSeries(tasks, settings, cb);

};
