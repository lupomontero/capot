'use strict';


const Events = require('events');
const Async = require('async');
const Couch = require('./lib/couch');


const internals = {};


internals.since = {};


internals.ignore = ['_replicator', 'changes'];


internals.ensureChangesDb = function (couch, cb) {

  couch.put('/changes', (err) => {

    if (err && err.statusCode === 412) { // already exists
      return cb();
    }
    else if (err) {
      return cb(err);
    }

    cb();
  });
};


internals.ensureChangesDbSecurity = function (changesDb, cb) {

  changesDb.addSecurity({
    admins: { roles: ['_admin'] },
    members: { roles: ['_admin'] }
  }, cb);
};


internals.init = function (changesDb, cb) {

  changesDb.get('/_all_docs', {
    startkey: 'since/',
    endkey: 'since0',
    include_docs: true
  }, (err, data) => {

    if (err) {
      return cb(err);
    }

    data.rows.forEach((row) => {

      const db = row.id.split('/').slice(1).join('/');
      internals.since[db] = row.doc.seq;
    });

    cb(null, internals.since);
  });
};


internals.updateSince = function (couch, dbName, seq, cb) {

  const changesDb = couch.db('changes');
  const sinceDoc = { _id: 'since/' + dbName, type: 'since', seq: seq };
  const encodedDocId = encodeURIComponent(sinceDoc._id);

  changesDb.get(encodedDocId, (err, data) => {

    if (err && err.statusCode !== 404) {
      return console.error(err);
    }
    else if (err) { // not found

    }
    else if (seq === data.seq) {
      return cb();
    }
    else {
      sinceDoc._rev = data._rev;
    }

    changesDb.put(encodedDocId, sinceDoc, cb);
  });
};


internals.getChanges = function (couch, feed, dbName, cb) {

  cb = cb || function () {};

  if (internals.ignore.indexOf(dbName) >= 0) {
    return cb();
  }

  const db = couch.db(dbName);
  const params = { since: internals.since[dbName] || 0, include_docs: true };

  db.changes(params, (err, data) => {

    if (err) {
      server.log('error', 'changes:error', err);
      return cb();
    }

    if (data.last_seq > params.since) {
      // Keep track of last seq for this db, so future requests only get
      // updates since this last sequence number.
      internals.since[dbName] = data.last_seq;
      data.results.forEach((result) => {

        feed.emit('change', dbName, result);
        feed.emit('change:' + dbName, result);

        if (result.doc.type) {
          feed.emit('change:' + dbName + ':' + result.doc.type, result);
        }
      });

      return internals.updateSince(couch, dbName, data.last_seq, cb);
    }

    cb();
  });
};


internals.checkPastChanges = function (couch, feed, cb) {

  couch.get('/_all_dbs', (err, dbs) => {

    if (err) {
      return cb(err);
    }

    Async.eachLimit(dbs, 2, Async.apply(internals.getChanges, couch, feed), cb);
  });
};


internals.listen = function (couch, feed) {

  const dbUpdates = couch.dbUpdates();

  dbUpdates.on('change', (update) => {

    if (!update || !update.db_name || !update.type) {
      return;
    }

    const db = update.db_name;
    const eventName = update.type;

    if (eventName === 'created') {
      feed.emit('add', db);
    }
    else if (eventName === 'deleted') {
      feed.emit('remove', db);
    }
    else if (eventName === 'updated') {
      internals.getChanges(couch, feed, db);
    }
  });

  dbUpdates.on('error', (err) => {

    console.error('dbUpdates error', err);
    feed.emit('error', err);
  });

  dbUpdates.follow();
};


exports.register = function (server, options, next) {

  const settings = server.settings.app;
  const couch = Couch(settings.couchdb);
  const changesDb = couch.db('changes');
  const feed = server.app.changes = new Events.EventEmitter();


  feed.start = function () {

    internals.checkPastChanges(couch, feed, (err) => {

      if (err) {
        return server.log('error', err);
      }
      internals.listen(couch, feed);
    });
  };


  Async.series([
    Async.apply(internals.ensureChangesDb, couch),
    Async.apply(internals.ensureChangesDbSecurity, changesDb),
    Async.apply(internals.init, changesDb)
  ], next);

};


exports.register.attributes = {
  name: 'changes',
  version: '1.0.0'
};

