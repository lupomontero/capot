var Path = require('path');
var Joi = require('joi');
var Account = require('./account');
var Session = require('./session');
var OAuth = require('./oauth');


var internals = {};


internals.couch = {
  handler: {
    proxy: {
      passThrough: true,
      mapUri: function (req, cb) {

        var couchUrl = req.server.settings.app.config.couchdb.url;
        cb(null, couchUrl + req.url.path.substr(7), req.headers);
      }
    }
  },
  plugins: {
    lout: false
  }
};


internals.www = {
  handler: {
    directory: {
      path: '.'
    },
  },
  plugins: {
    lout: false
  }
};


internals.admin = {
  handler: {
    directory: {
      path: '../node_modules/capot/admin'
    },
  },
  plugins: {
    lout: false
  }
};


internals.apiInfo = {
  description: 'Get API info',
  auth: 'user',
  response: {
    schema: Joi.object({
      version: Joi.string().required(),
      timestamp: Joi.number().integer().required()
    })
  },
  handler: function (req, reply) {

    var pkg = req.server.settings.app.pkg;
    reply({ version: pkg.version, timestamp: Date.now() });
  }
};


internals.all = [ 'GET', 'POST', 'PUT', 'DELETE' ];


module.exports = [
  { path: '/{p*}', method: 'GET', config: internals.www },
  { path: '/_couch/{p*}', method: internals.all, config: internals.couch },
  { path: '/_admin/{p*}', method: 'GET', config: internals.admin },
  { path: '/_info', method: 'GET', config: internals.apiInfo },
  { path: '/_session', method: 'GET', config: Session.get },
  { path: '/_session', method: 'DELETE', config: Session.remove },
  { path: '/_session', method: 'POST', config: Session.create },
  { path: '/_users', method: 'GET', config: Account.all },
  { path: '/_users', method: 'POST', config: Account.add },
  { path: '/_users/{email}', method: 'GET', config: Account.get },
  { path: '/_users/{email}', method: 'PUT', config: Account.update },
  { path: '/_users/{email}', method: 'DELETE', config: Account.remove },
  { path: '/_users/{email}/_reset', method: 'POST', config: Account.reset },
  { path: '/_users/{email}/_reset/{token}', method: 'GET', config: Account.confirm },
  { path: '/_oauth/providers', method: 'GET', config: OAuth.getProviders },
  { path: '/_oauth/available_providers', method: 'GET', config: OAuth.getAvailableProviders },
  { path: '/_oauth/{provider}', method: 'GET', config: OAuth.connect },
  { path: '/_oauth/callback/{provider}', method: 'GET', config: OAuth.callback },
  { path: '/_oauth/session', method: 'GET', config: OAuth.session },
];

