var Backbone = require('backbone');
var Model = require('./model');
var noop = function () {};


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
    var type = (new collection.model()).get('type');
    var store = this.app.store;

    if (method === 'read') {
      store.findAll(type, options).then(function (data) {
        success(data);
      }, function (err) {
        error(null, null, err);
      });
    }
  }

});

