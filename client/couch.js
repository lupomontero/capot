/*eslint no-var:0, prefer-arrow-callback: 0 */
'use strict';


//
// This is a couchdb client for the browser.
//

var PouchDB = require('pouchdb');
var Request = require('./request');


var internals = {};


internals.createApi = function (options) {

  var req = Request(options);

  return {
    get: req.bind(null, 'GET'),
    post: req.bind(null, 'POST'),
    put: req.bind(null, 'PUT'),
    del: req.bind(null, 'DELETE')
  };

};


module.exports = function (options) {

  if (typeof options === 'string') {
    options = { url: options };
  }

  if (!/^https?:\/\//.test(options.url)) {
    if (options.url.charAt(0) === '/') {
      options.url = options.url.slice(1);
    }
    options.url = window.location.origin + '/' + options.url;
  }

  var api = internals.createApi(options);

  api.db = function (dbName) {

    return new PouchDB(options.url + '/' + encodeURIComponent(dbName));
  };

  api.isAdminParty = function (cb) {

    api.get('/_users/_all_docs', function (err, data) {

      if (err && err.statusCode === 401) {
        cb(null, false);
      }
      else if (err) {
        cb(err);
      }
      else {
        cb(null, true);
      }
    });
  };

  return api;

};
