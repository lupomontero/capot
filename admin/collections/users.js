/*eslint no-var:0, prefer-arrow-callback: 0 */
'use strict';


var _ = require('lodash');
var Collection = require('../../client/ui/collection');
var User = require('../models/user');


module.exports = Collection.extend({

  model: User,

  comparator: function (m) {

    return -1 * m.get('id');
  },

  sync: function (method, collection, options) {

    var success = options.success || function () {};
    var error = options.error || function () {};
    var app = collection.app;
    var db = app.couch.db('_users');

    var reject = function (err) {

      error(null, null, err);
    };

    switch (method) {
    case 'read':
      db.allDocs({
        startkey: 'org.couchdb.user:',
        endkey: 'org.couchdb.user;',
        include_docs: true
      }).then(function (data) {

        success(_.pluck(data.rows, 'doc'));
      }, reject);
      break;
    default:
      //
      break;
    }
  }

});

