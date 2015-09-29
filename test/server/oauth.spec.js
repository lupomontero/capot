var Assert = require('assert');
var Server = require('./server');


describe('capot/server/oauth', function () {

  before(function (done) {

    this.timeout(30 * 1000);
    Server.start(done);
  });

  after(function (done) {

    Server.stop(done);
  });

  describe('GET /_oauth/providers', function () {

    it('should only get enabled providers', function (done) {

      Server.req({
        method: 'GET',
        url: '/_oauth/providers'
      }, function (err, resp) {

        Assert.ok(!err);
        Assert.equal(resp.statusCode, 200);
        Assert.deepEqual(resp.body, []);
        done();
      });
    });

  });

  describe('GET /_oauth/available_providers', function () {

    it('should get unauthorised when not admin', function (done) {

      Server.req({
        method: 'GET',
        url: '/_oauth/available_providers'
      }, function (err, resp) {

        Assert.ok(!err);
        Assert.equal(resp.statusCode, 401);
        done();
      });
    });

    it('should get all available providers when admin', function (done) {

      Server.req({
        method: 'GET',
        url: '/_oauth/available_providers',
        auth: { user: 'admin', pass: 'secret' }
      }, function (err, resp) {

        Assert.ok(!err);
        Assert.equal(resp.statusCode, 200);
        Assert.deepEqual(resp.body, [
          'github',
          'twitter'
        ]);
        done();
      });
    });

  });

  describe('GET /_oauth/{provider}', function () {

    it.skip('should...', function (done) {

      Server.req({
        method: 'GET',
        url: '/_oauth/bitbucket'
      }, function (err, resp) {

        Assert.ok(!err);
        //Assert.equal(resp.statusCode, 401);
        console.log(resp.body);
        done();
      });
    });

  });

  describe('GET /_oauth/session', function () {

    it('should return 401 when missing cookie', function (done) {

      Server.req({
        method: 'GET',
        url: '/_oauth/session'
      }, function (err, resp) {

        Assert.ok(!err);
        Assert.equal(resp.statusCode, 401);
        Assert.equal(resp.body.statusCode, 401);
        Assert.equal(resp.body.message, 'Missing authentication');
        done();
      });
    });

  });

});

