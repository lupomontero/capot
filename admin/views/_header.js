/*eslint no-var:0, prefer-arrow-callback: 0 */
'use strict';


var View = require('../../client/ui/view');


module.exports = View.extend({

  className: 'container',
  templateName: 'header',

  initialize: function (opt) {

    var self = this;
    var app = opt.app;
    var account = app.account;

    View.prototype.initialize.call(self, opt);

    var update = function () {

      self.model = account.session;
      self.render();
    };

    account.on('init', update);
    account.on('signin', update);
    account.on('signout', update);
    account.on('online', update);
    account.on('offline', update);

    // Set active menu item...
    app.on('route', function (route) {

      self.$('#main-menu a').each(function () {

        var $a = $(this);
        var href = $a.attr('href');

        if (href.charAt(0) === '/') {
          href = href.slice(1);
        }

        if (href === route) {
          $a.parents('li').addClass('active');
        }
        else {
          $a.parents('li').removeClass('active');
        }
      });
    });
  },

  events: {
    'click [data-action="signout"]': 'signout'
  },

  signout: function () {

    var app = this.app;

    app.account.signOut().then(function () {

      window.location.href = '/';
    }, function () {

      console.error('signout:fail', arguments);
    });

    return false;
  }

});

