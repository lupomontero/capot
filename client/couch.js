//
// This is a couchdb client for the browser.
//

/* global jQuery */


var extend = require('extend');
var Promise = require('promise');


function createApi(opt) {

  var baseurl = opt.url;

  function req(/* method, path, params, data */) {
    var args = Array.prototype.slice.call(arguments, 0);
    var method = args.shift();
    var path = args.shift();

    // Add leading slash if needed.
    if (path.charAt(0) !== '/') { path = '/' + path; }

    return new Promise(function (resolve, reject) {
      var reqOpt = {
        type: method,
        url: opt.url + path,
        dataType: 'json',
        timeout: 10 * 1000,
        cache: false,
        error: function (xhr) { 
          var msg, reason;
          if (xhr.status === 0) { // UNSENT
            msg = 'Could not connect to host';
          } else if (xhr.responseJSON && xhr.responseJSON.error) {
            msg = xhr.responseJSON.error;
            reason = xhr.responseJSON.reason;
          } else {
            msg = xhr.statusText;
          }
          var err = new Error(msg);
          err.statusCode = xhr.status;
          err.reason = reason;
          reject(err); 
        },
        success: resolve
      };

      if (opt.user && opt.pass) {
        reqOpt.username = opt.user;
        reqOpt.password = opt.pass;
      }

      if ([ 'PUT', 'POST' ].indexOf(method) >= 0) {
        var data = args.pop();
        if (data) {
          reqOpt.data = JSON.stringify(data);
          reqOpt.contentType = 'application/json';
        }
      }

      if (args.length) {
        var params = args.shift();
        var paramsKeys = Object.keys(params);
        reqOpt.url += paramsKeys.reduce(function (memo, k) {
          var v = JSON.stringify(params[k]);
          return memo += encodeURIComponent(k) + '=' + encodeURIComponent(v);
        }, '?');
      }

      $.ajax(reqOpt);
    });
  }

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

