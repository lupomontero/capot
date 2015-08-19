//
// Capot Account
//


var EventEmitter = require('events').EventEmitter;
var Async = require('async');
var Moment = require('moment');
var Boom = require('boom');
var Joi = require('joi');
var Request = require('request');
var _ = require('lodash');
var Couch = require('./lib/couch');
var Uid = require('../client/uid');


var internals = {};


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


internals.handleSignUp = function (app, userDoc) {

  var userDb = app.couch.db(userDoc.database);
  var usersDb = app.couch.db('_users');
  var appDb = app.couch.db('app');
  var log = app.log.child({ scope: 'account' });
  var uid = userDoc.uid;

  Async.series([
    function (cb) {

      var doc = internals.permissionsDdoc(uid);
      var docUrl = encodeURIComponent(doc._id);
      userDb.put(docUrl, doc, cb);
    },
    function (cb) {

      userDb.addSecurity(internals.securityDoc(uid), cb);
    },
    function (cb) {

      var doc = {
        _id: 'db/' + userDoc._id,
        type: 'db',
        database: userDoc.database,
        createdAt: new Date()
      };
      var docUrl = encodeURIComponent(doc._id);
      appDb.put(docUrl, doc, cb);
    },
    function (cb) {

      userDoc.roles = internals.roles(uid);
      //userDoc.createdAt = new Date();
      var docUrl = encodeURIComponent(userDoc._id);
      usersDb.put(docUrl, userDoc, function (err, data) {

        if (err) { return cb(err); }
        userDoc._rev = data.rev;
        cb();
      });
    }
  ], function (err) {

    if (err) { return log.error(err); }
    app.account.emit('add', userDoc);
  });
};


internals.handleAccountDeletion = function (app, userDoc) {

  var appDb = app.couch.db('app');
  var log = app.log.child({ scope: 'account' });

  appDb.get('db/' + userDoc._id, function (err, dbDoc) {

    if (err) { return log.error(err); }
    app.couch.del(encodeURIComponent(dbDoc.database), function (err) {

      if (err) { return log.error(err); }
      appDb.remove(dbDoc, function (err) {

        if (err) { return log.error(err); }
        app.account.emit('remove', userDoc);
      });
    });
  });
};


exports.reset = {
  handler: function (req, reply) {

    var usersDb = app.couch.db('_users');
    var sendMail = app.sendMail;
    var baseurl = req.payload.baseurl;
    var userDocId = 'org.couchdb.user:' + req.payload.email;
    var userDocUrl = '/_users/' + encodeURIComponent(userDocId);

    function sendResetLink(userDoc) {

      sendMail({
        to: userDoc.name,
        template: 'password-reset',
        context: { resetLink: baseurl + '/_reset/' + userDoc.$reset.token }
      }, function (mailerErr, mailerResp) {

        userDoc.$reset.attempts.push({
          error: mailerErr,
          response: mailerResp
        });
        userDoc.$reset.updatedAt = new Date();
        usersDb.put(userDoc, function (err, data) {

          if (err) { return reply(err); }
          reply(mailerErr || { ok: true });
        });
      });
    }

    usersDb.get(userDocId, function (err, userDoc) {

      if (err) { return reply(Boom.notFound()); }

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

      usersDb.put(userDoc, function (err, data) {

        if (err) { return reply(err); }
        userDoc._rev = data.rev;
        sendResetLink(userDoc);
      });
    });
  }
};


exports.confirm = {
  handler: function (req, reply) {

    var usersDb = app.couch.db('_users');
    var sendMail = app.sendMail;
    var token = req.params.token;

    usersDb.query('views/by_reset_token', { key: token }, function (err, data) {

      if (err) { return reply(err); }
      var row = data.rows.shift();
      if (!row || !row.id) { return reply(Boom.notFound()); }
      usersDb.get(row.id, function (err, userDoc) {

        if (err) { return reply(err); }
        // TODO: check that token is valid (hasnt expired, ...)
        userDoc.password = Uid(10);
        userDoc.$reset = null;

        sendMail({
          to: userDoc.name,
          template: 'password-new',
          context: { newPass: userDoc.password }
        }, function (mailerErr, mailerResp) {

          usersDb.put(userDoc, function (err, data) {

            reply(arguments);
          });
        });
      });
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

    var email = req.payload.email;
    var pass = req.payload.password;

    if (req.params.email !== email) {
      return reply(Boom.badRequest('Email mismatch'));
    }

    var uid = Uid();
    var config = req.server.settings.app.config;
    var userDocUrl = config.couchdb.url + '/_users/org.couchdb.user:' +
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
    }, function (err, resp) {

      if (err) { return cb(err); }
      if (resp.statusCode > 201) {
        return cb(Boom.create(resp.statusCode));
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

    var config = req.server.settings.app.config;
    var couch = Couch(config.couchdb);

    couch.db('_users').get('/_all_docs', {
      startkey: 'org.couchdb.user:',
      endkey: 'org.couchdb.user;'
    }, function (err, data) {

      if (err) { return reply(err); }
      reply(data.rows.map(function (row) {
        return row.id.split(':').slice(1).join(':');
      }));
    });
  }
};


exports.get = {
  auth: 'admin',
  handler: function (req, reply) {

    var config = req.server.settings.app.config;
    reply(config.couchdb);
  }
};


exports.update = {
  description: 'Update user',
  auth: 'user',
  handler: function (req, reply) {
  
    reply({ok:false});
  }
};


exports.remove = {
  description: 'Delete user',
  auth: 'user',
  handler: function (req, reply) {
  
    reply({ok:false});
  }
};


exports.register = function (server, options, next) {

  var config = server.settings.app.config;
  var apiPrefix = config.apiPrefix;
  var app = server.app;
  var couch = app.couch;
  var changes = app.changes;
  var log = app.log.child({ scope: 'account' });
  var account = app.account = new EventEmitter();
  var usersDb = couch.db('_users');

  // Listen for change events so that we can take action on user creation and
  // deletion.
  changes.on('change', function (db, change) {

    // We only care about user docs..
    if (db !== '_users' || !/^org\.couchdb\.user:/.test(change.id)) { return; }

    var userDoc = change.doc;

    if (change.deleted) {
      internals.handleAccountDeletion(app, userDoc);
    } else if (!userDoc.roles.length) {
      internals.handleSignUp(app, userDoc);
    } else {
      account.emit('update', userDoc);
    }
  });

  next();
};


exports.register.attributes = {
  name: 'account',
  version: '1.0.0'
};

