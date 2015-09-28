//
// Installer
//
// * ensures there is a usable CouchDB we can access as admin.
// * modifies `server.settings.app.config.couchdb` when starting local CouchDB.
// * initialises databases (ensure existence, security doc, views, ...).
//


var Os = require('os');
var Fs = require('fs');
var Path = require('path');
var Read = require('read');
var _ = require('lodash');
var Async = require('async');
var Which = require('which');
var MultiCouch = require('multicouch');
var Couch = require('./couch');


var internals = {};


function ensureDataDir(config, cb) {
  Fs.exists(config.data, function (exists) {
    if (exists) { return cb(); }
    Fs.mkdir(config.data, cb);
  });
}


function startCouchDBServer(server, config, cb) {
  var retries = 10;
  var port = config.port + 1;
  var couchUrl = 'http://127.0.0.1:' + port;
  var couch = Couch({ url: couchUrl });
  var bin = Which.sync('couchdb');
  var couchServer = new MultiCouch({
    port: port,
    prefix: config.data,
    couchdb_path: bin
  });


  function wait() {
    couch.get('/', function (err, data) {
      if (err) {
        if (!(retries--)) { return cb(err); }
        return setTimeout(wait, 1000);
      }
      var versionParts = data.version.split('.');
      var major = parseInt(versionParts[0], 10);
      var minor = parseInt(versionParts[1], 10);
      if (major !== 1 || minor < 6) {
        return cb(new Error('CouchDB version must be 1.6 or above'));
      }
      server.log('info', 'CouchDB Server ' + data.version + ' started on port ' + port);
      config.couchdb.url = couchUrl;
      cb();
    });
  }

  couchServer.on('start', wait);
  couchServer.on('error', function (err) { server.log('error', err); });

  function stop(code) {
    server.log('info', 'Stopping CouchDB Server...');
    process.removeListener('exit', stop);
    couchServer.once('stop', function () {
      server.log('info', 'CouchDB Server stopped.');
      process.exit(code);
    });
    couchServer.stop();
  }

  [ 'exit', 'SIGINT', 'SIGTERM' ].forEach(function (eventName) {
    process.once(eventName, stop);
  });

  couchServer.start();
}


function ensureAdminCredentials(server, config, cb) {
  var credentialsPath = Path.join(config.data, 'capot.json');

  function setCredentials(credentials) {
    _.extend(config.couchdb, _.pick(credentials, [ 'user', 'pass' ]));
    cb();
  }

  function saveCredentials() {
    var credentials = _.pick(config.couchdb, [ 'user', 'pass' ]);
    var json = JSON.stringify(credentials, null, 2);
    Fs.writeFile(credentialsPath, json, function (err) {
      if (err) { return cb(err); }
      setCredentials(credentials);
    });
  }

  function prompt() {
    Read({
      prompt: 'New password for "admin" user:',
      silent: true,
      timeout: 10 * 1000
    }, function (err, answer) {
      if (err) { return cb(err); }
      config.couchdb.pass = answer;
      saveCredentials();
    });
  }

  function getCredentials() {
    if (!config.couchdb.pass) {
      return prompt();
    }
    server.log('info', 'Using CouchDB credentials passed in environment');
    saveCredentials();
  }

  try {
    setCredentials(require(credentialsPath));
    server.log('info', 'Loaded CouchDB credentials from ' + credentialsPath);
  } catch (err) {
    getCredentials();
  }
}


function ensureAdminUser(config, cb) {
  var couch = Couch({ url: config.couchdb.url });

  function createAdminUser(config, cb) {
    var url = '/_config/admins/' + encodeURIComponent(config.couchdb.user);
    couch.put(url, config.couchdb.pass, cb);
  }

  couch.isAdminParty(function (err, isAdminParty) {
    if (err) {
      cb(err);
    } else if (isAdminParty && !config.couchdb.run) {
      cb(new Error('Remote CouchDB is admin party!'));
    } else if (isAdminParty) {
      createAdminUser(config, cb);
    } else {
      cb();
    }
  });
}


function checkAdminCredentials(config, cb) {
  var couch = Couch({ url: config.couchdb.url });
  couch.post('/_session', {
    name: config.couchdb.user,
    password: config.couchdb.pass
  }, function (err, data) {
    var roles = (data || {}).roles || [];
    if (roles.indexOf('_admin') === -1) {
      return cb(new Error('Could not authenticate capot user on ' + config.couchdb.url));
    }
    cb();
  });
}


function ensureConfigValues(config, cb) {
  var couch = Couch(config.couchdb);
  Async.each([
    { key: 'couchdb/delayed_commits', val: 'false'  },
    { key: 'couch_httpd_auth/timeout', val: '1209600' },
    { key: 'couchdb/max_dbs_open', val: '1024' }
  ], function (item, cb) {
    couch.config.set(item.key, item.val, cb);
  }, cb);
}


function ensureUsersDesignDoc(config, cb) {
  var couch = Couch(config.couchdb);
  var usersDb = couch.db('_users');

  Async.series([
    function (cb) {
      usersDb.addIndex('by_capot_id', {
        map: function (doc) {
          emit(doc.capotId, null);
        }
      }, cb);
    },
    function (cb) {
      usersDb.addIndex('by_reset_token', {
        map: function (doc) {
          if (doc.$reset && doc.$reset.token) {
            emit(doc.$reset.token, null);
          }
        }
      }, cb);
    }
  ], cb);
}


function ensureAppDb(config, cb) {
  var couch = Couch(config.couchdb);
  couch.get('app', function (err) {
    if (err && err.statusCode !== 404) {
      return cb(err);
    } else if (!err) {
      return cb();
    }
    couch.put('app', cb);
  });
}


function ensureAppDbSecurity(config, cb) {
  var couch = Couch(config.couchdb);
  var db = couch.db('app');
  var securityDoc = {
    admins: { roles: [ '_admin' ] },
    members: { roles: [ '_admin' ] }
  };
  db.addSecurity(securityDoc, cb);
}


function ensureAppConfigDoc(config, cb) {
  var pkg = require(Path.join(config.cwd, 'package.json'));
  var couch = Couch(config.couchdb);
  var db = couch.db('app');
  db.get('config', function (err) {
    if (err && err.statusCode !== 404) {
      return cb(err);
    } else if (!err) {
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
}


module.exports = function (server, cb) {

  var config = server.settings.app.config;
  var tasks = [];

  if (!config.couchdb.url) {
    server.log('info', 'No CouchDB url in env, starting local CouchDB...');
    config.couchdb.run = true;
    tasks.push(ensureDataDir);
    tasks.push(startCouchDBServer.bind(null, server));
    tasks.push(ensureAdminCredentials.bind(null, server));
  } else {
    server.log('info', 'Using remote CouchDB: ' + config.couchdb.url);
  }

  tasks.push(ensureAdminUser);
  tasks.push(checkAdminCredentials);
  tasks.push(ensureConfigValues);
  tasks.push(ensureUsersDesignDoc);
  tasks.push(ensureAppDb);
  tasks.push(ensureAppDbSecurity);
  tasks.push(ensureAppConfigDoc);

  Async.applyEachSeries(tasks, config, cb);

};

