'use strict';


const Crypto = require('crypto');
const Async = require('async');
const Boom = require('boom');
const Joi = require('joi');
const Request = require('request');


const internals = {};


internals.id = (email) => 'org.couchdb.user:' + encodeURIComponent(email);


internals.create = (server, email, password, cb) => {

  Request({
    method: 'PUT',
    url: [
      server.settings.app.couchdb.url,
      '/_users/',
      internals.id(email)
    ].join(''),
    json: true,
    body: {
      name: email,
      password,
      roles: [],
      type: 'user'
    }
  }, (err, resp) => {

    if (err) {
      return cb(err);
    }

    if (resp.statusCode > 201) {
      return cb(Boom.create(resp.statusCode));
    }

    cb(null, { ok: resp.body.ok, email });
  });
};


internals.createDb = (server, email, results, cb) => {

  const attempt = (attempts) => {

    const uid = Crypto.randomBytes(4).toString('hex');
    const userDb = server.app.couch.db('user/' + uid);

    userDb.create((err, resp) => {

      if (!err) {
        return cb(null, uid);
      }

      if (err.statusCode !== 412) {
        return cb(Boom.create(err.statusCode, err.message));
      }

      if (attempts >= 3) {
        return cb(Boom.create(503, 'Could not create user db'));
      }

      attempt(attempts + 1);
    });
  };

  attempt(0);
};


internals.update = (server, email, results, cb) => {

  const usersDb = server.app.couch.db('_users');
  const docUrl = internals.id(email);

  usersDb.get(docUrl, (err, userDoc) => {

    if (err) {
      return cb(err);
    }

    userDoc.uid = results.uid;
    userDoc.database = 'user/' + results.uid;
    userDoc.roles = [
      results.uid,
      'capot:read:user/' + results.uid,
      'capot:write:user/' + results.uid
    ];

    usersDb.put(docUrl, userDoc, (err, resp) => cb(err, resp));
  });
};


internals.permissionsDdoc = (uid) => ({
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
});


internals.securityDoc = (uid) => ({
  admins: { names: [], roles: [] },
  members: {
    admins: [],
    roles: [
      'capot:read:user/' + uid,
      'capot:write:user/' + uid
    ]
  }
});


internals.initDb = (server, results, tail) => {

  const email = results.create.email;
  const uid = results.uid;
  const userDb = server.app.couch.db('user/' + uid);

  Async.series([
    // 1. Add permissions doc
    (cb) => {

      const doc = internals.permissionsDdoc(uid);
      userDb.put(encodeURIComponent(doc._id), doc, cb);
    },
    // 2. Add security doc
    (cb) => userDb.addSecurity(internals.securityDoc(uid), cb),
    // 3. Add reference in app db
    (cb) => {

      const id = 'db/' + internals.id(email);

      server.app.couch.db('app').put(encodeURIComponent(id), {
        _id: id,
        type: 'db',
        database: 'user/' + uid,
        createdAt: new Date()
      }, cb);
    }
  ], (err) => {

    if (err) {
      server.log('error', err);
    }

    tail();
  });
};


module.exports = {
  description: 'Create new user (Sign Up)',
  tags: ['api'],
  validate: {
    payload: {
      email: Joi.string().email().required(),
      password: Joi.string().required()
    }
  },
  response: {
    status: {
      200: Joi.object({
        ok: Joi.boolean().required(),
        email: Joi.string().email().required(),
        uid: Joi.string().required()
      }),
      400: Joi.object({
        statusCode: 400,
        error: 'Bad Request',
        message: Joi.string(),
        validation: Joi.object().optional()
      }),
      409: Joi.object({
        statusCode: 409,
        error: 'Conflict',
        message: Joi.string()
      })
    }
  },
  handler: (req, reply) => {

    const server = req.server;
    const { email, password } = req.payload;

    Async.auto({
      create: Async.apply(internals.create, server, email, password),
      uid: ['create', Async.apply(internals.createDb, server, email)],
      update: ['uid', Async.apply(internals.update, server, email)]
    }, (err, results) => {

      if (err) {
        return reply(err);
      }

      internals.initDb(server, results, req.tail('init user database'));

      reply({ ok: true, email, uid: results.uid });
    });
  }
};
