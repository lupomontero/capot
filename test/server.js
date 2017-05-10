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


internals.addDummyData = function (server, testUsers, cb) {

  const couch = Request.defaults({
    baseUrl: 'http://127.0.0.1:' + (server.settings.app.port + 1),
    auth: { user: 'admin', pass: server.settings.app.couchdb.pass },
    json: true
  });

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


internals.defaults = () => {

  return {
    port: 3333,
    quiet: true,
    cwd: Path.join(Os.tmpdir(), Pkg.name + '-test-' + Date.now()),
    couchdb: {
      pass: 'secret'
    }
  };
};


module.exports = (options) => {

  options = Object.assign({}, internals.defaults(), (options || {}));

  const testServer = {
    testUsers: [
      { email: 'test1-' + Date.now() + '@localhost', password: 'secret1' },
      { email: 'test2-' + Date.now() + '@localhost', password: 'secret1' }
    ],
    start: function (done) {

      this.timeout(30 * 1000);

      console.log('Creating test server cwd and package.json');

      Async.series([
        Async.apply(Rimraf, options.cwd),
        Async.apply(Mkdirp, options.cwd),
        Async.apply(Fs.writeFile, Path.join(options.cwd, 'package.json'), internals.pkgJsonTmpl)
      ], (err) => {

        if (err) {
          return done(err);
        }

        console.log('Test cwd and package.json created!');
        console.log('Creating test server...');

        Server(options, (err, s) => {

          if (err) {
            return done(err);
          }

          console.log('Test server created!');

          testServer.app = s.app;
          testServer.inject = s.inject.bind(s);

          if (!options.dummyData) {
            return done();
          }

          console.log('Adding dummy data...');

          internals.addDummyData(s, testServer.testUsers, (err) => {

            if (err) {
              return done(err);
            }

            console.log('Added dummy data!');

            done();
          });
        });
      });
    },
    stop: function () {

      //...
    }
  };

  return testServer;
};
