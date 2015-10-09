//
// Auth
//
// * registers couchdb auth scheme
// * registers "user" and "admin" auth strategies.
//


var Crypto = require('crypto');
var Boom = require('boom');
var Joi = require('joi');
var Request = require('request');
var Couch = require('./lib/couch');

var internals = {};

internals.proxyHandler = {
  proxy: {
    passThrough: true,
    mapUri: function (req, cb) {

      var couchUrl = req.server.settings.app.config.couchdb.url;
      cb(null, couchUrl + '/_session', req.headers);
    }
  }
};


exports.get = {
  description: 'This endpoint is proxied directly to CouchDB\'s /_session.',
  handler: internals.proxyHandler
};


exports.remove = {
  description: 'This endpoint is proxied directly to CouchDB\'s /_session.',
  handler: internals.proxyHandler
};


exports.create = {
  description: 'Create session (cookie).',
  validate: {
    payload: {
      email: Joi.string().email().required(),
      password: Joi.string().required()
    }
  },
  handler: function (req, reply) {

    var server = req.server;
    var config = server.settings.app.config;
    var couch = Couch(config.couchdb);
    var usersDb = couch.db('_users');
    var email = req.payload.email;
    var pass = req.payload.password;

    Request.post(config.couchdb.url + '/_session', {
      json: true,
      body: { name: email, password: pass }
    }, function (err, resp) {

      if (err) { return reply(Boom.wrap(err)); }

      if (resp.statusCode === 200) {
        return reply(resp.body).header('set-cookie', resp.headers['set-cookie']);
      } else if (resp.statusCode !== 401) {
        return reply(Boom.create(resp.statusCode, resp.body.reason));
      }

      var encodedDocId = encodeURIComponent('org.couchdb.user:' + email);
      usersDb.get(encodedDocId, function (err, userDoc) {

        // on error we reply with 401 to avoid disclosing whether username/email
        // is already registered.
        if (err) { return reply(Boom.create(401)); }

        var key = userDoc.derived_key2;
        var salt = userDoc.salt2;
        var iterations = userDoc.iterations;

        // if we don't have `derived_key2` and `salt2` we can not check for
        // password automatically changed by OAuth login, so nothing else to do.
        if (!key || !salt) { return reply(Boom.create(401)); }

        // TODO: installer should make sure password_scheme is set to pbkdf2.
        // check pass against derived_key2 and salt2...
        Crypto.pbkdf2(pass, salt, iterations, key.length, 'sha1', function (err, hash) {

          if (err) { return reply(Boom.wrap(err)); }

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

          usersDb.put(encodedDocId, userDoc, function (err) {

            if (err) { return reply(Boom.create(500)); }

            Request.post(config.couchdb.url + '/_session', {
              json: true,
              body: { name: email, password: pass }
            }, function (err, resp) {

              if (err) { return reply(Boom.wrap(err)); }

              if (resp.statusCode !== 200) {
                return reply(Boom.create(resp.statusCode, resp.body.reason));
              }

              reply(resp.body).header('set-cookie', resp.headers['set-cookie']);
            });
          });
        });
      });
    });
  }
};


exports.register = function (server, options, next) {

  var config = server.settings.app.config;
  var couch = Request.defaults({
    json: true,
    baseUrl: config.couchdb.url
  });

  function validateCookie(cookie, cb) {
    
    couch.get('/_session', {
      headers: { cookie: cookie }
    }, function (err, resp) {

      if (err) {
        cb(err);
      } else if (resp.statusCode !== 200) {
        cb(Boom.create(resp.statusCode));
      } else if (!resp.body.userCtx || !resp.body.userCtx.name) {
        cb(Boom.unauthorized());
      } else {
        cb(null, resp.body);
      }
    });
  }

  function cookieAuth(req, cb) {

    validateCookie(req.headers.cookie, cb);
  }


  function basicAuth(req, cb) {

    var auth = req.headers.authorization || '';
    var matches = /^Basic ([a-zA-Z0-9]+)$/.exec(auth);

    if (!matches || matches.length < 2) {
      return cb(Boom.unauthorized());
    }

    var buf = new Buffer(matches[1], 'base64');
    var parts = buf.toString().split(':');

    couch.post('/_session', {
      body: {
        name: parts[0],
        password: parts[1]
      }
    }, function (err, resp) {

      if (err) { return cb(err); }
      if (resp.statusCode !== 200) {
        return cb(Boom.create(resp.statusCode));
      }
      validateCookie(resp.headers['set-cookie'], cb);
    });
  }

  server.auth.scheme('couchdb', function (server, options) {

    var validate = options.validateFunc;

    return {
      authenticate: function (req, reply) {

        var authHandler;

        if (req.headers.authorization) {
          authHandler = basicAuth;
        } else if (req.headers.cookie) {
          authHandler = cookieAuth;
        } else {
          return reply(Boom.unauthorized());
        }

        authHandler(req, function (err, credentials) {

          if (err) { return reply(err); }

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

      var userCtx = credentials.userCtx || {};
      return userCtx.name && userCtx.roles && userCtx.roles.length;
    }
  });

  server.auth.strategy('admin', 'couchdb', {
    validateFunc: function (credentials) {
      var roles = (credentials.userCtx || {}).roles || [];
      return roles.indexOf('_admin') >= 0;
    }
  });


  next();

};


exports.register.attributes = {
  name: 'auth',
  version: '1.0.0'
};

