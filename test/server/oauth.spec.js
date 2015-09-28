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
          'bitbucket',
          'facebook',
          'github',
          'google',
          'twitter'
        ]);
        done();
      });
    });

  });

});

