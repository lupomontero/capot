/*eslint no-var:0, prefer-arrow-callback: 0 */
'use strict';


var Model = require('../../client/ui/model');


module.exports = Model.extend({

  defaults: {
    id: 'config'
  },

  sync: function (method, model, options) {

    var success = options.success || function () {};
    var error = options.error || function () {};
    var json = model.toJSON();
    var app = model.app;
    var db = app.couch.db('app');

    var reject = function (err) {

      error(null, null, err);
    };

    var configDoc;

    switch (method) {
    case 'read':
      db.get('config').then(function (data) {

        configDoc = data;
        return app.request('GET', '/_oauth/available_providers');
      }).then(function (availableProviders) {

        configDoc.oauth = configDoc.oauth || {};
        configDoc.oauth.providers = configDoc.oauth.providers || {};
        configDoc.oauth.providers = availableProviders.reduce(function (memo, name) {

          memo[name] = configDoc.oauth.providers[name] || { enabled: false };
          return memo;
        }, {});

        return configDoc;
      }).then(success, reject);
      break;
    case 'update':
      db.put(json).then(function (data) {

        json._rev = data.rev;
        success(json);
      }, reject);
      break;
    default:
      error(null, null, new Error('Unsupported sync method'));
      break;
    }
  }

});

