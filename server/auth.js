//
// Auth
//
// * registers couchdb auth scheme
// * registers "user" and "admin" auth strategies.
// * exposes CouchDB's `/_session` API on `{apiPrefix}/session`
//


var Boom = require('boom');
var Request = require('request');


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

