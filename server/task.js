var events = require('events');
var _ = require('lodash');


module.exports = function (bonnet, cb) {


  var changes = bonnet.changes;
  var couch = bonnet.couch;
  var log = bonnet.log;
  var task = bonnet.task = new events.EventEmitter();


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


  bonnet.changes.on('change', function (db, data) {
    data.results.forEach(function (result) {
      var idParts = result.id.split('/');
      var type = idParts[0];
      var id = idParts[1];
      var doc = _.extend(_.omit(result.doc, [ '_id' ]), { id: id, type: type });

      if (!/^\$/.test(type) || type !== doc.type) { return; }

      type = type.slice(1);

      if (result.deleted) {
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
  });


  cb();

};

