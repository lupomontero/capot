var path = require('path');
var async = require('async');
var nodemailer = require('nodemailer');
var Handlebars = require('handlebars');


module.exports = function (capot, cb) {

  var log = capot.log.child({ scope: 'capot.mailer' });
  var couch = capot.couch;
  var appDb = couch.db('app');

  log.info('Initialising mailer...');


  function getConfig() {
    return ;
  }


  function createTransport(mailerConf) {
    if (!mailerConf.service) {
      return nodemailer.createTransport();
    }
    return nodemailer.createTransport({
      service: mailerConf.service,
      auth: {
        user: mailerConf.user,
        pass: mailerConf.pass
      }
    });
  }


  function render(configDoc, msg, cb) {
    var ctx = msg.context || {};
    var appConfig = configDoc.app || {};
    if (!ctx.appName) { ctx.appName = configDoc.app.name; }
    if (!ctx.appUrl) { ctx.appUrl = configDoc.app.url; }
    appDb.get('email/' + msg.template).then(function (templateDoc) {
      msg.subject = Handlebars.compile(templateDoc.subject)(ctx);
      msg.text = Handlebars.compile(templateDoc.text)(ctx);
      cb(null, msg);
    }, cb);
  }


  function send(configDoc, msg, cb) {
    var transporter = createTransport(configDoc.mailer);

    msg.subject = '[' + configDoc.app.name + '] ' + msg.subject;
    msg.from = configDoc.mailer.from;

    transporter.sendMail(msg, function (err, data) {
      if (err) {
        log.error(err);
        return cb(err);
      }
      cb(null, data);
    });
  }


  capot.sendMail = function (msg, cb) {
    log.info('Sending ' + (msg.subject || msg.template) + ' to ' + msg.to);

    appDb.get('config').then(function (err, configDoc) {
      if (err) { return cb(err); }

      if (!msg.template) {
        return send(configDoc, msg, cb);
      }

      render(configDoc, msg, function (err) {
        if (err) { return cb(err); }
        send(configDoc, msg, cb);
      });
    }, cb);
  };


  //
  // Load mailer configuration on startup so that we can log out mailer info.
  //
  appDb.get('config').then(function (configDoc) {
    var mailerConf = configDoc.mailer || {};
    var service = mailerConf.service;

    if (!service) {
      log.warn('No mailer service configured. Mailer will use direct transport, very unreliable!');
    } else {
      log.info('Using service: ' + service + ' (' + mailerConf.user + ')');
    }

    async.each(templateDocs, function (templateDoc, cb) {
      appDb.get(templateDoc._id, function (err) {
        if (!err) { return cb(); }
        appDb.put(templateDoc, cb);
      });
    }, cb);
  }, cb);

};


var templateDocs = [
  {
    "_id": "email/password-new",
    "description": "This email is sent when a password is reset successfully. It includes the user's password.",
    "subject": "New password",
    "text": "Hi there,\n\nYour new password is: {{&newPass}}\n\nYou can now log in at {{appUrl}}\n\nThe {{appName}} team",
    "type": "email"
  },
  {
    "_id": "email/password-reset",
    "description": "Password reset email including link reset link",
    "subject": "Password reset",
    "text": "Hi there,\n\nSomeone has requested the password for your {{appName}} account to be reset. If you made this request and wish to reset your password please follow the link below:\n\n{{resetLink}}\n\nIf your email client doesn't display the URL above as a link please copy the URL and paste it in your browser's address bar.\n\nIf you did not request this password reset please ignore this email.\n\nHave a lovely day,\n\nThe {{appName}} team",
    "type": "email"
  },
  {
    "_id": "email/signup",
    "description": "The signup email.",
    "subject": "Welcome to {{appName}}",
    "text": "Hi there,\n\nLucky you! Your {{appName}} account has now been set up and is ready for you to enjoy.\n\nAll the best,\n\nThe {{appName}} team",
    "type": "email"
  }
];

