/*eslint no-var:0, prefer-arrow-callback: 0 */
'use strict';


var View = require('../../client/ui/view');


module.exports = View.extend({

  className: 'container',
  templateName: 'users',

  initialize: function (opt) {

    var self = this;
    View.prototype.initialize.call(self, opt);

    var app = self.app;
    var users = self.model = app.createCollection('users');

    users.once('sync', function () {

      self.render();
    });

    users.fetch();
  }

});

