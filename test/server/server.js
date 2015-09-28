var Os = require('os');
var Cp = require('child_process');
var Fs = require('fs');
var Path = require('path');
var Assert = require('assert');
var _ = require('lodash');
var Async = require('async');
var Mkdirp = require('mkdirp');
var Rimraf = require('rimraf');
var Request = require('request');
var Pkg = require('../../package.json');


var internals = {};


var bin = Path.join(__dirname, '../../bin/cli.js');
var tmpdir = Path.join(Os.tmpdir(), Pkg.name + '-test-' + Date.now());
var port = 3333;
var pass = 'secret';
var uri = 'http://127.0.0.1:' + port;
var child;


var couch = Request.defaults({
  baseUrl: uri + '/_couch',
  auth: { user: 'admin', pass: pass },
  json: true
});


function removeDummyUsers(cb) {
  couch('/_users/_all_docs', {
    qs: {
      startkey: '"org.couchdb.user:"',
      endkey: '"org.couchdb.user;"',
      include_docs: 'true'
    }
  }, function (err, resp) {
    if (err) { return cb(err); }
    if (resp.statusCode !== 200) {
      return cb(new Error(resp.body.error));
    }

    var docs = resp.body.rows.map(function (row) {
      row.doc._deleted = true;
      return row.doc;
    });

    if (!docs.length) { return cb(); }

    couch({
      method: 'POST',
      url: '/_users/_bulk_docs',
      body: { docs: docs }
    }, function (err, resp) {
      if (err) { return cb(err); }
      if (resp.statusCode > 201) {
        return cb(new Error(resp.body.error));
      }
      cb();
    });
  });
}


function removeDummyData(cb) {
  Async.parallel([
    removeDummyUsers,
  ], cb); 
}


function addDummyUser(name, pass, cb) {
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
  }, function (err, resp) {
    if (err) { return cb(err); }
    if (resp.statusCode > 201) {
      return cb(new Error(resp.body.error));
    }
    cb();
  });
}


function addDummyData(cb) {
  removeDummyData(function (err) {
    if (err) { return cb(err); }
    addDummyUser('testuser1', 'secret1', cb);
  });
}


internals.pkgJsonTmpl = JSON.stringify({
  name: Pkg.name + '-test-app',
  version: Pkg.version
}, null, 2);


exports.start = function (dummyData, done) {

  if (arguments.length === 1) {
    done = dummyData;
    dummyData = false;
  }

  Async.series([
    Async.apply(Rimraf, tmpdir),
    Async.apply(Mkdirp, tmpdir),
    Async.apply(Fs.writeFile, Path.join(tmpdir, 'package.json'), internals.pkgJsonTmpl)
  ], function (err) {

    var out = [];

    if (err) { return done(err); }

    child = Cp.spawn(bin, [ '--port', port, '--debug' ], {
      cwd: tmpdir,
      env: _.extend({}, process.env, { COUCHDB_PASS: pass })
    });

    child.stderr.on('data', function (chunk) {

      // keep output, so that if server crashes we can show it.
      out.push(chunk);

      if (/capot back-end has started/i.test(chunk)) {
        var originalDone = done;
        done = function () {};
        if (!dummyData) { return originalDone(); }
        addDummyData(originalDone);
      }
    });

    child.once('close', function (code, signal) {

      if (code > 0) {
        console.error(out.join(''));
        done(new Error('Server crashed!'));
      }
    });
  });
};


exports.stop = function (done) {

  if (typeof child.exitCode === 'number') {
    return Rimraf(tmpdir, done);
  }

  child.once('close', function (code, signal) {

    Rimraf(tmpdir, done);
  });

  child.kill();
};


exports.req = Request.defaults({
  baseUrl: uri,
  json: true
});

