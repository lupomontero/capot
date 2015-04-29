//
// This is a couchdb client for the browser.
//

/* global jQuery */


var extend = require('extend');
var Promise = require('promise');
var PouchDB = require('pouchdb');
var request = require('./request');


function createApi(opt) {

  var req = request(opt);

  return {
    get: req.bind(null, 'GET'),
    post: req.bind(null, 'POST'),
    put: req.bind(null, 'PUT'),
    del: req.bind(null, 'DELETE'),
  };

}


module.exports = function (opt) {

  if (typeof opt === 'string') {
    opt = { url: opt };
  }

  if (!/^https?:\/\//.test(opt.url)) {
    if (opt.url.charAt(0) === '/') { opt.url = opt.url.slice(1); }
    opt.url = window.location.origin + '/' + opt.url;
  }

  var api = createApi(opt);

  api.db = function (dbName) {
    return new PouchDB(opt.url + '/' + encodeURIComponent(dbName));
  };

  api.isAdminParty = function (cb) {
    api.get('/_users/_all_docs', function (err, data) {
      if (err && err.statusCode === 401) {
        cb(null, false);
      } else if (err) {
        cb(err);
      } else {
        cb(null, true);
      }
    });
  };

  return api;

};

