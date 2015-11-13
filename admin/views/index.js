/*eslint no-var:0, prefer-arrow-callback: 0 */
'use strict';


var View = require('../../client/ui/view');
var CapotPkg = require('../../package.json');


module.exports = View.extend({

  className: 'container',
  templateName: 'index',

  initialize: function (opt) {

    var self = this;
    var app = opt.app;

    View.prototype.initialize.call(self, opt);

    app.couch.get('/').then(function (info) {

      self.model = { capot: CapotPkg, couchdb: info };
      self.render();
    });
  }

});

