var assert = require('assert');
var server = require('./server');


describe('capot/server/www', function () {

  before(function (done) {
    this.timeout(30 * 1000);
    server.start(done);
  });

  after(function (done) {
    server.stop(done);
  });

  describe('GET /_couch', function () {
  
    it('should proxy to couchdb', function (done) {
      server.req('/_couch', function (err, resp) {
        assert.ok(!err);
        assert.equal(resp.statusCode, 200);
        assert.equal(resp.body.couchdb, 'Welcome');
        done();
      });
    });

  });

});

