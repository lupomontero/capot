var events = require('events');
var async = require('async');
var noop = function () {};


module.exports = function (bonnet, cb) {

  var couch = bonnet.couch;
  var changesDb = couch.db('changes');
  var feed = bonnet.changes = new events.EventEmitter();
  var since = {};
  var legacyDbUpdates = false;


  feed.start = function () {
    getAllChanges(listen);
  };


  function getAllChanges(cb) {
    couch.get('/_all_dbs', function (err, dbs) {
      if (err) { return console.error(err); }
      async.eachLimit(dbs, 10, getChanges, cb);
    });
  }


  function getChanges(db, cb) {
    cb = cb || noop;

    if (db === 'changes') { return cb(); }

    var params = { since: since[db] || 0, include_docs: true };

    couch.db(db).changes(params)
      .on('error', function (err) {
        console.error('changes:error', err);
        //err.db = db;
        //feed.emit('error', err);
        cb();
      })
      .on('complete', function (data) {
        //console.log('changes:complete', data);
        if (data.last_seq > params.since) {
          // Keep track of last seq for this db, so future requests only get
          // updates since this last sequence number.
          since[db] = data.last_seq;
          feed.emit('change', db, data);
          feed.emit('change:' + db, data);
          return updateSince(db, data.last_seq, cb);
        }
        cb();
      });
  }


  function listen() {
    // PouchDB and old CouchDB dont support /_db_updates.
    if (legacyDbUpdates) {
      return getAllChanges(function () {
        setTimeout(listen, 10 * 1000);
      });
    }

    couch.get('/_db_updates', function (err, data) {
      if (err && err.statusCode === 400) {
        legacyDbUpdates = true;
        setTimeout(listen, 10 * 1000);
        return;
      } else if (err) {
        console.error(err);
      }

      // Immediately listen for more changes.
      listen();

      if (err) { return feed.emit('error', err); }
      if (!data || !data.db_name || !data.type) { return; }

      var db = data.db_name;
      var eventName = data.type;

      if (eventName === 'created') {
        feed.emit('add', db);
      } else if (eventName === 'deleted') {
        feed.emit('remove', db);
      } else if (eventName === 'updated') {
        getChanges(db);
      }
    });
  }


  function ensureChangesDb(cb) {
    couch.get('/changes', function (err) {
      if (err && err.statusCode !== 404) {
        cb(err);
      } else if (err) { // Not found
        couch.put('/changes', cb);
      } else {
        cb();
      }
    });
  }


  function loadSince(cb) {
    changesDb.allDocs({
      startkey: 'since/',
      endkey: 'since0',
      include_docs: true
    }, function (err, data) {
      if (err) { return cb(err); }
      data.rows.forEach(function (row) {
        var db = row.id.split('/').slice(1).join('/');
        since[db] = row.doc.seq;
      });
      cb();
    });
  }


  function updateSince(db, seq, cb) {
    var sinceDoc = { _id: 'since/' + db, type: 'since', seq: seq };
    changesDb.get(sinceDoc._id, function (err, data) {
      if (err && err.status !== 404) {
        return console.error(err);
      } else if (err) { // not found

      } else if (seq === data.seq) {
        return cb();
      } else {
        sinceDoc._rev = data._rev;
      }

      changesDb.put(sinceDoc, cb);
    });
  }

  async.series([
    ensureChangesDb,
    loadSince
  ], cb);

};

