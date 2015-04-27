var fs = require('fs');
var path = require('path');
var readline = require('readline');
var _ = require('lodash');
var async = require('async');
var which = require('which');
var MultiCouch = require('multicouch');
var Couch = require('./couch');


function ensureDataDir(capot, cb) {
  fs.exists(capot.config.data, function (exists) {
    if (exists) { return cb(); }
    fs.mkdir(capot.config.data, cb);
  });
}


function startCouchDBServer(log, capot, cb) {
  var config = capot.config;
  var retries = 10;
  var port = config.port + 1;
  var couchUrl = 'http://127.0.0.1:' + port;
  var couch = Couch({ url: couchUrl });
  var bin = which.sync('couchdb');
  var server = new MultiCouch({
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
      log.info('CouchDB Server ' + data.version + ' started on port ' + port);
      config.couchdb.url = couchUrl;
      cb();
    });
  }

  server.on('start', wait);
  server.on('error', function (err) { log.error(err); });

  function stop(code) {
    log.info('Stopping CouchDB Server...');
    process.removeListener('exit', stop);
    server.once('stop', function () {
      log.info('CouchDB Server stopped.');
      process.exit(code);
    });
    server.stop();
  }

  [ 'exit', 'SIGINT', 'SIGTERM' ].forEach(function (eventName) {
    process.once(eventName, stop);
  });

  server.start();
}


function ensureAdminCredentials(capot, cb) {
  var config = capot.config;
  var credentialsPath = path.join(config.data, 'capot.json');

  function prompt() {
    var rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('New password for "admin" user:', function (answer) {
      var credentials = { user: 'admin', pass: answer };
      var json = JSON.stringify(credentials, null, 2);
      rl.close();
      fs.writeFile(credentialsPath, json, function (err) {
        if (err) { return cb(err); }
        setConfig(credentials);
      });
    });
  }

  function setConfig(credentials) {
    _.extend(config.couchdb, _.pick(credentials, [ 'user', 'pass' ]));
    cb();
  }

  try {
    setConfig(require(credentialsPath));
  } catch (err) {
    return prompt();
  }
}


function ensureAdminUser(capot, cb) {
  var config = capot.config;
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


function checkAdminCredentials(capot, cb) {
  var config = capot.config;
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


function ensureNoDelayedCommits(capot, cb) {
  var couch = Couch(capot.config.couchdb);
  var url = '/_config/couchdb/delayed_commits';
  couch.get(url, function (err, data) {
    if (err) { return cb(err); }
    if (data === 'false') { return cb(); }
    couch.put(url, 'false', cb);
  });
}


function ensureUsersDesignDoc(capot, cb) {
  var couch = Couch(capot.config.couchdb);
  var usersDb = couch.db('_users');

  async.series([
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


function ensureAppDb(capot, cb) {
  var couch = Couch(capot.config.couchdb);
  couch.get('app', function (err) {
    if (err && err.statusCode !== 404) {
      return cb(err);
    } else if (!err) {
      return cb();
    }
    couch.put('app', cb);
  });
}


function ensureAppConfigDoc(capot, cb) {
  var couch = Couch(capot.config.couchdb);
  var db = couch.db('app');
  db.get('config', function (err) {
    if (err && err.status !== 404) {
      return cb(err);
    } else if (!err) {
      return cb();
    }
    db.put({ _id: 'config' }, cb);
  });
}


module.exports = function (capot, cb) {

  var config = capot.config;
  var log = capot.log.child({ scope: 'capot.installer' });
  var tasks = [];

  if (!config.couchdb.url) {
    log.info('No CouchDB url in env, starting local CouchDB...');
    config.couchdb.run = true;
    tasks.push(ensureDataDir);
    tasks.push(startCouchDBServer.bind(null, log));
    tasks.push(ensureAdminCredentials);
  } else {
    log.info('Using remote CouchDB: ' + config.couchdb.url);
  }

  tasks.push(ensureAdminUser);
  tasks.push(checkAdminCredentials);
  tasks.push(ensureNoDelayedCommits);
  tasks.push(ensureUsersDesignDoc);
  tasks.push(ensureAppDb);
  tasks.push(ensureAppConfigDoc);

  async.applyEachSeries(tasks, capot, function (err) {
    if (err) { return cb(err); }
    capot.couch = Couch(capot.config.couchdb);
    cb();
  });

};

