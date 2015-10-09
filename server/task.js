var EventEmitter = require('events').EventEmitter;
var _ = require('lodash');


exports.register = function (server, options, next) {


  var changes = server.app.changes;
  var couch = server.app.couch;
  var log = server.app.log;
  var task = server.app.task = new EventEmitter();


  task.error = function (dbName, taskDoc, err) {
    var db = couch.db(dbName);
    db.get(taskDoc.type + '/' + taskDoc.id, function (err, doc) {
      doc.$error = err;
      doc.updatedAt = new Date();
      db.put(doc, function (err) {
        if (err) { log.error(err); }
      });
    });
  };


  task.success = function (dbName, taskDoc) {
    var db = couch.db(dbName);
    db.get(taskDoc.type + '/' + taskDoc.id, function (err, doc) {
      doc._deleted = true;
      db.put(doc, function (err) {
        if (err) { log.error(err); }
      });
    });
  };


  changes.on('change', function (db, change) {
    var idParts = change.id.split('/');
    var type = idParts[0];
    var id = idParts[1];
    var doc = _.extend(_.omit(change.doc, [ '_id' ]), { id: id, type: type });

    if (!/^\$/.test(type) || type !== doc.type) { return; }

    type = type.slice(1);

    if (change.deleted) {
      task.emit('remove', db, doc);
      task.emit('remove:' + type, db, doc);
    } else if (/^1-/.test(doc._rev)) {
      task.emit('start', db, doc);
      task.emit('start:' + type, db, doc);
    } else {
      task.emit('update', db, doc);
      task.emit('update:' + type, db, doc);
    }
  });


  next();

};


exports.register.attributes = {
  name: 'task',
  version: '1.0.0'
};

