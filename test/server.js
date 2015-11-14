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


const internals = {};


internals.defaults = {
  bin: Path.join(__dirname, '../bin/cli.js'),
  port: 3333,
  pass: 'secret'
};


internals.removeDummyUsers = function (couch, cb) {

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

    const docs = resp.body.rows.map((row) => {

      row.doc._deleted = true;
      return row.doc;
    });

    if (!docs.length) {
      return cb();
    }

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


internals.removeDummyData = function (couch, cb) {

  Async.parallel([
    Async.apply(internals.removeDummyUsers, couch)
  ], cb);
};


internals.addDummyUser = function (uri, name, pass, cb) {

  Request({
    method: 'PUT',
    url: uri + '/_couch/_users/org.couchdb.user:' + name,
    json: true,
    body: {
      name: name,
      password: pass,
      roles: [],
      type: 'user'
    }
  }, (err, resp) => {

    if (err) {
      return cb(err);
    }

    if (resp.statusCode > 201) {
      return cb(new Error(resp.body.error));
    }

    cb();
  });
};


internals.addDummyData = function (couch, uri, cb) {

  internals.removeDummyData(couch, (err) => {

    if (err) {
      return cb(err);
    }

    internals.addDummyUser(uri, 'testuser1@example.com', 'secret1', cb);
  });
};


internals.pkgJsonTmpl = JSON.stringify({
  name: Pkg.name + '-test-app',
  version: Pkg.version
}, null, 2);


module.exports = function TestServer(options) {

  const settings = _.extend({}, internals.defaults, options);
  const tmpdir = Path.join(Os.tmpdir(), Pkg.name + '-test-' + Date.now());
  const uri = 'http://127.0.0.1:' + settings.port;
  const couch = Request.defaults({
    baseUrl: uri + '/_couch',
    auth: { user: 'admin', pass: settings.pass },
    json: true
  });

  let child;


  return {


    start: function (dummyData, done) {

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

        child = Cp.spawn(settings.bin, ['--port', settings.port, '--debug'], {
          cwd: tmpdir,
          env: _.extend({}, process.env, { COUCHDB_PASS: settings.pass })
        });

        child.stderr.on('data', (chunk) => {

          console.error('stderr: ' + chunk);
        });

        child.stdout.on('data', (chunk) => {

          // keep output, so that if server crashes we can show it.
          out.push(chunk);

          if (/capot back-end has started/i.test(chunk)) {
            const originalDone = done;
            done = function () {};
            if (!dummyData) {
              return originalDone();
            }
            internals.addDummyData(couch, uri, originalDone);
          }
        });

        child.once('close', (code, signal) => {

          if (code > 0) {
            console.error(out.join(''));
            done(new Error('Server crashed!'));
          }
        });
      });
    },


    stop: function (done) {

      if (typeof child.exitCode === 'number') {
        return Rimraf(tmpdir, done);
      }

      child.once('close', (code, signal) => {

        Rimraf(tmpdir, done);
      });

      child.kill();
    },


    req: Request.defaults({
      baseUrl: uri,
      json: true
    })


  };
};

