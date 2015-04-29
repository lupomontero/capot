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
    var db = view.db = opt.app.couch.db('app');

    View.prototype.initialize.call(view, opt);

    db.get('config').then(function (configDoc) {
      view.model = configDoc;
      view.render();
    }, function (err) {
      console.error(err);
    });
  },

  events: {
    'submit #app-form': 'updateAppConfig',
    'submit #mailer-form': 'updateMailerConfig'
  },

  updateAppConfig: function (e) {
    e.preventDefault();
  
    return false;
  },

  updateMailerConfig: function (e) {
    e.preventDefault();
    var view = this;
    var db = view.db;

    var mailer = {
      from: view.$('#mailer-from').val(),
      service: view.$('#mailer-service').val(),
      user: view.$('#mailer-user').val(),
      pass: view.$('#mailer-pass').val()
    };

    db.get('config').then(function (configDoc) {
      configDoc.mailer = mailer;
      db.put(configDoc).then(function (data) {
        alert('Config updated!');
      }, function (err) {
        alert(err.reason || err.message);
      });
    }, function (err) {
      alert(err.reason || err.message);
    });

    return false;
  }

});

