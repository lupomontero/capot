var fs = require('fs');
var path = require('path');
var cp = require('child_process');
var readline = require('readline');
var _ = require('lodash');
var async = require('async');
var Couch = require('./couch');


function ensureDataDir(capot, cb) {
  fs.exists(capot.config.data, function (exists) {
    if (exists) { return cb(); }
    fs.mkdir(capot.config.data, cb);
  });
}


function startPouchDBServer(capot, cb) {
  var config = capot.config;
  var bin = path.join(__dirname, '../node_modules/pouchdb-server/bin/pouchdb-server');
  var port = config.port + 1;
  var args = [
    '--port', port,
    '--dir', config.data,
    '--config', path.join(config.data, 'config.json')
  ];
  var options = { cwd: config.data/*, stdio: 'inherit'*/ };
  var child = cp.spawn(bin, args, options);

  function checkIfStarted(chunk) {
    if (/pouchdb-server has started/.test(chunk.toString('utf8'))) {
      capot.log.info('PouchDB Server started on port ' + port);
      child.stdout.removeListener('data', checkIfStarted);
      config.couchdb.url = 'http://127.0.0.1:' + port;
      cb();
    }
  }

  child.stdout.on('data', checkIfStarted);

  child.stderr.on('data', function (chunk) {
    capot.log.error(chunk.toString('utf8'));
  });

  child.on('error', function (err) {
    capot.log.error(err);
  });

  function stop(code) {
    capot.log.info('Stopping PouchDB Server...');
    process.removeListener('exit', stop);
    child.once('close', function () {
      capot.log.info('PouchDB Server stopped.');
      process.exit(code);
    });
    child.kill('SIGTERM');
  }

  [ 'exit', 'SIGINT', 'SIGTERM' ].forEach(function (eventName) {
    process.once(eventName, stop);
  });
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


function ensureUsersDesignDoc(capot, cb) {
  var couch = Couch(capot.config.couchdb);
  var usersDb = couch.db('_users');

  usersDb.addIndex('by_capot_id', {
    map: function (doc) {
      emit(doc.capotId, null);
    }
  }, cb);
}


module.exports = function (capot, cb) {

  var config = capot.config;
  var log = capot.log;
  var tasks = [];

  if (!config.couchdb.url) {
    log.info('No CouchDB url in config so will start local PouchDB server');
    config.couchdb.run = true;
    tasks.push(ensureDataDir);
    tasks.push(startPouchDBServer);
    tasks.push(ensureAdminCredentials);
  } else {
    log.info('Using remote CouchDB: ' + config.couchdb.url);
  }

  tasks.push(ensureAdminUser);
  tasks.push(checkAdminCredentials);
  tasks.push(ensureUsersDesignDoc);

  async.applyEachSeries(tasks, capot, function (err) {
    if (err) { return cb(err); }
    capot.couch = Couch(capot.config.couchdb);
    cb();
  });

};

