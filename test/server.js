'use strict';


const Os = require('os');
const Fs = require('fs');
const Path = require('path');
const Async = require('async');
const Mkdirp = require('mkdirp');
const Rimraf = require('rimraf');
const Request = require('request');
const Pkg = require('../package.json');
const Server = require('../');


const internals = {};


internals.getAllUserDocs = function (couch, cb) {

  couch('/_users/_all_docs', {
    qs: {
      startkey: '"org.couchdb.user:"',
      endkey: '"org.couchdb.user;"',
      include_docs: 'true'
    }
  }, (err, resp) => {

    if (err) {
      return cb(err);
    }

    if (resp.statusCode !== 200) {
      return cb(new Error(resp.body.error));
    }

    cb(null, resp.body.rows.map((row) => {

      return row.doc;
    }));
  });
};


internals.removeDummyUsers = function (server, couch, cb) {

  internals.getAllUserDocs(couch, (err, docs) => {

    if (err) {
      return cb(err);
    }
    else if (!docs.length) {
      return cb();
    }

    docs.forEach((doc) => {

      doc._deleted = true;
    });

    couch({
      method: 'POST',
      url: '/_users/_bulk_docs',
      body: { docs }
    }, (err, resp) => {

      if (err) {
        return cb(err);
      }

      if (resp.statusCode > 201) {
        return cb(new Error(resp.body.error));
      }

      cb();
    });
  });
};


internals.removeDummyData = function (server, couch, cb) {

  Async.parallel([
    Async.apply(internals.removeDummyUsers, server, couch)
  ], cb);
};


internals.waitForUserReady = function (server, testUser, cb) {

  server.inject({
    method: 'POST',
    url: '/_session',
    payload: testUser
  }, (resp) => {

    if (resp.statusCode !== 200) {
      cb(err);
    }
    else if (!resp.result.roles || !resp.result.roles.length) {
      setTimeout(() => {

        internals.waitForUserReady(server, testUser, cb);
      }, 300);
    }
    else {
      cb();
    }
  });
};


internals.addDummyUser = function (server, testUser, cb) {

  server.inject({
    method: 'POST',
    url: '/_users',
    payload: {
      email: testUser.email,
      password: testUser.password
    }
  }, (resp) => {

    if (!resp || !resp.statusCode || resp.statusCode > 201) {
      return cb(new Error('Error adding dummy user'));
    }

    internals.waitForUserReady(server, testUser, cb);
  });
};


internals.addDummyData = function (server, couch, testUsers, cb) {

  internals.removeDummyData(server, couch, (err) => {

    if (err) {
      return cb(err);
    }

    Async.each(testUsers, Async.apply(internals.addDummyUser, server), cb);
  });
};


internals.pkgJsonTmpl = JSON.stringify({
  name: Pkg.name + '-test-app',
  version: Pkg.version
}, null, 2);


module.exports = function TestServer(options, cb) {

  if (arguments.length === 1) {
    cb = options;
    options = {};
  }

  const port = 3333;
  const couchdbPass = 'secret';
  const tmpdir = Path.join(Os.tmpdir(), Pkg.name + '-test-' + Date.now());
  const couch = Request.defaults({
    baseUrl: 'http://127.0.0.1:' + (port + 1),
    auth: { user: 'admin', pass: couchdbPass },
    json: true
  });


  Async.series([
    Async.apply(Rimraf, tmpdir),
    Async.apply(Mkdirp, tmpdir),
    Async.apply(Fs.writeFile, Path.join(tmpdir, 'package.json'), internals.pkgJsonTmpl)
  ], (err) => {

    if (err) {
      return cb(err);
    }

    Server({
      port,
      quiet: true,
      cwd: tmpdir,
      couchdb: {
        pass: 'secret'
      }
    }, (err, server) => {

      if (err) {
        return cb(err);
      }

      server.testUsers  = [
        { email: 'test1-' + Date.now() + '@localhost', password: 'secret1' },
        { email: 'test2-' + Date.now() + '@localhost', password: 'secret1' }
      ];

      internals.addDummyData(server, couch, server.testUsers, (err) => {

        if (err) {
          return cb(err);
        }

        cb(null, server);
      });
    });
  });

};
