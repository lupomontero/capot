/*eslint no-var:0, prefer-arrow-callback: 0 */
'use strict';


var _ = require('lodash');
var Backbone = require('backbone');
var Moment = require('moment');


var internals = {};


internals.isISODateString = function (str) {

  var r = /\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)/;
  return typeof str === 'string' && r.test(str);
};


internals.remoteSync = function (method, model) {

  console.log('oh my god!');
  return;

  //var type = model.get('type');
  var app = this.app || this.collection.app;
  var db = app.couch.db('app');
  var json = model.toJSON();
  var doc = _.omit(json, ['id']);

  doc._id = json.type + '/' + json.id;

  if (method === 'create') {
    return db.put(doc).then(function (data) {

      json._rev = data.rev;
      return json;
    });
  }
  else if (method === 'read') {
    return db.get(doc._id).then(function (data) {

      data.id = data._id.split('/')[1];
      delete data._id;
      return data;
    });
  }
  else if (method === 'update') {
    return db.put(doc).then(function (data) {

      json._rev = data.rev;
      return json;
    });
  }
  else if (method === 'delete') {
    return db.remove(doc);
  }

  throw new Error('Unsupported model sync method');
};


internals.localSync = function (method, model) {

  var type = model.get('type');
  var store = (model.app || model.collection.app).store;

  if (method === 'create') {
    return store.add(type, model.toJSON());
  }
  else if (method === 'read') {
    return store.find(type, model.id);
  }
  else if (method === 'update') {
    //...
  }
  else if (method === 'delete') {
    return store.remove(type, model.id);
  }
  else {
    throw new Error('Unsupported model sync method');
  }
};


//
// Model
//
module.exports = Backbone.Model.extend({

  //
  // Whether or not to replicate between local and remote.
  //
  replicate: true,


  //
  // Set to true to store objects directly on remote.
  //
  remote: false,


  //
  // Initialise model. Called when constructing a new `Model` object.
  //
  initialize: function (attrs, options) {

    Backbone.Model.prototype.initialize.call(this, attrs, options);

    if (options && options.app) {
      this.app = options.app;
    }
  },


  //
  // Get model representation for use in views.
  //
  toViewContext: function () {

    return _.extend({}, this.attributes);
  },


  //
  // Parse CouchDB document into model attributes.
  //
  parse: function (data) {

    return _.reduce(data, function (memo, v, k) {

      if (k === '$replicate') {
        return memo;
      }
      memo[k] = internals.isISODateString(v) ? Moment(v).toDate() : v;
      return memo;
    }, {});
  },


  //
  // Get JSON representation of model for storage.
  //
  toJSON: function () {

    return _.extend({}, this.attributes, {
      $replicate: this.replicate !== false
    });
  },


  //
  // The `sync` method handles all interaction with the data layer (local
  // PouchDB via `capot.store` (local) or directly with CouchDB over HTTP
  // (remote).
  //
  sync: function (method, model, options) {

    var success = options.success || function () {};
    var error = options.error || function () {};
    var syncFn = (this.remote) ? internals.remoteSync : internals.localSync;

    syncFn(method, model).then(success, function (err) {

      error(null, null, err);
    });
  }

});

