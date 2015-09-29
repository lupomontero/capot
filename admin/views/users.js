var View = require('../../client/ui/view');


module.exports = View.extend({

  className: 'container',
  templateName: 'users',

  initialize: function (opt) {
    
    var view = this;
    View.prototype.initialize.call(view, opt);

    var app = view.app;
    var users = view.model = app.createCollection('users');

    users.once('sync', function () {

      view.render();
    });

    users.fetch();
  }

});

