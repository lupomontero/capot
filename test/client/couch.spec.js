var assert = require('assert');
var Promise = require('promise');
var Couch = require('../../client/couch');


describe('bonnet/cient/couch', function () {

  it('should be a function', function () {
    assert.equal(typeof Couch, 'function');
  });

  var couch = Couch({ url: '/_api' });


  describe('couch.get()', function () {

    it('should return a promise, send ajax request and resolve', function () {
      var resp = {
        "express-pouchdb": "Welcome!",
        "version": "0.14.0",
        "vendor": { "name": "PouchDB authors", "version": "0.14.0" },
        "uuid": "61a7ef3c-6c28-43d5-9a02-6671186a995c"
      };

      $.mockjax({
        url: '/_api/',
        type: 'GET',
        responseText: resp
      });

      var promise = couch.get('/');
      
      assert.ok(promise instanceof Promise);

      promise.then(function (data) {
        assert.deepEqual(data, resp);
      });
    });

  });


  describe('couch.db()', function () {

    it('should...', function () {
      var db = couch.db('_users');
      // TODO: Should this be an instance of PouchDB?
      console.log(db);
    });

  });

});

