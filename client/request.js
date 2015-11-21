/*eslint no-var:0, prefer-arrow-callback: 0 */
'use strict';


var Promise = require('promise');


module.exports = function (options) {

  return function req(/* method, path, params, data */) {

    var args = Array.prototype.slice.call(arguments, 0);
    var method = args.shift();
    var path = args.shift();

    // Add leading slash if needed.
    if (path.charAt(0) !== '/') {
      path = '/' + path;
    }

    return new Promise(function (resolve, reject) {

      var reqOpt = {
        type: method,
        url: options.url + path,
        dataType: 'json',
        timeout: 60 * 1000,
        cache: false,
        error: function (xhr) {

          var msg;
          var reason;

          if (xhr.status === 0) { // UNSENT
            msg = 'Request timed out';
          }
          else if (xhr.responseJSON && xhr.responseJSON.error) {
            msg = xhr.responseJSON.error;
            reason = xhr.responseJSON.reason;
          }
          else {
            msg = xhr.statusText;
          }
          var err = new Error(msg);
          err.statusCode = xhr.status;
          err.reason = reason;
          reject(err);
        },
        success: resolve
      };

      if (options.user && options.pass) {
        reqOpt.username = options.user;
        reqOpt.password = options.pass;
      }

      if (['PUT', 'POST'].indexOf(method) >= 0) {
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
          if (memo) {
            memo += '&';
          }
          return memo + encodeURIComponent(k) + '=' + encodeURIComponent(v);
        }, '?');
      }

      $.ajax(reqOpt);
    });
  };

};
