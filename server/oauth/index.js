'use strict';


const Fs = require('fs');
const Path = require('path');
const Joi = require('joi');
const Boom = require('boom');
const HapiAuthCookie = require('hapi-auth-cookie');
const Async = require('async');
const Request = require('request');
const _ = require('lodash');
const Couch = require('../lib/couch');


const internals = {};


internals.random = function (len) {

  len = len || 32;
  return Math.random().toString(9).slice(2, len + 2);
};


internals.getAvailableProviders = function () {

  const dir = Path.join(__dirname, 'providers');

  return Fs.readdirSync(dir).reduce((memo, fname) => {

    const parts = fname.split('.');
    const ext = parts.pop();
    const name = parts.join('.');

    if (name === 'index' || ext !== 'js') {
      return memo;
    }

    memo.push(name);
    return memo;
  }, []);
};


internals.getAppConfig = function (server, cb) {

  const settings = server.settings.app;
  const couch = Couch(settings.couchdb);

  const oauthDefaults = {
    cookie: {
      secret: internals.random(32)
    },
    providers: internals.getAvailableProviders().reduce((memo, name) => {

      memo[name] = { enabled: false };
      return memo;
    }, {})
  };


  const update = function (doc) {

    couch.put('/app/config', doc, (err) => {

      if (err) {
        return cb(err);
      }

      cb(null, doc);
    });
  };


  couch.get('/app/config', (err, doc) => {

    if (err) {
      return cb(err);
    }

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

  internals.getAppConfig(server, (err, appConfig) => {

    if (err) {
      return cb(err);
    }

    const providers = (appConfig.oauth || {}).providers || {};
    const options = providers[name];

    if (!options) {
      return cb(Boom.badRequest('Unsupported OAuth provider'));
    }

    options.baseurl = appConfig.app.url;

    cb(null, require('./providers/' + name)(options));
  });
};


internals.handleAuthorised = function (req, authData, cb) {

  const server = req.server;
  const settings = server.settings.app;
  const couch = Couch(settings.couchdb);
  const usersDb = couch.db('_users');
  const cookie = req.headers.cookie;

  // Validate cookie to see if user is signed in.
  Request.get(settings.couchdb.url + '/_session', {
    headers: { cookie: cookie },
    json: true
  }, (err, resp) => {

    if (err) {
      return cb(err);
    }

    if (resp.statusCode !== 200) {
      return cb(Boom.create(resp.statusCode));
    }

    const authSession = resp.body || {};
    const isSignedIn = authSession.userCtx && authSession.userCtx.name;
    const name = authData.provider;
    const params = { key: [name, authData.uid] };

    usersDb.query('by_oauth', params, (err, rows) => {

      if (err) {
        return cb(err);
      }

      // social identity hasn't been claimed by anyone.
      if (!rows.length) {
        if (!isSignedIn) { // not logged in
          internals.signup(server, authData, cb);
        }
        else { // logged in
          internals.connect(server, authData, authSession, cb);
        }
      }
      // if social identity has already been claimed.
      else if (rows.length === 1) {
        if (!isSignedIn) { // not logged in
          internals.signin(server, authData, rows[0].value, cb);
        }
        else { // logged in
          internals.reconnect(server, authData, authSession, rows[0].value, cb);
        }

      }
      // social identity has been claimed more than once?
      else {
        cb(new Error('This should never happen'));
      }
    });
  });
};


internals.signup = function (server, authData, cb) {

  console.log('signup!');
};


internals.signin = function (server, authData, userDoc, cb) {

  const settings = server.settings.app;
  const couch = Couch(settings.couchdb);
  const usersDb = couch.db('_users');
  const tmpPass = internals.random(10);
  const userDocUrl = encodeURIComponent(userDoc._id);

  // Keep `derived_key` and `salt` as they were before temporarily changing the
  // password so that we can set it back to what it was.
  if (!userDoc.derived_key2 && !userDoc.salt2) {
    userDoc.derived_key2 = userDoc.derived_key;
    userDoc.salt2 = userDoc.salt;
  }

  // Temporarily set password to temporary random one so that we can
  // authenticate with the CouchDB server.
  userDoc.password = tmpPass;
  usersDb.put(userDocUrl, userDoc, (err, data) => {

    if (err) {
      return cb(err);
    }

    userDoc._rev = data.rev;

    // Authenticate using temporary password.
    couch.post('/_session', {
      name: userDoc.name,
      password: tmpPass
    }, (err, body, resp) => {

      if (err) {
        return cb(err);
      }

      authData.cookie = (resp.headers['set-cookie'] || [])[0];
      cb(null, authData);
    });
  });
};


internals.connect = function (server, authData, authSession, cb) {

  const settings = server.settings.app;
  const couch = Couch(settings.couchdb);
  const usersDb = couch.db('_users');
  const docId = encodeURIComponent('org.couchdb.user:' + authSession.userCtx.name);

  usersDb.get(docId, (err, userDoc) => {

    if (err) {
      return cb(err);
    }
    internals.saveAuth(server, authData, userDoc, cb);
  });
};


internals.reconnect = function (server, authData, authSession, userDoc, cb) {

  console.log('reconnect!');
};


internals.saveAuth = function (server, authData, userDoc, cb) {

  const settings = server.settings.app;
  const couch = Couch(settings.couchdb);
  const usersDb = couch.db('_users');
  const provider = authData.provider;

  // Check whether profile has already been connected?
  const oauth = (userDoc.oauth || []).reduce((memo, item) => {

    if (item.provider !== provider || item.uid !== authData.uid) {
      memo.push(item);
    }
    return memo;
  }, []);

  oauth.push(_.extend({ provider: provider }, authData));
  userDoc.oauth = oauth;

  usersDb.put(userDoc._id, userDoc, (err) => {

    if (err) {
      return cb(err);
    }
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

    internals.getAppConfig(req.server, (err, appConfig) => {

      if (err) {
        return reply(err);
      }

      const providers = (appConfig.oauth || {}).providers || {};
      reply(Object.keys(providers).reduce((memo, name) => {

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

    const name = req.params.provider;
    const ret = {
      provider: name,
      redirectTo: req.query.redirectTo || '/'
    };

    internals.getProviderApi(req.server, name, (err, providerApi) => {

      if (err) {
        return reply(err);
      }

      providerApi.authenticate(req, (err, authenticateUrl, data) => {

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

    const server = req.server;
    const name = req.params.provider;
    const redirectTo = req.auth.credentials.redirectTo || '/';
    const ret = { provider: name, createdAt: new Date() };

    const done = function (err, data) {

      if (err) {
        ret.error = err.message || err;
      }

      ret.data = _.omit(data, ['access_token']);
      req.auth.session.set(ret);
      reply.redirect(redirectTo);
    };

    internals.getProviderApi(server, name, (err, providerApi) => {

      if (err) {
        return reply(err);
      }

      providerApi.callback(req, (err, authData) => {

        if (err) {
          return done(err);
        }

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

    const session = req.auth.credentials || {};
    const response = reply(session);

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

  const settings = server.settings.app;
  const couch = Couch(settings.couchdb);
  const usersDb = couch.db('_users');

  Async.auto({
    ddoc: function (cb) {

      usersDb.addIndex('by_oauth', {
        map: function (doc) {

          if (!doc.oauth || !doc.oauth.length) {
            return;
          }

          // Note that we use `var` as this is code to ve run by CouchDB
          for (var i = 0; i < doc.oauth.length; ++i) { //eslint-disable-line no-var

            emit([doc.oauth[i].provider, doc.oauth[i].uid], doc);
          }
        }
      }, cb);
    },
    cookiePlugin: server.register.bind(server, HapiAuthCookie),
    appConfig: ['cookiePlugin', (results, cb) => {

      internals.getAppConfig(server, cb);
    }],
    foo: ['appConfig', (results, cb) => {

      server.auth.strategy('oauth-session', 'cookie', {
        password: results.appConfig.oauth.cookie.secret,
        cookie: server.settings.app.pkg.name + '-oauth',
        //redirectTo: '/login',
        isSecure: /^https:\/\//.test(results.appConfig.app.url)
      });

      cb();
    }]
  }, next);
};


//
// Hapi Plugin Attributes
//
exports.register.attributes = {
  name: 'oauth',
  version: '1.0.0'
};

