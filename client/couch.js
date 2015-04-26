//
// This is a couchdb client for the browser.
//

/* global jQuery */


var extend = require('extend');
var Promise = require('promise');
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

  var api = createApi(opt);

  api.db = function (dbName) {
    var db = createApi(extend({}, opt, {
      url: opt.url + '/' + encodeURIComponent(dbName)
    }));

    db.view = function () {};

    return db;
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

