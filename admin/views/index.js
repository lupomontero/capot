var _ = require('lodash');
var async = require('async');
var View = require('../../client/ui/view');
var capotPkg = require('../../package.json');

module.exports = View.extend({

  className: 'container',
  templateName: 'index',

  initialize: function (opt) {
    var view = this;
    var app = opt.app;

    View.prototype.initialize.call(view, opt);

    app.couch.get('/').then(function (info) {
      view.model = { capot: capotPkg, couchdb: info };
      view.render();
    });
  }

});

