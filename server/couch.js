var _ = require('lodash');
var request = require('request');
var PouchDB = require('pouchdb');
var noop = function () {};



module.exports = function (opt) {

  var baseurl = opt.url;


  function req(/* method, path, params, data, cb */) {
    var args = _.toArray(arguments);
    var method = args.shift();
    var path = args.shift();
    var cb = (typeof args[args.length - 1] === 'function') ? args.pop() : noop;

    // Add leading slash if needed.
    if (path.charAt(0) !== '/') { path = '/' + path; }

    var reqOpt = {
      method: method,
      url: opt.url + path,
      json: true
    };

    if (opt.user && opt.pass) {
      reqOpt.auth = _.pick(opt, [ 'user', 'pass' ]);
    }

    if ([ 'PUT', 'POST' ].indexOf(method) >= 0) {
      reqOpt.body = args.pop();
    }

    if (args.length) {
      reqOpt.qs = _.reduce(args.shift(), function (memo, v, k) {
        memo[k] = JSON.stringify(v);
        return memo;
      }, {});
    }

    return request(reqOpt, function (err, resp) {
      if (err) { return cb(err); }
      if (resp.statusCode > 201) {
        if (!resp.body) {
          err = new Error(resp.statusCode);
        } else {
          err = new Error(resp.body.error);
          err.reason = resp.body.reason;
        }
        err.statusCode = resp.statusCode;
        return cb(err);
      } 
      cb(null, resp.body);
    });
  }


  //
  // Public API
  //

  return {

    get: req.bind(null, 'GET'),
    post: req.bind(null, 'POST'),
    put: req.bind(null, 'PUT'),
    del: req.bind(null, 'DELETE'),

    db: function (name) {
      var couch = this;
      var dbUrl = opt.url + '/' + encodeURIComponent(name);
      var db = new PouchDB(dbUrl, {
        auth: {
          username: opt.user,
          password: opt.pass
        }
      });

      //
      // CouchDB views created using `db.addIndex()` are all stored in the same
      // design document: `_design/views`.
      // https://github.com/hoodiehq/hoodie.js/issues/70#issuecomment-20506841
      //
      var viewsDdocId = '_design/views';

      //
      // Creates new design doc with CouchDB view on db.
      //
      db.addIndex = function (name, mapReduce, cb) {
        if (!mapReduce || !_.isFunction(mapReduce.map)) {
          return cb(new Error('db.addIndex() expects mapReduce object to ' +
            'contain a map function.'));
        }

        db.get(viewsDdocId, function (err, ddoc) {
          if (err && err.status === 404) {
            // not found, so we use new object.
            ddoc = {
              _id: viewsDdocId,
              language: 'javascript',
              views: {}
            };
          } else if (err) {
            return cb(err);
          }

          // View functions need to be serialised/stringified.
          var serialised = _.reduce(mapReduce, function (memo, v, k) {
            memo[k] = _.isFunction(v) ? v.toString() : v;
            return memo;
          }, {});

          // If view code has not changed we don't need to do anything else.
          // NOTE: Not sure if this is the best way to deal with this. This
          // saves work and avoids unnecessarily overwriting the
          // `_design/views` document when no actual changes have been made to
          // the view code (map/reduce).
          if (_.isEqual(serialised, ddoc.views[name])) {
            return cb(null, {
              ok: true,
              id: ddoc._id,
              rev: ddoc._rev
            });
          }

          ddoc.views[name] = serialised;
          db.put(ddoc, cb);
        });
      };

      //
      // Removes couchdb view from db.
      //
      db.removeIndex = function (name, cb) {
        db.get(viewsDdocId, function (err, ddoc) {
          if (err) { return cb(err); }

          if (ddoc.views && ddoc.views[name]) {
            delete ddoc.views[name];
          }

          db.put(ddoc, cb);
        });
      };
      
      db.addSecurity = function (securityDoc, cb) {
        db.get('_security', function (err, data) {
          if (err) { return cb(err); }
          if (_.isEqual(data, securityDoc)) { return cb(); }
          // Use `couch` to update the security object as `db` is a PouchDB
          // client, and doesn't allow this.
          couch.put(encodeURIComponent(name) + '/_security', securityDoc, cb);
        });
      };

      db.removeSecurity = function (cb) {
        couch.put(encodeURIComponent(name) + '/_security', {}, cb);
      };

      return db;
    },

    isAdminParty: function (cb) {
      this.get('/_users/_all_docs', function (err, data) {
        if (err && [ 401, 403 ].indexOf(err.statusCode) >= 0) {
          cb(null, false);
        } else if (err) {
          cb(err);
        } else {
          cb(null, true);
        }
      });
    }

  };

};

