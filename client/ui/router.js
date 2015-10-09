var _ = require('lodash');
var Backbone = require('backbone');
var AppView = require('./app-view');
var View = require('./view');


// TODO: move this somewhere else, duplicate in view.js
function getProp(obj, key) {
  if (!key) { return obj; }
  var parts = key.split('/');
  var curr = parts.shift();
  if (!obj || !obj.hasOwnProperty(curr)) { return null; }
  if (!_.isObject(obj[curr])) { return obj[curr]; }
  return getProp(obj[curr], parts.join('/'));
}


var optionKeys = [
  'routePrefix',
  'collections',
  'models',
  'views',
  'templates'
];


module.exports = Backbone.Router.extend({

  routePrefix: '',
  collections: {},
  models: {},
  views: {},
  templates: null,

  initialize: function (options) {
    var app = this;
    var capot = options.capot || require('../')(_.omit(options, optionKeys));
    var capotStart = capot.start.bind(capot);

    capot.log('debug', 'Dependencies: Lodash: ' + _.VERSION + ', Backbone ' +
      Backbone.VERSION + ', Handlebars: ' + Handlebars.VERSION);

    Backbone.Router.prototype.initialize.call(app, options);

    // Set known opts as instance props.
    optionKeys.forEach(function (optName) {
      if (typeof options[optName] === 'undefined') { return; }
      app[optName] = options[optName];
    });

    _.extend(app, capot, {
      view: new AppView({ model: app }),
      start: function () {
        capotStart(function (err) {
          if (err) { throw err; }
          Backbone.history.start({ pushState: true });
        });
      }
    });

    if (!app.routes) { app.routes = {}; }

    app.view.on('region:view', function (region) {
      $('html').attr('class', region.view.templateName);
    });
  },

  route: function (route, name, cb) {
    var prefix = this.routePrefix || '';
    if (arguments.length === 2) {
      cb = name;
      name = route;
    }
    this.routes[route] = cb;
    return Backbone.Router.prototype.route.call(this, prefix + route, name, cb);
  },

  navigate: function (fragment, options) {
    var prefix = this.routePrefix || '';
    return Backbone.Router.prototype.navigate.call(this, prefix + fragment, options);
  },

  addRegion: function (name, opt) {
    this.view.addRegion(name, opt);
  },

  setMainView: function (view) {
    var prev = (this.view.regions.main || {}).view;
    if (prev && prev.unsubscribeFromGlobalEvents) {
      prev.unsubscribeFromGlobalEvents();
    }
    this.view.setRegionView('main', view);
    view.subscribeToGlobalEvents();
  },

  showView: function (name, opt) {
    var View;

    if (_.isFunction(name) && name instanceof View) {
      View = name;
    } else if (_.isString(name)) {
      View = getProp(this.views, name);
      if (!View) {
        throw new Error('Unknown view: "' + name + '"');
      }
    }

    //if (_.isFunction(name) && name instanceof View) {
    var view = new View(_.extend({ app: this }, opt));
    this.setMainView(view);
    return view;
  },

  showTemplate: function (name) {
    var app = this;
    var TempView = View.extend({ templateName: name });
    var view = new TempView({ app: app });
    app.setMainView(view);
    view.render();
  },

  requireCondition: function (condition, redirectTo, fn) {
    var app = this;
    return function () {
      if (!condition()) {
        return app.navigate(redirectTo, { trigger: true });
      }
      fn.apply(this, Array.prototype.slice.call(arguments, 0));
    };
  },

  requireSignIn: function (redirectTo, fn) {
    var app = this;
    if (arguments.length === 1) {
      fn = redirectTo;
      redirectTo = 'signin';
    }
    return app.requireCondition(function () {
      return app.account.isSignedIn();
    }, redirectTo, fn);
  },

  requireSignOut: function (redirectTo, fn) {
    var app = this;
    if (arguments.length === 1) {
      fn = redirectTo;
      redirectTo = 'dashboard';
    }
    return app.requireCondition(function () {
      return app.account.isSignedIn() !== true;
    }, redirectTo, fn);
  },

  requireAdmin: function (redirectTo, fn) {
    var app = this;
    if (arguments.length === 1) {
      fn = redirectTo;
      redirectTo = 'signin';
    }
    return app.requireCondition(function () {
      return app.account.isAdmin();
    }, redirectTo, fn);
  },

  createView: function (name, options) {
    var Constructor = this.views[name];
    return new Constructor(_.extend({}, options, { app: this }));
  },

  createCollection: function (name, models, options) {
    var Constructor = this.collections[name];
    return new Constructor(models, _.extend({}, options, { app: this }));
  },

  createModel: function (name, attrs, options) {
    var Constructor = this.models[name];
    return new Constructor(attrs, _.extend({}, options, { app: this }));
  }

});

