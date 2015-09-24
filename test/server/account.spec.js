var Assert = require('assert');
var Server = require('./server');


describe('capot/server/account', function () {

  before(function (done) {
    this.timeout(30 * 1000);
    Server.start(true, done);
  });

  after(function (done) {
    Server.stop(done);
  });

  describe('GET /_users', function () {

    it('should not allow unauthenticated access', function (done) {
      Server.req({
        method: 'GET',
        url: '/_users'
      }, function (err, resp) {
        Assert.ok(!err);
        Assert.equal(resp.statusCode, 401);
        Assert.equal(resp.body.statusCode, 401);
        Assert.equal(resp.body.error, 'Unauthorized');
        done();
      });
    });

    it('should not allow access to non admin users', function (done) {
      Server.req({
        method: 'GET',
        url: '/_users',
        auth: { user: 'testuser1', pass: 'secret1' }
      }, function (err, resp) {
        Assert.ok(!err);
        Assert.equal(resp.statusCode, 401);
        Assert.equal(resp.body.statusCode, 401);
        Assert.equal(resp.body.error, 'Unauthorized');
        done();
      });
    });

  });

  describe('POST /_users', function () {

    it('should ...', function (done) {
      Server.req({
        method: 'POST',
        url: '/_users',
        body: { email: 'test@localhost', password: 'secret' }
      }, function (err, resp) {
        Assert.ok(!err);
        Assert.equal(resp.body.ok, true);
        Assert.equal(resp.body.email, 'test@localhost');
        Assert.equal(typeof resp.body.uid, 'string');
        done();
      });
    });

  });

});

