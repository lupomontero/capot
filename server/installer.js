var fs = require('fs');
var path = require('path');
var cp = require('child_process');
var readline = require('readline');
var _ = require('lodash');
var async = require('async');
var Couch = require('./couch');


function ensureDataDir(bonnet, cb) {
  fs.exists(bonnet.config.data, function (exists) {
    if (exists) { return cb(); }
    fs.mkdir(bonnet.config.data, cb);
  });
}


function startPouchDBServer(bonnet, cb) {
  var config = bonnet.config;
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
      bonnet.log.info('PouchDB Server started on port ' + port);
      child.stdout.removeListener('data', checkIfStarted);
      config.couchdb.url = 'http://127.0.0.1:' + port;
      cb();
    }
  }

  child.stdout.on('data', checkIfStarted);

  child.stderr.on('data', function (chunk) {
    bonnet.log.error(chunk.toString('utf8'));
  });

  child.on('error', function (err) {
    bonnet.log.error(err);
  });

  function stop(code) {
    bonnet.log.info('Stopping PouchDB Server...');
    process.removeListener('exit', stop);
    child.once('close', function () {
      bonnet.log.info('PouchDB Server stopped.');
      process.exit(code);
    });
    child.kill('SIGTERM');
  }

  [ 'exit', 'SIGINT', 'SIGTERM' ].forEach(function (eventName) {
    process.once(eventName, stop);
  });
}


function ensureAdminCredentials(bonnet, cb) {
  var config = bonnet.config;
  var credentialsPath = path.join(config.data, 'bonnet.json');

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


function ensureAdminUser(bonnet, cb) {
  var config = bonnet.config;
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


function checkAdminCredentials(bonnet, cb) {
  var config = bonnet.config;
  var couch = Couch({ url: config.couchdb.url });
  couch.post('/_session', {
    name: config.couchdb.user,
    password: config.couchdb.pass
  }, function (err, data) {
    var roles = (data || {}).roles || [];
    if (roles.indexOf('_admin') === -1) {
      return cb(new Error('Could not authenticate bonnet user on ' + config.couchdb.url));
    }
    cb();
  });
}


function ensureUsersDesignDoc(bonnet, cb) {
  var couch = Couch(bonnet.config.couchdb);
  var usersDb = couch.db('_users');

  usersDb.addIndex('by_bonnet_id', {
    map: function (doc) {
      emit(doc.bonnetId, null);
    }
  }, cb);
}


module.exports = function (bonnet, cb) {

  var config = bonnet.config;
  var log = bonnet.log;
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

  async.applyEachSeries(tasks, bonnet, function (err) {
    if (err) { return cb(err); }
    bonnet.couch = Couch(bonnet.config.couchdb);
    cb();
  });

};

