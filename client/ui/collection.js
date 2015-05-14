var Backbone = require('backbone');
var Model = require('./model');
var noop = function () {};


function remoteSync(collection, model, type) {
  return app.couch.db(model.database).allDocs({
    include_docs: true,
    startkey: type + '/',
    endkey: type + '0'
  }).then(function (data) {
    return _.pluck(data.rows, 'doc').map(function (doc) {
      var idParts = doc._id.split('/');
      doc.id = idParts[1];
      delete doc._id;
      return doc;
    });
  });
}


function localSync(collection, model, type) {
  return collection.app.store.findAll(type);
}



module.exports = Backbone.Collection.extend({

  model: Model,

  initialize: function (models, options) {
    this.app = options.app;
    Backbone.Collection.prototype.initialize.call(this, models, options);
  },

  comparator: function (m) { return -1 * m.get('createdAt'); },

  toViewContext: function () {
    return {
      models: this.map(function (model) {
        if (model.toViewContext) {
          return model.toViewContext();
        }
        return model;
      })
    };
  },

  sync: function (method, collection, options) {
    var success = options.success || noop;
    var error = options.error || noop;
    var model = new collection.model();
    var type = model.get('type');

    if (method !== 'read') {
      error(null, null, new Error('Sync method not supported'));
    }

    var syncFn = (model.database) ? remoteSync : localSync;

    syncFn(collection, model, type).then(success, function (err) {
      error(null, null, err);
    });
  }

});

