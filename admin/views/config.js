var View = require('../../client/ui/view');
var Handlebars = window.Handlebars;


Handlebars.registerHelper('smtpServicePicker', function (selected) {
  var str = '<select name="smtp-service" id="smtp-service" class="form-control">';
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
    'submit #smtp-form': 'updateSmtp'
  },

  updateSmtp: function (e) {
    e.preventDefault();
    var view = this;
    var db = view.db;

    var smtp = {
      service: view.$('#smtp-service').val(),
      user: view.$('#smtp-user').val(),
      pass: view.$('#smtp-pass').val()
    };

    db.get('config').then(function (configDoc) {
      configDoc.smtp = smtp;
      db.put('config', configDoc).then(function (data) {
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

