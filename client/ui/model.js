var _ = require('lodash');
var Backbone = require('backbone');
var moment = require('moment');
var noop = function () {};


function isISODateString(str) {
  var r = /\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)/;
  return typeof str === 'string' && r.test(str);
}


function remoteSync(method, model) {
  var type = model.get('type');
  var app = this.app || this.collection.app;
  var db = app.couch.db('app');
  var json = model.toJSON();
  var doc = _.omit(json, [ 'id' ]);
  doc._id = json.type + '/' + json.id;

  if (method === 'create') {
    return db.put(doc).then(function (data) {
      json._rev = data.rev;
      return json;
    });
  } else if (method === 'read') {
    return db.get(doc._id).then(function (data) {
      data.id = data._id.split('/')[1];
      delete data._id;
      return data;
    });
  } else if (method === 'update') {
    return db.put(doc).then(function (data) {
      json._rev = data.rev;
      return json;
    });
  } else if (method === 'delete') {
    return db.remove(doc);
  } else {
    throw new Error('Unsupported model sync method');
  }
}


function localSync(method, model) {
  var type = model.get('type');
  var store = (this.app || this.collection.app).store;

  if (method === 'create') {
    return store.add(type, model.toJSON());
  } else if (method === 'read') {
    return store.find(type, model.id);
  } else if (method === 'update') {
    //...
  } else if (method === 'delete') {
    return store.remove(type, model.id);
  } else {
    throw new Error('Unsupported model sync method');
  }
}


module.exports = Backbone.Model.extend({

  initialize: function (attrs, options) {
    Backbone.Model.prototype.initialize.call(this, attrs, options);
    if (options && options.app) {
      this.app = options.app;
    } else {
      //console.log(this, options);
    }
  },

  toViewContext: function () { return _.extend({}, this.attributes); },

  parse: function (data) {
    return _.reduce(data, function (memo, v, k) {
      memo[k] = isISODateString(v) ? moment(v).toDate() : v;
      return memo;
    }, {});
  },

  toJSON: function () {
    return this.attributes;
  },

  sync: function (method, model, options) {
    var success = options.success || noop;
    var error = options.error || noop;

    var syncFn = (this.database) ? remoteSync : localSync;

    syncFn(method, model).then(success, function (err) {
      error(null, null, err);
    });
  }

});

