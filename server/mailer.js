var nodemailer = require('nodemailer');


module.exports = function (capot, cb) {

  var log = capot.log.child({ scope: 'capot.mailer' });
  var couch = capot.couch;
  var appDb = couch.db('app');

  log.info('Initialising mailer...');


  appDb.get('config').then(function (configDoc) {
    var mailerConf = configDoc.mailer || {};
    var service = mailerConf.service;

    if (!service) {
      log.info('No mailer service configured!');
      return cb();
    }

    log.info('Using service: ' + service);

    var transporter = nodemailer.createTransport({
      service: service,
      auth: {
        user: mailerConf.user,
        pass: mailerConf.pass
      }
    });

    capot.sendMail = function (msg, cb) {
      msg.from = mailerConf.from;
      return transporter.sendMail(msg, cb);
    };

    cb();
  }, cb);

};

