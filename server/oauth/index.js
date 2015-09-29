var Fs = require('fs');
var Path = require('path');
var Joi = require('joi');
var Boom = require('boom');
var HapiAuthCookie = require('hapi-auth-cookie');
var Async = require('async');
var Request = require('request');
var _ = require('lodash');
var Couch = require('../lib/couch');


var internals = {};


internals.random = function (len) {
  len = len || 32;
  return Math.random().toString(9).slice(2, len + 2);
};


internals.getAvailableProviders = function () {

  var dir = Path.join(__dirname, 'providers');

  return Fs.readdirSync(dir).reduce(function (memo, fname) {
    var parts = fname.split('.');
    var ext = parts.pop();
    var name = parts.join('.');

    if (name === 'index' || ext !== 'js') { return memo; }

    memo.push(name);
    return memo;
  }, []);
};


internals.getAppConfig = function (server, cb) {

  var config = server.settings.app.config;
  var couch = Couch(config.couchdb);

  var oauthDefaults = {
    cookie: {
      secret: internals.random(32)
    },
    providers: internals.getAvailableProviders().reduce(function (memo, name) {
      memo[name] = { enabled: false };
      return memo;
    }, {})
  };


  function update(doc) {
    couch.put('/app/config', doc, function (err) {
      if (err) { return cb(err); }
      cb(null, doc);
    });
  }

  couch.get('/app/config', function (err, doc) {

    if (err) { return cb(err); }

    if (!doc.oauth) {
      doc.oauth = oauthDefaults;
      return update(doc);
    }

    if (!doc.oauth.cookie || !doc.oauth.cookie.secret) {
      doc.oauth.cookie = oauthDefaults.cookie;
      return update(doc);
    }

    cb(null, doc);
  });
};


internals.getProviderApi = function (server, name, cb) {

  internals.getAppConfig(server, function (err, appConfig) {

    if (err) { return cb(err); }

    var providers = (appConfig.oauth || {}).providers || {};
    var options = providers[name];

    if (!options) {
      return cb(Boom.badRequest('Unsupported OAuth provider'));
    }

    options.baseurl = appConfig.app.url;

    cb(null, require('./providers/' + name)(options));
  });
};


internals.handleAuthorised = function (req, authData, cb) {

  var server = req.server;
  var config = server.settings.app.config;
  var couch = Couch(config.couchdb);
  var usersDb = couch.db('_users');
  var cookie = req.headers.cookie;

  // Validate cookie to see if user is signed in.
  Request.get(config.couchdb.url + '/_session', {
    headers: { cookie: cookie },
    json: true
  }, function (err, resp) {

    if (err) { return cb(err); }

    if (resp.statusCode !== 200) {
      return cb(Boom.create(resp.statusCode));
    }

    var authSession = resp.body || {};
    var isSignedIn = authSession.userCtx && authSession.userCtx.name;
    var name = authData.provider;
    var params = { key: [ name, authData.uid ] };

    usersDb.query('by_oauth', params, function (err, rows) {

      if (err) { return cb(err); }

      // social identity hasn't been claimed by anyone.
      if (!rows.length) {
        if (!isSignedIn) { // not logged in
          internals.signup(server, authData, cb);
        } else { // logged in
          internals.connect(server, authData, authSession, cb);
        }

      // if social identity has already been claimed.
      } else if (rows.length === 1) {
        if (!isSignedIn) { // not logged in
          internals.signin(server, authData, rows[0].value, cb);
        } else { // logged in
          internals.reconnect(server, authData, authSession, rows[0].value, cb);
        }

      // social identity has been claimed more than once?
      } else {
        cb(new Error('This should never happen'));
      }
    });
  });
};


internals.signup = function (server, authData, cb) {

  console.log('signup!');
};


internals.signin = function (server, authData, userDoc, cb) {

  var config = server.settings.app.config;
  var couch = Couch(config.couchdb);
  var usersDb = couch.db('_users');
  var tmpPass = internals.random(10);
  var userDocUrl = encodeURIComponent(userDoc._id);

  // Keep `derived_key` and `salt` as they were before temporarily changing the
  // password so that we can set it back to what it was.
  if (!userDoc.derived_key2 && !userDoc.salt2) {
    userDoc.derived_key2 = userDoc.derived_key;
    userDoc.salt2 = userDoc.salt;
  }

  // Temporarily set password to temporary random one so that we can
  // authenticate with the CouchDB server.
  userDoc.password = tmpPass;
  usersDb.put(userDocUrl, userDoc, function (err, data) {

    if (err) { return cb(err); }

    userDoc._rev = data.rev;

    // Authenticate using temporary password.
    couch.post('/_session', {
      name: userDoc.name,
      password: tmpPass
    }, function (err, data, resp) {

      if (err) { return cb(err); }

      authData.cookie = (resp.headers['set-cookie'] || [])[0];
      cb(null, authData);
    });
  });
};


internals.connect = function (server, authData, authSession, cb) {

  var config = server.settings.app.config;
  var couch = Couch(config.couchdb);
  var usersDb = couch.db('_users');
  var docId = encodeURIComponent('org.couchdb.user:' + authSession.userCtx.name);

  usersDb.get(docId, function (err, userDoc) {

    if (err) { return cb(err); }
    internals.saveAuth(server, authData, userDoc, cb);
  });
};


internals.reconnect = function (server, authData, authSession, userDoc, cb) {

  console.log('reconnect!');
};


internals.saveAuth = function (server, authData, userDoc, cb) {

  var config = server.settings.app.config;
  var couch = Couch(config.couchdb);
  var usersDb = couch.db('_users');
  var provider = authData.provider;

  // Check whether profile has already been connected?
  var oauth = (userDoc.oauth || []).reduce(function (memo, item) {
    if (item.provider !== provider || item.uid !== authData.uid) {
      memo.push(item);
    }
    return memo;
  }, []);

  oauth.push(_.extend({ provider: provider }, authData));
  userDoc.oauth = oauth;

  usersDb.put(userDoc._id, userDoc, function (err) {

    if (err) { return cb(err); }
    cb(null, authData);
  });
};


////////////////////////////////////////////////////////////////////////////////
//                               Public API                                   //
////////////////////////////////////////////////////////////////////////////////


//
// Route config for GET /_oauth/available_providers
//
exports.getAvailableProviders = {
  description: 'Get list of available OAuth providers (both enabled and not).',
  auth: 'admin',
  response: {
    schema: Joi.array()
  },
  handler: function (req, reply) {

    reply(internals.getAvailableProviders());
  }
};


//
// Route config for GET /_oauth/providers
//
exports.getProviders = {
  description: 'Get list of supported OAuth providers.',
  response: {
    schema: Joi.array()
  },
  handler: function (req, reply) {
  
    internals.getAppConfig(req.server, function (err, appConfig) {

      if (err) { return reply(err); }

      var providers = (appConfig.oauth || {}).providers || {};
      reply(Object.keys(providers).reduce(function (memo, name) {

        if (providers[name] && providers[name].enabled) {
          memo.push(name);
        }
        return memo;
      }, []));
    });
  }
};


//
// Route config for GET /_oauth/{provider}
//
exports.connect = {
  description: 'Connect to 3rd party account via OAuth',
  auth: { mode: 'try', strategy: 'oauth-session' },
  plugins: { 'hapi-auth-cookie': { redirectTo: false } },
  validate: {
    params: {
      provider: Joi.string().required()
    }
  },
  handler: function (req, reply) {

    var name = req.params.provider;
    var ret = {
      provider: name,
      redirectTo: req.query.redirectTo || '/'
    };

    internals.getProviderApi(req.server, name, function (err, providerApi) {

      if (err) { return reply(err); }

      providerApi.authenticate(req, function (err, authenticateUrl, data) {
      
        ret.error = err;
        ret.data = data;
        req.auth.session.set(ret);
        reply(err || {
          authenticateUrl: authenticateUrl,
          data: data
        });
      });
    });
  }
};


//
// Route config for GET /_oauth/callback/{provider}
//
exports.callback = {
  description: 'Handle callbacks from 3rd party OAuth providers.',
  auth: 'oauth-session',
  validate: {
    params: {
      provider: Joi.string().required()
    }
  },
  handler: function (req, reply) {

    var server = req.server;
    var name = req.params.provider;
    var redirectTo = req.auth.credentials.redirectTo || '/';
    var ret = { provider: name, createdAt: new Date() };

    function done(err, data) {

      if (err) { ret.error = err.message || err; }

      ret.data = _.omit(data, [ 'access_token' ]);
      req.auth.session.set(ret);
      reply.redirect(redirectTo);
    }

    internals.getProviderApi(server, name, function (err, providerApi) {

      if (err) { return reply(err); }

      providerApi.callback(req, function (err, authData) {

        if (err) { return done(err); }

        authData.provider = name;

        if (!authData.connected) {
          // User did not authorise app.
          return done(null, authData);
        }

        internals.handleAuthorised(req, authData, done);
      });
    });
  }
};


//
// Route config for GET /_oauth/session
//
exports.session = {
  description: 'Get OAuth cookie session.',
  auth: 'oauth-session',
  handler: function (req, reply) {

    var session = req.auth.credentials || {};
    var response = reply(session);

    if (session.data && session.data.cookie) {
      response.header('set-cookie', session.data.cookie);
    }

    req.auth.session.clear();

    return response;
  }
};


//
// Register as Hapi Plugin
//
exports.register = function (server, options, next) {

  var config = server.settings.app.config;
  var couch = Couch(config.couchdb);
  var usersDb = couch.db('_users');

  Async.auto({
    ddoc: function (cb) {
      usersDb.addIndex('by_oauth', {
        map: function (doc) {
          if (!doc.oauth || !doc.oauth.length) { return; }
          doc.oauth.forEach(function (item) {
            emit([ item.provider, item.uid ], doc);
          });
        }
      }, cb);
    },
    cookiePlugin: server.register.bind(server, HapiAuthCookie),
    appConfig: [ 'cookiePlugin', internals.getAppConfig.bind(null, server) ],
    foo: [ 'appConfig', function (cb, results) {

      server.auth.strategy('oauth-session', 'cookie', {
        password: results.appConfig.oauth.cookie.secret,
        cookie: server.settings.app.pkg.name + '-oauth',
        //redirectTo: '/login',
        isSecure: /^https:\/\//.test(results.appConfig.app.url)
      });

      cb();
    } ]
  }, next);
};


//
// Hapi Plugin Attributes
//
exports.register.attributes = {
  name: 'oauth',
  version: '1.0.0'
};

