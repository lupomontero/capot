//
// Capot Account
//

'use strict';


//const EventEmitter = require('events').EventEmitter;
const Async = require('async');
const Moment = require('moment');
const Boom = require('boom');
const Joi = require('joi');
const Couch = require('../couch');
const Uid = require('../uid');


const internals = {};


internals.handleAccountDeletion = (server, userDoc) => {

  const settings = server.settings.app;
  const app = server.app;
  const couch = Couch(settings.couchdb);
  const appDb = couch.db('app');

  const done = (err) => {

    if (err) {
      server.log('warn', err);
    }
    app.account.emit('remove', userDoc);
  };

  appDb.get('db/' + userDoc._id, (err, dbDoc) => {

    if (err) {
      return done(err);
    }

    couch.del(encodeURIComponent(dbDoc.database), (err) => {

      if (err) {
        return done(err);
      }

      appDb.remove(dbDoc, (err) => {

        if (err) {
          return done(err);
        }

        done();
      });
    });
  });
};


exports.reset = {
  description: 'Send password reset link via email',
  tags: ['api'],
  validate: {
    params: {
      email: Joi.string().email().required()
    }
  },
  handler: (req, reply) => {

    const server = req.server;
    const settings = server.settings.app;
    const couch = Couch(settings.couchdb);
    const app = server.app;
    const usersDb = couch.db('_users');
    const sendMail = app.sendMail;
    const baseurl = req.payload.baseurl;
    const email = req.params.email;
    const docUrl = encodeURIComponent('org.couchdb.user:' + email);

    const sendResetLink = (userDoc) => {

      sendMail({
        to: userDoc.name,
        template: 'password-reset',
        context: {
          resetLink: baseurl + '/_users/' + email + '/_reset/' + userDoc.$reset.token
        }
      }, (mailerErr, mailerResp) => {

        userDoc.$reset.attempts.push({
          error: mailerErr,
          response: mailerResp
        });

        userDoc.$reset.updatedAt = new Date();

        usersDb.put(docUrl, userDoc, (err, data) => {

          if (mailerErr) {
            server.log('error', mailerErr);
            return reply(Boom.wrap(mailerErr.errors[0], 400));
          }
          else if (err) {
            return reply(err);
          }

          reply({ ok: true });
        });
      });
    };

    usersDb.get(docUrl, (err, userDoc) => {

      if (err) {
        return reply(Boom.notFound());
      }

      // Check if we already have a reset token...
      if (userDoc.$reset && userDoc.$reset.createdAt &&
          Moment(userDoc.$reset.createdAt).add(24, 'hours') >= Date.now()) {
        if (userDoc.$reset.attempts.length >= 3) {
          return reply(Boom.tooManyRequests(''));
        }
        return sendResetLink(userDoc);
      }

      userDoc.$reset = {
        createdAt: new Date(),
        email: userDoc.name,
        token: Uid(40),
        attempts: []
      };

      usersDb.put(docUrl, userDoc, (err, data) => {

        if (err) {
          return reply(err);
        }

        userDoc._rev = data.rev;
        sendResetLink(userDoc);
      });
    });
  }
};


exports.confirm = {
  description: 'Handle password reset link confirmation',
  tags: ['api'],
  validate: {
    params: {
      email: Joi.string().email().required(),
      token: Joi.string().required()
    }
  },
  handler: (req, reply) => {

    const server = req.server;
    const settings = server.settings.app;
    const couch = Couch(settings.couchdb);
    const app = server.app;
    const usersDb = couch.db('_users');
    const sendMail = app.sendMail;
    const token = req.params.token;

    Async.waterfall([
      // 1. Get user by reset token.
      (cb) => {

        usersDb.query('by_reset_token', { key: token }, (err, rows) => {

          if (err) {
            return cb(err);
          }

          const row = rows.shift();

          if (!row || !row.id) {
            return cb(Boom.notFound());
          }

          cb(null, row);
        });
      },
      // 2. Get user doc.
      (row, cb) => {

        usersDb.get(row.id, cb);
      },
      // 3. Generate pass and send email.
      (userDoc, resp, cb) => {

        // TODO: check that token is valid (hasnt expired, ...)
        userDoc.password = Uid(10);
        userDoc.$reset = null;

        sendMail({
          to: userDoc.name,
          template: 'password-new',
          context: { newPass: userDoc.password }
        }, (mailerErr, mailerResp) => {

          if (mailerErr) {
            server.log('warn', mailerErr);
          }
          if (mailerResp) {
            server.log('info', mailerResp);
          }

          cb(null, userDoc);
        });
      },
      // 4. Update user doc with new pass.
      (userDoc, cb) => {

        usersDb.put(encodeURIComponent(userDoc._id), userDoc, cb);
      }
    ], (err) => {

      if (err) {
        return reply(err);
      }
      reply({ ok: true });
    });
  }
};


exports.add = require('./add');


exports.all = {
  auth: 'admin',
  tags: ['api'],
  handler: (req, reply) => {

    const settings = req.server.settings.app;
    const couch = Couch(settings.couchdb);

    couch.db('_users').get('/_all_docs', {
      startkey: 'org.couchdb.user:',
      endkey: 'org.couchdb.user;'
    }, (err, data) => {

      if (err) {
        return reply(err);
      }

      reply(data.rows.map((row) => {

        return row.id.split(':').slice(1).join(':');
      }));
    });
  }
};


internals.proxyHandler = {
  proxy: {
    passThrough: true,
    mapUri: (req, cb) => {

      const couchUrl = req.server.settings.app.couchdb.url;
      const pathParts = req.url.path.split('/');
      pathParts[2] = 'org.couchdb.user:' + pathParts[2];
      cb(null, couchUrl + pathParts.join('/'), req.headers);
    }
  }
};


exports.get = {
  description: 'Get user document (by email).',
  tags: ['api'],
  //auth: 'user',
  validate: {
    params: {
      email: Joi.string().email().required()
    }
  },
  handler: internals.proxyHandler
};


exports.update = {
  description: 'Update user',
  tags: ['api'],
  //auth: 'user',
  validate: {
    params: {
      email: Joi.string().email().required()
    }
  },
  handler: internals.proxyHandler
};


exports.remove = {
  description: 'Delete user',
  tags: ['api'],
  //auth: 'user',
  handler: internals.proxyHandler
};


exports.register = (server, options, next) => {

  // const settings = server.settings.app;
  // const app = server.app;
  // const couch = Couch(settings.couchdb);
  // const account = app.account = new EventEmitter();
  // const usersDb = couch.db('_users');
  // const changes = usersDb.changes({ feed: 'continuous', include_docs: true });
  //
  // // Listen for change events so that we can take action on user creation and
  // // deletion.
  // changes.on('change', (change) => {
  //
  //   // We only care about user docs..
  //   if (!/^org\.couchdb\.user:/.test(change.id)) {
  //     return;
  //   }
  //
  //   const userDoc = change.doc;
  //
  //   if (change.deleted) {
  //     internals.handleAccountDeletion(server, userDoc);
  //   }
  //   else {
  //     account.emit('update', userDoc);
  //   }
  // });
  //
  // changes.on('error', (err) => {
  //
  //   console.error(err);
  // });
  //
  // changes.follow();

  next();
};


exports.register.attributes = {
  name: 'account',
  version: '1.0.0'
};
