var events = require('events');
var async = require('async');
var noop = function () {};


module.exports = function (capot, cb) {

  var log = capot.log.child({ scope: 'capot.changes' });
  var couch = capot.couch;
  var changesDb = couch.db('changes');
  var feed = capot.changes = new events.EventEmitter();
  var since = {};


  feed.start = function () {
    getAllChanges(listen);
  };


  function getAllChanges(cb) {
    couch.get('/_all_dbs', function (err, dbs) {
      if (err) { return log.error(err); }
      async.eachLimit(dbs, 10, getChanges, cb);
    });
  }


  function emitChange(db, data) {
    data.results.forEach(function (result) {
      feed.emit('change', db, result);
      feed.emit('change:' + db, result);
      if (result.doc.type) {
        feed.emit('change:' + db + ':' + result.doc.type, result);
      }
    });
  }

  function getChanges(db, cb) {
    cb = cb || noop;

    if (db === 'changes') { return cb(); }

    var params = { since: since[db] || 0, include_docs: true };

    couch.db(db).changes(params)
      .on('error', function (err) {
        log.error('changes:error', err);
        cb();
      })
      .on('complete', function (data) {
        //log.info('changes:complete', data);
        if (data.last_seq > params.since) {
          // Keep track of last seq for this db, so future requests only get
          // updates since this last sequence number.
          since[db] = data.last_seq;
          emitChange(db, data);
          return updateSince(db, data.last_seq, cb);
        }
        cb();
      });
  }


  function listen() {
    couch.get('/_db_updates', function (err, data) {
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


  function ensureChangesDbSecurity(cb) {
    changesDb.addSecurity({
      admins: { roles: [ '_admin' ] },
      members: { roles: [ '_admin' ] }
    }, cb);
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
        return log.error(err);
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
    ensureChangesDbSecurity,
    loadSince
  ], cb);

};

