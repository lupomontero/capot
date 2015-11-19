const Async = require('async');
const Couch = require('./lib/couch');


const internals = {};


internals.validateDocUpdate = function (newDoc, oldDoc, userCtx, secObj) {

  if (typeof newDoc.type !== 'string') {
    throw({ forbidden: 'doc.type must be a string' });
  }

  log(newDoc);
  log(oldDoc);
  log(userCtx);
  log(secObj);
};


exports.register = function (server, options, next) {

  const config = server.settings.app.config;
  const couch = Couch(config.couchdb);
  const restDb = couch.db('rest');

  Async.series([
    restDb.createIfNotExists,
    Async.apply(restDb.addSecurity, {
      admins: { roles: ['_admin'] },
      members: { roles: ['_admin'] }
    }),
    Async.apply(restDb.setValidationFunction, internals.validateDocUpdate)
  ], next);
};


exports.register.attributes = {
  name: 'rest',
  version: '1.0.0'
};
