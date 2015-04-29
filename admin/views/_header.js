var View = require('../../client/ui/view');

module.exports = View.extend({

  className: 'container',
  templateName: 'header',

  initialize: function (opt) {
    var view = this;
    var app = opt.app;
    var account = app.account;

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

    // Set active menu item...
    app.on('route', function (route) {
      view.$('#main-menu a').each(function () {
        var $a = $(this);
        var href = $a.attr('href');
        if (href.charAt(0) === '/') { href = href.slice(1); }
        if (href === route) {
          $a.parents('li').addClass('active');
        } else {
          $a.parents('li').removeClass('active');
        }
      });
    });
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

