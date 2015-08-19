var _ = require('lodash');
var Request = require('request');


var internals = {};


internals.noop = function () {};


//
// CouchDB views created using `db.addIndex()` are all stored in the same
// design document: `_design/views`.
// https://github.com/hoodiehq/hoodie.js/issues/70#issuecomment-20506841
//
internals.viewsDdocId = '_design/views';


internals.wrapError = function (err) {

  err.statusCode = 0;
  err.error = 'Internal Server Error';
  return err
};


internals.createError = function (resp) {

  var body = resp.body = {};
  var message = 'Internal server error';
  var error = message;

  if (body.error) {
    error = body.error;
  }

  if (body.reason) {
    message = body.reason;
  } else {
    message = error;
  }

  var err = new Error(message);
  err.statusCode = resp.statusCode || 500;
  err.error = error;
  return err;
};


internals.scopedRequest = function (opt) {

  function req(/* method, path, params, data, cb */) {
    
    var args = _.toArray(arguments);
    var method = args.shift();
    var path = args.shift();
    var cb = (typeof args[args.length - 1] === 'function') ?
      args.pop() : internals.noop;

    // Add leading slash if needed.
    if (path.charAt(0) !== '/') { path = '/' + path; }

    var reqOpt = {
      method: method,
      baseUrl: opt.url,
      url: path,
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

    return Request(reqOpt, function (err, resp) {

      if (err) { return cb(internals.wrapError(err)); }

      if (resp.statusCode >= 400) {
        return cb(internals.createError(resp));
      } 

      cb(null, resp.body, resp);
    });
  }

  return {
    get: req.bind(null, 'GET'),
    post: req.bind(null, 'POST'),
    put: req.bind(null, 'PUT'),
    del: req.bind(null, 'DELETE')
  };
};


module.exports = function (opt) {

  var couch = internals.scopedRequest(opt);
  

  couch.db = function (name) {

    var db = internals.scopedRequest(_.extend({}, opt, {
      url: opt.url + '/' + encodeURIComponent(name)
    }));

    //
    // Creates new design doc with CouchDB view on db.
    //
    db.addIndex = function (name, mapReduce, cb) {

      if (!mapReduce || !_.isFunction(mapReduce.map)) {
        return cb(new Error('db.addIndex() expects mapReduce object to ' +
          'contain a map function.'));
      }

      db.get(internals.viewsDdocId, function (err, ddoc) {

        if (err && err.statusCode === 404) {
          // not found, so we use new object.
          ddoc = {
            _id: internals.viewsDdocId,
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
        db.put(internals.viewsDdocId, ddoc, cb);
      });
    };

    //
    // Removes couchdb view from db.
    //
    db.removeIndex = function (name, cb) {

      db.get(internals.viewsDdocId, function (err, ddoc) {

        if (err) { return cb(err); }

        if (ddoc.views && ddoc.views[name]) {
          delete ddoc.views[name];
        }

        db.put(internals.viewsDdocId, ddoc, cb);
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
  };


  couch.config = {
    get: function (key, cb) {

      return couch.get('/_config/' + key, cb);
    },
    set: function (key, val, cb) {

      var url = '/_config/' + key;
      couch.get(url, function (err, data) {

        if (err) { return cb(err); }
        if (data === val) { return cb(); }
        couch.put(url, val, cb);
      });
    },
    all: function (cb) {

      return couch.get('/_config', cb);
    }
  };


  couch.isAdminParty = function (cb) {
    this.get('/_users/_all_docs', function (err, data) {
      if (err && [ 401, 403 ].indexOf(err.statusCode) >= 0) {
        cb(null, false);
      } else if (err) {
        cb(err);
      } else {
        cb(null, true);
      }
    });
  };


  return couch;

};

