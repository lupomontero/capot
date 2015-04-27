var nodemailer = require('nodemailer');


module.exports = function (capot, cb) {

  var log = capot.log.child({ scope: 'capot.mailer' });
  var couch = capot.couch;
  var appDb = couch.db('app');

  log.info('Initialising mailer...');


  appDb.get('config').then(function (configDoc) {
    log.info('Using service: ' + configDoc.mailer.service);

    var transporter = nodemailer.createTransport({
      service: configDoc.mailer.service,
      auth: {
        user: configDoc.mailer.user,
        pass: configDoc.mailer.pass
      }
    });

    capot.sendMail = function (msg, cb) {
      msg.from = configDoc.mailer.from;
      return transporter.sendMail(msg, cb);
    };

    cb();
  }, cb);

};

