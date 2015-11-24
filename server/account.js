//
// Capot Account
//

'use strict';


const EventEmitter = require('events').EventEmitter;
const Async = require('async');
const Moment = require('moment');
const Boom = require('boom');
const Joi = require('joi');
const Request = require('request');
const Couch = require('./lib/couch');
const Uid = require('../client/uid');


const internals = {};


internals.permissionsDdoc = function (uid) {

  return {
    _id: '_design/permissions',
    language: 'javascript',
    validate_doc_update: [
      'function (newDoc, oldDoc, userCtx) {',
      '  for (var i = 0; i < userCtx.roles.length; i++) {',
      '    var r = userCtx.roles[i];',
      '    if (r === "capot:write:user/' + uid + '" || r === "_admin") {',
      '      return;',
      '    }',
      '  }',
      '  throw {unauthorized: "You are not authorized to write to this database"};',
      '}'
    ].join('\n')
  };
};


internals.securityDoc = function (uid) {

  return {
    admins: { names: [], roles: [] },
    members: {
      admins: [],
      roles: [
        'capot:read:user/' + uid,
        'capot:write:user/' + uid
      ]
    }
  };
};


internals.roles = function (uid) {

  return [
    uid,
    'confirmed',
    'capot:read:user/' + uid,
    'capot:write:user/' + uid
  ];
};


internals.handleSignUp = function (server, userDoc) {

  const config = server.settings.app.config;
  const app = server.app;
  const couch = Couch(config.couchdb);
  const userDb = couch.db(userDoc.database);
  const usersDb = couch.db('_users');
  const appDb = couch.db('app');
  const uid = userDoc.uid;

  Async.series([
    function (cb) {

      userDb.createIfNotExists(cb);
    },
    function (cb) {

      const doc = internals.permissionsDdoc(uid);
      const docUrl = encodeURIComponent(doc._id);
      userDb.put(docUrl, doc, cb);
    },
    function (cb) {

      userDb.addSecurity(internals.securityDoc(uid), cb);
    },
    function (cb) {

      const doc = {
        _id: 'db/' + userDoc._id,
        type: 'db',
        database: userDoc.database,
        createdAt: new Date()
      };
      const docUrl = encodeURIComponent(doc._id);
      appDb.put(docUrl, doc, cb);
    },
    function (cb) {

      userDoc.roles = internals.roles(uid);
      //userDoc.createdAt = new Date();
      const docUrl = encodeURIComponent(userDoc._id);
      usersDb.put(docUrl, userDoc, (err, data) => {

        if (err) {
          return cb(err);
        }
        userDoc._rev = data.rev;
        cb();
      });
    }
  ], (err) => {

    if (err) {
      return server.log('error', err);
    }
    app.account.emit('add', userDoc);
  });
};


internals.handleAccountDeletion = function (server, userDoc) {

  const config = server.settings.app.config;
  const app = server.app;
  const couch = Couch(config.couchdb);
  const appDb = couch.db('app');

  const done = function (err) {

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
  validate: {
    params: {
      email: Joi.string().email().required()
    }
  },
  handler: function (req, reply) {

    const server = req.server;
    const config = server.settings.app.config;
    const couch = Couch(config.couchdb);
    const app = server.app;
    const usersDb = couch.db('_users');
    const sendMail = app.sendMail;
    const baseurl = req.payload.baseurl;
    const email = req.params.email;
    const docUrl = encodeURIComponent('org.couchdb.user:' + email);

    const sendResetLink = function (userDoc) {

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
            return reply(mailerErr);
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
  validate: {
    params: {
      email: Joi.string().email().required(),
      token: Joi.string().required()
    }
  },
  handler: function (req, reply) {

    const server = req.server;
    const config = server.settings.app.config;
    const couch = Couch(config.couchdb);
    const app = server.app;
    const usersDb = couch.db('_users');
    const sendMail = app.sendMail;
    const token = req.params.token;

    Async.waterfall([
      // 1. Get user by reset token.
      function (cb) {

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
      function (row, cb) {

        usersDb.get(row.id, cb);
      },
      // 3. Generate pass and send email.
      function (userDoc, resp, cb) {

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
      function (userDoc, cb) {

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


exports.add = {
  description: 'Create new user (Sign Up)',
  validate: {
    payload: {
      email: Joi.string().email().required(),
      password: Joi.string().required()
    }
  },
  response: {
    schema: Joi.object({
      ok: Joi.boolean().required(),
      email: Joi.string().email().required(),
      uid: Joi.string().required()
    })
  },
  handler: function (req, reply) {

    const email = req.payload.email;
    const pass = req.payload.password;
    const uid = Uid();
    const config = req.server.settings.app.config;
    const userDocUrl = config.couchdb.url + '/_users/org.couchdb.user:' +
      encodeURIComponent(email);

    Request({
      method: 'PUT',
      url: userDocUrl,
      json: true,
      body: {
        name: email,
        password: pass,
        roles: [],
        type: 'user',
        uid: uid,
        database: 'user/' + uid
      }
    }, (err, resp) => {

      if (err) {
        return reply(err);
      }

      if (resp.statusCode > 201) {
        return reply(Boom.create(resp.statusCode));
      }

      reply({
        ok: resp.body.ok,
        email: email,
        uid: uid
      });
    });
  }
};


exports.all = {
  auth: 'admin',
  handler: function (req, reply) {

    const config = req.server.settings.app.config;
    const couch = Couch(config.couchdb);

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
    mapUri: function (req, cb) {

      const couchUrl = req.server.settings.app.config.couchdb.url;
      const pathParts = req.url.path.split('/');
      pathParts[2] = 'org.couchdb.user:' + pathParts[2];
      cb(null, couchUrl + pathParts.join('/'), req.headers);
    }
  }
};


exports.get = {
  description: 'Get user document (by email).',
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
  //auth: 'user',
  handler: internals.proxyHandler
};


exports.register = function (server, options, next) {

  const config = server.settings.app.config;
  const app = server.app;
  const couch = Couch(config.couchdb);
  const account = app.account = new EventEmitter();
  const usersDb = couch.db('_users');
  const changes = usersDb.changes({ feed: 'continuous', include_docs: true });

  // Listen for change events so that we can take action on user creation and
  // deletion.
  changes.on('change', (change) => {

    // We only care about user docs..
    if (!/^org\.couchdb\.user:/.test(change.id)) {
      return;
    }

    const userDoc = change.doc;

    if (change.deleted) {
      internals.handleAccountDeletion(server, userDoc);
    }
    else if (!userDoc.roles.length) {
      internals.handleSignUp(server, userDoc);
    }
    else {
      account.emit('update', userDoc);
    }
  });

  changes.on('error', (err) => {

    console.error(err);
  });

  changes.follow();

  next();
};


exports.register.attributes = {
  name: 'account',
  version: '1.0.0'
};

