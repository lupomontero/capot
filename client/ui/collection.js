/*eslint no-var:0, prefer-arrow-callback: 0 */
'use strict';


var Backbone = require('backbone');
var Model = require('./model');
var _ = require('lodash');


var internals = {};


internals.remoteSync = function (collection, model, type, options) {

  var app = collection.app;
  var account = app.account;
  var dbName = model.db || 'user/' + account.id();
  var dbUrl = '/_couch/' + encodeURIComponent(dbName);
  var key = type + (options.idStartsWith ? '/' + options.idStartsWith : '');
  var params = {
    include_docs: true,
    startkey: key + (options.descending ? '0' : '/'),
    endkey: key + (options.descending ? '/' : '0')
  };

  _.each(['limit', 'start', 'descending'], function (param) {

    if (options[param]) {
      params[param] = options[param];
    }
  });
  
  return app.request('GET', dbUrl + '/_all_docs', params).then(function (data) {

    return _.map(data.rows, function (row) {

      var doc = row.doc;
      var idParts = doc._id.split('/');
      doc.id = idParts.slice(1).join('/');
      delete doc._id;
      return doc;
    });
  });
};


internals.localSync = function (collection, model, type) {

  return collection.app.store.findAll(type);
};



module.exports = Backbone.Collection.extend({

  model: Model,

  initialize: function (models, options) {

    this.app = options.app;
    Backbone.Collection.prototype.initialize.call(this, models, options);
  },

  comparator: function (m) {

    return -1 * m.get('createdAt');
  },

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

    var success = options.success || function () {};
    var error = options.error || function () {};
    var model = new collection.model();
    var type = model.get('type');

    if (method !== 'read') {
      error(null, null, new Error('Sync method not supported'));
    }

    var fn = (model.remote || model.db) ? internals.remoteSync : internals.localSync;

    fn(collection, model, type, options).then(success, function (err) {

      error(null, null, err);
    });
  }

});

