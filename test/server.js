'use strict';


const Os = require('os');
const Cp = require('child_process');
const Fs = require('fs');
const Path = require('path');
const _ = require('lodash');
const Async = require('async');
const Mkdirp = require('mkdirp');
const Rimraf = require('rimraf');
const Request = require('request');
const Pkg = require('../package.json');
const Server = require('../server');


const internals = {};


internals.defaults = {
  port: 3333,
  pass: 'secret'
};


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
      body: { docs: docs }
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


internals.waitForUserReady = function (server, uri, testUser, cb) {

  server.inject({
    method: 'POST',
    url: uri + '/_session',
    payload: testUser
  }, (resp) => {

    if (resp.statusCode !== 200) {
      cb(err);
    }
    else if (!resp.result.roles || !resp.result.roles.length) {
      setTimeout(() => {

        internals.waitForUserReady(server, uri, testUser, cb);
      }, 300);
    }
    else {
      cb();
    }
  });
};


internals.addDummyUser = function (server, uri, testUser, cb) {

  server.inject({
    method: 'POST',
    url: uri + '/_users',
    payload: {
      email: testUser.email,
      password: testUser.password
    }
  }, (resp) => {

    if (!resp || !resp.statusCode || resp.statusCode > 201) {
      return cb(new Error('Error adding dummy user'));
    }

    internals.waitForUserReady(server, uri, testUser, cb);
  });
};


internals.addDummyData = function (server, couch, uri, testUsers, cb) {

  internals.removeDummyData(server, couch, (err) => {

    if (err) {
      return cb(err);
    }

    Async.each(testUsers, Async.apply(internals.addDummyUser, server, uri), cb);
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
  const uri = 'http://127.0.0.1:' + port;
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
      port: 3333,
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

      internals.addDummyData(server, couch, uri, server.testUsers, (err) => {

        if (err) {
          return cb(err);
        }

        cb(null, server);
      });
    });
  });


  /*
  const server = {
    settings: settings,
    tmpdir: tmpdir,
    uri: uri,
    couch: couch,
    child: null,
    testUsers: [
      { email: 'test1-' + Date.now() + '@localhost', password: 'secret1' },
      { email: 'test2-' + Date.now() + '@localhost', password: 'secret1' }
    ]
  };


  server.start = function (dummyData, done) {

    if (arguments.length === 1) {
      done = dummyData;
      dummyData = false;
    }

    Async.series([
      Async.apply(Rimraf, tmpdir),
      Async.apply(Mkdirp, tmpdir),
      Async.apply(Fs.writeFile, Path.join(tmpdir, 'package.json'), internals.pkgJsonTmpl)
    ], (err) => {

      const out = [];

      if (err) {
        return done(err);
      }

      server.child = Cp.spawn(settings.bin, ['--port', settings.port, '--debug'], {
        cwd: tmpdir,
        env: _.extend({}, process.env, { COUCHDB_PASS: settings.pass })
      });

      server.child.stderr.on('data', (chunk) => {

        console.error('stderr: ' + chunk);
      });

      server.child.stdout.on('data', (chunk) => {

        // keep output, so that if server crashes we can show it.
        out.push(chunk);

        if (/capot back-end has started/i.test(chunk)) {
          const originalDone = done;
          done = function () {};
          if (!dummyData) {
            return originalDone();
          }
          internals.addDummyData(couch, uri, server.testUsers, originalDone);
        }
      });

      server.child.once('close', (code, signal) => {

        if (code > 0) {
          console.error(out.join(''));
          done(new Error('Server crashed!'));
        }
      });
    });
  };


  server.stop = function (done) {

    if (typeof server.child.exitCode === 'number') {
      return Rimraf(tmpdir, done);
    }

    server.child.once('close', (code, signal) => {

      Rimraf(tmpdir, done);
    });

    server.child.kill();
  };


  server.req = Request.defaults({
    baseUrl: uri,
    json: true
  });


  return server;
  */

};

