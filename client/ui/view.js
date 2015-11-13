/*eslint no-var:0, prefer-arrow-callback: 0 */
'use strict';


var _ = require('lodash');
var Backbone = require('backbone');


//
// Require Handlebars helpers.
//
require('./helpers');


var internals = {};


// TODO: move this somewhere else, duplicate in router.js
internals.getProp = function (obj, key) {

  if (!key) {
    return obj;
  }

  var parts = key.split('/');
  var curr = parts.shift();

  if (!obj || !obj.hasOwnProperty(curr)) {
    return null;
  }

  if (!_.isObject(obj[curr])) {
    return obj[curr];
  }

  return internals.getProp(obj[curr], parts.join('/'));
};


module.exports = Backbone.View.extend({

  templateName: null,
  template: null,
  locals: {},

  initialize: function (opt) {

    Backbone.View.prototype.initialize.call(this, opt);
    this.app = opt.app;
    this.render = _.debounce(this.render, 100);
    this.locals = _.extend(this.locals, opt.locals || {});
  },

  render: function (ctx) {

    var templateName = this.templateName;
    var app = this.app;

    if (!templateName) {
      return;
    }

    var template = internals.getProp(app.templates, templateName);

    if (!_.isFunction(template)) {
      app.log('error', 'Template ' + templateName + ' not loaded!');
      return this;
    }

    // If no context was passed we use `this.model`.
    ctx = ctx || this.model || {};

    if (_.isFunction(ctx.toViewContext)) {
      ctx = ctx.toViewContext();
    }
    else if (ctx.attributes) {
      ctx = ctx.attributes;
    }
    else if (_.isArray(ctx)) {
      ctx = {
        models: _.map(ctx, function (i) {

          return (i.toViewContext) ? i.toViewContext() : i;
        })
      };
    }

    // Render actual handlebars template.
    this.$el.html($.trim(template(_.extend({}, this.locals, ctx))));
    this.trigger('render');

    return this;
  },

  back: function (e) {

    e.preventDefault();
    e.stopPropagation();
    window.history.back();
  },

  subscribeToGlobalEvents: function () {

    var self = this;

    // Pass cid to `self._getGlobalEventsHandlers()` as this is memoized and
    // should be recomputed for each view!
    _.each(self._getGlobalEventsHandlers(self.cid), function (ev) {

      ev.src.on(ev.name, ev.fn);
      console.log('View subscribing to global event ' + ev.name);
    });
  },

  unsubscribeFromGlobalEvents: function () {

    _.each(this._getGlobalEventsHandlers(this.cid), function (ev) {

      ev.src.removeListener(ev.name, ev.fn);
      console.log('View unsubscribing from global event ' + ev.name);
    });
  },

  _getGlobalEventsHandlers: _.memoize(function () {

    var self = this;

    return _.reduce(self.globalEvents, function (memo, v, k) {

      var parts = k.split(' ');
      var src = parts[0];
      var fn = self[v];
      var ev = { name: parts[1] };

      if (!_.isFunction(fn)) {
        return;
      }

      ev.fn = fn.bind(self);

      if (src === 'account') {
        ev.src = self.app.account;
        memo.push(ev);
      }
      else if (src === 'store') {
        ev.src = self.app.store;
        memo.push(ev);
      }
      else if (src === 'task') {
        ev.src = self.app.task;
        memo.push(ev);
      }

      return memo;
    }, []);
  })

});

