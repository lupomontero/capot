var EventEmitter = require('events').EventEmitter;
var Promise = require('promise');
var PouchDB = require('pouchdb');
var Extend = require('extend');
var Omit = require('omit');
var Async = require('async');


var internals = {};


internals.noop = function () {};


internals.assertDocType = function (type) {

  if (typeof type !== 'string') {
    throw new Error('Model type must be a string');
  }
};


internals.parse = function (doc) {

  var idParts = doc._id.split('/');
  return Extend({
    id: idParts.slice(1).join('/'),
    type: idParts[0]
  }, Omit(doc, [ '_id' ]));
};


internals.toJSON = function (doc) {

  return Extend({ _id: doc.type + '/' + doc.id }, Omit(doc, [ 'id' ]));
};


module.exports = function (capot) {

  var settings = capot.settings;
  var account = capot.account;
  var store = new EventEmitter();


  function emitSyncEvent(eventName, data) {

    store.emit('sync', eventName, data);
    store.emit('sync:' + eventName, data);
  }


  //
  // Store API
  //


  //
  // Trigger bidirectional replication.
  //
  // TODO: DEBOUNCE SYNC!!!
  //
  store.sync = function (cb) {

    cb = cb || internals.noop;
    if (!store.remoteUrl) { return cb(); }
    if (capot.account.isOffline()) { return cb(); }

    store.remote.sync(store.local, {
      filter: function (doc) {

        return doc._id.indexOf('_design') !== 0 && doc.$replicate !== false;
      }
    })
      .on('error', emitSyncEvent.bind(null, 'error'))
      .on('denied', function (err) {

        console.error('sync denied', err);
      })
      .on('paused', emitSyncEvent.bind(null, 'paused'))
      .on('active', emitSyncEvent.bind(null, 'active'))
      .on('change', emitSyncEvent.bind(null, 'change'))
      .on('complete', function (data) {

        store.lastSync = data.push.end_time;
        if (data.pull.end_time > store.lastSync) {
          store.lastSync = data.pull.end_time;
        }

        emitSyncEvent('complete', data);
        cb();
      });
  };


  //
  // Find object by type and id.
  //
  store.find = function (type, id, options) {

    internals.assertDocType(type);
    options = options || {};
    return new Promise(function (resolve, reject) {

      store.local.get(type + '/' + id).then(function (doc) {

        var attrs = internals.parse(doc);
        if (!options.attachments || !doc._attachments) {
          return resolve(attrs);
        }
        store.getAttachments(doc).then(function (attachments) {

          attrs._attachments = attachments;
          resolve(attrs);
        });
      }, reject);
    });
  };


  //
  // Find all objects of a given type.
  //
  store.findAll = function (type, options) {

    internals.assertDocType(type);
    options = options || {};
    return new Promise(function (resolve, reject) {

      store.local.allDocs({
        include_docs: true,
        startkey: type + '/',
        endkey: type + '0'
      }).then(function (data) {

        var docs = data.rows.map(function (row) {

          return internals.parse(row.doc);
        });

        if (!options.attachments) { return resolve(docs); }

        Async.each(docs, function (attrs, cb) {

          store.getAttachments(attrs).then(function (attachments) {

            attrs._attachments = attachments;
            cb();
          }, cb);
        }, function (err) {

          if (err) { return reject(err); }
          resolve(docs);
        });
      }, reject);
    });
  };


  //
  // Add object to store.
  //
  store.add = function (type, attrs) {

    internals.assertDocType(type);

    var attachments = attrs._attachments || {};
    var attachmentsKeys = Object.keys(attachments);
    var binaryAttachments = {};
    var inlineAttachments = attachmentsKeys.reduce(function (memo, key) {

      var value = attachments[key];
      if (value instanceof File) {
        binaryAttachments[k] = value;
      } else {
        memo[k] = value;
      }
      return memo;
    }, {});

    var doc = Extend({}, Omit(attrs, [ '_attachments' ]), {
      _id: type + '/' + capot.uid(),
      createdAt: new Date(),
      type: type
    });

    if (Object.keys(inlineAttachments).length) {
      doc._attachments = inlineAttachments;
    }

    return new Promise(function (resolve, reject) {

      var db = store.local;

      db.put(doc).then(function (data) {

        doc._rev = data.rev;

        var binaryAttachmentsKeys = Object.keys(binaryAttachments);

        if (!binaryAttachmentsKeys.length) {
          return resolve(internals.parse(doc));
        }

        Async.eachSeries(binaryAttachmentsKeys, function (key, cb) {

          var docId = doc._id;
          var rev = doc._rev;
          var file = binaryAttachments[key];
          var type = file.type;
          db.putAttachment(docId, key, rev, file, type, function (err, data) {

            if (err) { return cb(err); }
            doc._rev = data.rev;
            cb();
          });
        }, function (err) {

          if (err) { return reject(err); }
          resolve(internals.parse(doc));
        });
      }, reject);
    });
  };


  //
  // Update object in store.
  //
  store.update = function (type, id, attrs) {

    internals.assertDocType(type);
    // ...
  };


  //
  // Remove object from store.
  //
  store.remove = function (type, id) {

    return store.find(type, id).then(function (doc) {

      return store.local.put({
        _deleted: true
      }, internals.toJSON(doc)._id, doc._rev);
    });
  };


  //
  // Remove all objects of given type from store.
  //
  store.removeAll = function (type) {

    return store.findAll(type).then(function (result) {

      var docs = result.map(function (obj) {
        var doc = internals.toJSON(obj);
        doc._deleted = true;
        return doc;
      });

      return store.local.bulkDocs(docs);
    });
  };


  store.attach = function (type, id, attachment, contentType) {

    //console.log(type, id, attachment, contentType);
    return;
  };


  store.getAttachments = function (doc) {

    var docId = internals.toJSON(doc)._id;
    var attachments = doc._attachments || {};
    var attachmentsKeys = Object.keys(attachments);

    return new Promise(function (resolve, reject) {

      if (!attachmentsKeys.length) { return resolve([]); }

      Async.each(attachmentsKeys, function (key, cb) {

        store.local.getAttachment(docId, key, function (err, data) {

          if (err) { return cb(err); }
          attachments[key].data = data;
          cb();
        });
      }, function (err) {

        if (err) { return reject(err); }
        resolve(attachments);
      });
    });
  };


  //
  // Initialise store.
  //
  store.init = function (cb) {

    capot.log('debug', 'capot.store init start');

    cb = cb || internals.noop;

    var capotId = account.id() || '__capot_anon';

    store.local = new PouchDB(capotId, { auto_compaction: true });

    function listenToLocalChanges() {

      var localChanges = store.local.changes({
        since: 'now',
        live: true,
        include_docs: true
      });

      localChanges.on('change', function (change) {

        var doc = internals.parse(change.doc);
        var type = doc.type;

        if (!type) { return; }

        function emit(eventName) {

          store.emit(eventName, doc, { local: true });
          store.emit(eventName + ':' + type, doc, { local: true });
        }

        if (change.deleted || doc._deleted) {
          emit('remove');
        } else if (/^1-/.test(doc._rev)) {
          emit('add');
        } else {
          emit('update');
        }

        emit('change');

        store.sync();
      });

      capot.log('debug', 'capot.store init ok');
      store.emit('init');
      cb();
    }

    if (account.isSignedIn() && !account.isAdmin()) {
      store.remoteUrl = window.location.origin + '/_couch/' +
        encodeURIComponent('user/' + capotId);
      store.remote = new PouchDB(store.remoteUrl);
      store.sync(listenToLocalChanges);
    } else {
      listenToLocalChanges();
    }
  };


  [ 'signin', 'signout' ].forEach(function (eventName) {

    account.on(eventName, store.init.bind(store));
  });


  function logEvent(eventName) {

    return function () {

      capot.log('debug', 'store:' + eventName, Array.prototype.slice.call(arguments, 0));
    };
  }

  if (capot.settings.debug === true) {
    [ 'init', 'add', 'update', 'remove', 'change', 'sync' ].forEach(function (eventName) {

      store.on(eventName, logEvent(eventName));
    });
  }


  return store;

};
