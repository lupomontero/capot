var Joi = require('Joi');
var Providers = require('./providers');
var Couch = require('../lib/couch');


var internals = {};


internals.getOAuthConfig = function (server, cb) {

  var config = server.settings.app.config;
  var couch = Couch(config.couchdb);

  var defaults = {
    //baseurl: settings.www_link(),
    cookie: {
      //name: hoodie.config.get('name') + '--' + pkg.name,
      //secret: random(32)
    },
    providers: Providers.getAvailable().reduce(function (memo, name) {
      memo[name] = { enabled: false };
      return memo;
    }, {})
  };


  function update(doc) {
    couch.put('/app/config', doc, function (err) {
      if (err) { return cb(err); }
      cb(null, doc.oauth);
    });
  }

  couch.get('/app/config', function (err, doc) {

    if (err) { return cb(err); }

    var pluginConfig = doc.oauth;
    if (!pluginConfig) {
      doc.oauth = defaults;
      return update(doc);
    }

    Object.keys(defaults).forEach(function (k) {
      if (!pluginConfig[k]) {
        pluginConfig[k] = defaults[k];
      }
    });

    cb(null, pluginConfig);
  });
};


exports.register = function (server, options, next) {

  internals.getOAuthConfig(server, function (err, pluginConfig) {

    if (err) { return next(err); }

    //console.log(pluginConfig);
    next();
  });
};


exports.register.attributes = {
  name: 'oauth',
  version: '1.0.0'
};


exports.getAvailableProviders = {
  description: 'Get list of available OAuth providers (both enabled and not).',
  auth: 'admin',
  response: {
    schema: Joi.array()
  },
  handler: function (req, reply) {

    reply(Providers.getAvailable());
  }
};


exports.getProviders = {
  description: 'Get list of supported OAuth providers.',
  response: {
    schema: Joi.array()
  },
  handler: function (req, reply) {
  
    internals.getOAuthConfig(req.server, function (err, pluginConfig) {

      if (err) { return reply(err); }

      var providers = pluginConfig.providers || {};
      reply(Object.keys(providers).reduce(function (memo, name) {

        if (providers[name] && providers[name].enabled) {
          memo.push(name);
        }
        return memo;
      }, []));
    });
  }
};


exports.connect = {
  description: 'Connect to 3rd party account via OAuth',
  handler: function (req, reply) {

    reply({ ok: true });
  }
};


exports.callback = {
  handler: function () {}
};


exports.session = {
  handler: function () {}
};

