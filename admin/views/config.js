var _ = require('lodash');
var View = require('../../client/ui/view');
var Handlebars = window.Handlebars;


Handlebars.registerHelper('mailerServicePicker', function (selected) {

  var str = '<select name="mailer-service" id="mailer-service" class="form-control">';

  [ 'Gmail', 'Mailgun', 'Mandrill', 'Postmark', 'SendGrid' ].forEach(function (service) {
    str += '<option name="' + service + '"';
    if (service === selected) {
      str += ' selected';
    }
    str += '>' + service + '</option>';
  });

  str += '</select>';

  return new Handlebars.SafeString(str);
});


module.exports = View.extend({

  className: 'container',
  templateName: 'config',

  initialize: function (opt) {

    var view = this;
    View.prototype.initialize.call(view, opt);

    var app = view.app;
    var config = view.model = app.createModel('config');

    config.once('sync', function () {

      view.render();
    });

    config.fetch();
  },

  events: {
    'submit #app-form': 'save',
    'submit #mailer-form': 'save',
    'submit #oauth-form': 'save'
  },

  save: function (e) {

    e.preventDefault();

    var view = this;
    var config = view.model; 

    var app = {
      name: view.$('#app-name').val(),
      url: view.$('#app-url').val()
    };

    var mailer = {
      from: view.$('#mailer-from').val(),
      service: view.$('#mailer-service').val(),
      user: view.$('#mailer-user').val(),
      pass: view.$('#mailer-pass').val()
    };

    var oauth = config.get('oauth');

    oauth.providers = Object.keys(oauth.providers).reduce(function (memo, key) {

      memo[key] = {
        enabled: $('#' + key + '-enabled').is(':checked'),
        key: $('#' + key + '-key').val(),
        secret: $('#' + key + '-secret').val(),
        scopes: $('#' + key + '-scopes').val().split(',').map(function (scope) {

          return _.trim(scope.toLowerCase());
        })
      };
      return memo;
    }, {});

    config.save({
      app: app,
      mailer: mailer,
      oauth: oauth
    }, {
      error: function (err) {

        alert(err.reason || err.message);
      },
      success: function () {

        alert('Config updated!');
      }
    });

    return false;
  }

});

