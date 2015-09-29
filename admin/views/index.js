var _ = require('lodash');
var View = require('../../client/ui/view');
var CapotPkg = require('../../package.json');


module.exports = View.extend({

  className: 'container',
  templateName: 'index',

  initialize: function (opt) {

    var view = this;
    var app = opt.app;

    View.prototype.initialize.call(view, opt);

    app.couch.get('/').then(function (info) {

      view.model = { capot: CapotPkg, couchdb: info };
      view.render();
    });
  }

});

