'use strict';


const Async = require('async');
const Nodemailer = require('nodemailer');
const Handlebars = require('handlebars');
const Couch = require('./lib/couch');


const internals = {};


internals.templateDocs = [
  {
    '_id': 'email/password-new',
    'description': 'This email is sent when a password is reset successfully.' +
      ' It includes the user\'s password.',
    'subject': 'New password',
    'text': 'Hi there,\n\nYour new password is: {{&newPass}}\n\nYou can now ' +
      'log in at {{appUrl}}\n\nThe {{appName}} team',
    'type': 'email'
  },
  {
    '_id': 'email/password-reset',
    'description': 'Password reset email including link reset link',
    'subject': 'Password reset',
    'text': 'Hi there,\n\nSomeone has requested the password for your ' +
      '{{appName}} account to be reset. If you made this request and wish to ' +
      'reset your password please follow the link below:\n\n{{resetLink}}\n\n' +
      'If your email client doesn\'t display the URL above as a link please ' +
      'copy the URL and paste it in your browser\'s address bar.\n\nIf you ' +
      'did not request this password reset please ignore this email.\n\nHave' +
      ' a lovely day,\n\nThe {{appName}} team',
    'type': 'email'
  },
  {
    '_id': 'email/signup',
    'description': 'The signup email.',
    'subject': 'Welcome to {{appName}}',
    'text': 'Hi there,\n\nLucky you! Your {{appName}} account has now been ' +
      'set up and is ready for you to enjoy.\n\nAll the best,\n\nThe ' +
      '{{appName}} team',
    'type': 'email'
  }
];


internals.createTransport = function createTransport(mailerConf) {

  if (!mailerConf.service) {
    return Nodemailer.createTransport();
  }

  return Nodemailer.createTransport({
    service: mailerConf.service,
    auth: {
      user: mailerConf.user,
      pass: mailerConf.pass
    }
  });
};


internals.render = function render(appDb, configDoc, msg, cb) {

  const ctx = msg.context || {};

  if (!ctx.appName) {
    ctx.appName = configDoc.app.name;
  }
  if (!ctx.appUrl) {
    ctx.appUrl = configDoc.app.url;
  }

  appDb.get('email/' + msg.template).then((templateDoc) => {

    msg.subject = Handlebars.compile(templateDoc.subject)(ctx);
    msg.text = Handlebars.compile(templateDoc.text)(ctx);
    cb(null, msg);
  }, cb);
};


internals.send = function send(server, configDoc, msg, cb) {

  const transporter = internals.createTransport(configDoc.mailer);

  msg.subject = '[' + configDoc.app.name + '] ' + msg.subject;
  msg.from = configDoc.mailer.from;

  transporter.sendMail(msg, (err, data) => {

    if (err) {
      server.log('error', err);
      return cb(err);
    }

    cb(null, data);
  });
};


exports.register = function (server, options, next) {

  const couch = Couch(server.settings.app.config.couchdb);
  const appDb = couch.db('app');

  server.log('info', 'Initialising mailer...');

  //
  // Public API
  //
  server.app.sendMail = function (msg, cb) {

    server.log('info', 'Sending ' + (msg.subject || msg.template) + ' to ' + msg.to);

    appDb.get('config', (err, configDoc) => {

      if (err) {
        return cb(err);
      }

      if (!msg.template) {
        return internals.send(server, configDoc, msg, cb);
      }

      internals.render(appDb, configDoc, msg, (err) => {

        if (err) {
          return cb(err);
        }
        internals.send(server, configDoc, msg, cb);
      });
    });
  };


  //
  // Load mailer configuration on startup so that we can log out mailer info.
  //
  appDb.get('config', (err, configDoc) => {

    if (err) {
      return next(err);
    }

    const mailerConf = configDoc.mailer || {};
    const service = mailerConf.service;

    if (!service) {
      server.log('warn', 'No mailer service configured. Mailer will use direct transport, very unreliable!');
    }
    else {
      server.log('info', 'Using service: ' + service + ' (' + mailerConf.user + ')');
    }

    Async.each(internals.templateDocs, (templateDoc, cb) => {

      const docUrl = encodeURIComponent(templateDoc._id);
      appDb.get(docUrl, (err) => {

        if (!err) {
          return cb();
        }
        appDb.put(docUrl, templateDoc, cb);
      });
    }, next);
  });

};


exports.register.attributes = {
  name: 'mailer',
  version: '1.0.0'
};

