var View = require('../../client/ui/view');

module.exports = View.extend({

  className: 'container',
  templateName: 'header',

  initialize: function (opt) {
    var view = this;
    var account = opt.app.account;

    View.prototype.initialize.call(view, opt);

    function update() {
      view.model = account.session;
      view.render();
    }

    account.on('init', update);
    account.on('signin', update);
    account.on('signout', update);
    account.on('online', update);
    account.on('offline', update);
  },

  events: {
    'click [data-action="signout"]': 'signout'
  },

  signout: function (e) {
    var app = this.app;
    app.account.signOut().then(function () {
      window.location.href = '/';
    }, function () {
      console.error('signout:fail', arguments);
    });
  }

});

