var _ = require('lodash');
var Backbone = require('backbone');
var moment = require('moment');
var noop = function () {};


function isISODateString(str) {
  var r = /\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)/;
  return typeof str === 'string' && r.test(str);
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
    var type = model.get('type');
    var store = (this.app || this.collection.app).store;

    switch (method) {
      case 'create':
        store.add(type, model.toJSON()).then(function (data) {
          success(data);
        }, function (err) {
          error(null, null, err);
        });
        break;
      case 'read':
        store.find(type, model.id, options).then(function (data) {
          success(data);
        }, function (err) {
          error(null, null, err);
        });
        break;
      case 'update':
        break;
      case 'delete':
        store.remove(type, model.id).then(function () {
          success();
        }, function (err) {
          error(null, null, err);
        });
        break;
      default:
        throw new Error('Unsupported model sync method');
    }
  }

});

