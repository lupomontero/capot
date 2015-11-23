//
// Auth
//
// * registers couchdb auth scheme
// * registers "user" and "admin" auth strategies.
//

'use strict';


const Crypto = require('crypto');
const Boom = require('boom');
const Joi = require('joi');
const Request = require('request');
const Couch = require('./lib/couch');


const internals = {};


internals.proxyHandler = {
  proxy: {
    passThrough: true,
    mapUri: (req, cb) => {

      const couchUrl = req.server.settings.app.config.couchdb.url;
      cb(null, couchUrl + '/_session', req.headers);
    }
  }
};


internals.createSession = function (config, email, pass, cb) {

  Request.post(config.couchdb.url + '/_session', {
    json: true,
    body: { name: email, password: pass }
  }, (err, resp) => {

    if (err) {
      return cb(Boom.wrap(err));
    }
    else if (resp.statusCode !== 200) {
      return cb(Boom.create(resp.statusCode, resp.body.reason));
    }

    cb(null, resp.body, resp.headers['set-cookie']);
  });
};


//
// Check password against `derived_key2` and `salt2`. This is where the OAuth
// plugin back's up credentials when it needs to change them to allow login via
// OAuth.
//
internals.checkPass2 = function (config, email, pass, reply) {

  const couch = Couch(config.couchdb);
  const usersDb = couch.db('_users');
  const encodedDocId = encodeURIComponent('org.couchdb.user:' + email);

  usersDb.get(encodedDocId, (err, userDoc) => {

    // on error we reply with 401 to avoid disclosing whether username/email
    // is already registered.
    if (err) {
      return reply(Boom.create(401));
    }

    const key = userDoc.derived_key2;
    const salt = userDoc.salt2;
    const iterations = userDoc.iterations;

    // if we don't have `derived_key2` and `salt2` we can not check for
    // password automatically changed by OAuth login, so nothing else to do.
    if (!key || !salt) {
      return reply(Boom.create(401));
    }

    // TODO: installer should make sure password_scheme is set to pbkdf2.
    // check pass against derived_key2 and salt2...
    Crypto.pbkdf2(pass, salt, iterations, key.length, 'sha1', (err, hash) => {

      if (err) {
        return reply(Boom.wrap(err));
      }

      // If password doesn't match don't continue.
      if (key !== hash.toString('hex').slice(0, key.length)) {
        return reply(Boom.create(401));
      }

      // Now that we now this was the user's password before OAuth login
      // programmatically changed it we change the user's password back to
      // this and create a new CouchDB session.
      userDoc.password = pass;
      delete userDoc.derived_key2;
      delete userDoc.salt2;

      usersDb.put(encodedDocId, userDoc, (err) => {

        if (err) {
          return reply(Boom.create(500));
        }

        internals.createSession(config, email, pass, (err, body, cookie) => {

          if (err) { // `err` should already be a `Boom` object.
            return reply(err);
          }

          reply(body).header('set-cookie', cookie);
        });
      });
    });
  });
};


exports.get = {
  description: 'This endpoint is proxied directly to CouchDB\'s /_session.',
  handler: internals.proxyHandler
};


exports.remove = {
  description: 'This endpoint is proxied directly to CouchDB\'s /_session.',
  handler: internals.proxyHandler
};


//
// Create session route handler config.
//
exports.create = {
  description: 'Create session (cookie).',
  validate: {
    payload: {
      email: Joi.string().email().required(),
      password: Joi.string().required()
    }
  },
  handler: (req, reply) => {

    const server = req.server;
    const config = server.settings.app.config;
    const email = req.payload.email;
    const pass = req.payload.password;

    internals.createSession(config, email, pass, (err, body, cookie) => {

      if (err && err.output.statusCode !== 401) { // `err` is a `Boom` object.
        return reply(err);
      }
      else if (!err) {
        return reply(body).header('set-cookie', cookie);
      }

      internals.checkPass2(config, email, pass, reply);
    });
  }
};


exports.register = function (server, options, next) {

  const config = server.settings.app.config;
  const couch = Request.defaults({
    json: true,
    baseUrl: config.couchdb.url
  });

  const validateCookie = function (cookie, cb) {

    couch.get('/_session', {
      headers: { cookie: cookie }
    }, (err, resp) => {

      if (err) {
        cb(err);
      }
      else if (resp.statusCode !== 200) {
        cb(Boom.create(resp.statusCode));
      }
      else if (!resp.body.userCtx || !resp.body.userCtx.name) {
        cb(Boom.unauthorized());
      }
      else {
        cb(null, resp.body);
      }
    });
  };

  const cookieAuth = function (req, cb) {

    validateCookie(req.headers.cookie, cb);
  };


  const basicAuth = function (req, cb) {

    const auth = req.headers.authorization || '';
    const matches = /^Basic ([a-zA-Z0-9]+)$/.exec(auth);

    if (!matches || matches.length < 2) {
      return cb(Boom.unauthorized());
    }

    const buf = new Buffer(matches[1], 'base64');
    const parts = buf.toString().split(':');

    couch.post('/_session', {
      body: {
        name: parts[0],
        password: parts[1]
      }
    }, (err, resp) => {

      if (err) {
        return cb(err);
      }
      if (resp.statusCode !== 200) {
        return cb(Boom.create(resp.statusCode));
      }
      validateCookie(resp.headers['set-cookie'], cb);
    });
  };

  server.auth.scheme('couchdb', (s, schemeOptions) => {

    const validate = schemeOptions.validateFunc;

    return {
      authenticate: function (req, reply) {

        let authHandler;

        if (req.headers.authorization) {
          authHandler = basicAuth;
        }
        else if (req.headers.cookie) {
          authHandler = cookieAuth;
        }
        else {
          return reply(Boom.unauthorized());
        }

        authHandler(req, (err, credentials) => {

          if (err) {
            return reply(err);
          }

          if (typeof validate === 'function' && !validate(credentials)) {
            return reply(Boom.unauthorized());
          }

          reply.continue({ credentials: credentials });
        });
      }
    };
  });

  server.auth.strategy('user', 'couchdb', {
    validateFunc: function (credentials) {

      const userCtx = credentials.userCtx || {};
      return userCtx.name && userCtx.roles && userCtx.roles.length;
    }
  });

  server.auth.strategy('admin', 'couchdb', {
    validateFunc: function (credentials) {

      const roles = (credentials.userCtx || {}).roles || [];
      return roles.indexOf('_admin') >= 0;
    }
  });


  next();

};


exports.register.attributes = {
  name: 'auth',
  version: '1.0.0'
};

