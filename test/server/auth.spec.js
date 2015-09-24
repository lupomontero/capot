var assert = require('assert');
var server = require('./server');


describe('capot/server/auth', function () {

  before(function (done) {
    this.timeout(30 * 1000);
    server.start(done);
  });

  after(function (done) {
    server.stop(done);
  });

  describe('GET /_session', function () {

    it('should get empty session when no auth', function (done) {
      server.req({
        method: 'GET',
        url: '/_session'
      }, function (err, resp) {
        assert.ok(!err);
        assert.equal(resp.body.ok, true);
        assert.equal(resp.body.userCtx.name, null);
        assert.deepEqual(resp.body.userCtx.roles, []);
        done();
      });
    });

  });

  describe('POST /_session', function () {

    it('should authticate admin user', function (done) {
      server.req({
        method: 'POST',
        url: '/_session',
        body: { name: 'admin', password: 'secret' }
      }, function (err, resp) {
        assert.ok(!err);
        var cookie = resp.headers['set-cookie'][0];
        assert.ok(/^AuthSession=/.test(cookie));
        assert.equal(resp.body.ok, true);
        assert.equal(resp.body.name, null);
        assert.deepEqual(resp.body.roles, [ '_admin' ]);
        done();
      });
    });

  });

});

