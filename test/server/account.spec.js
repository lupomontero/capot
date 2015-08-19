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

  describe('GET /users', function () {

    it('should not allow unauthenticated access', function (done) {
      Server.req({
        method: 'GET',
        url: '/_api/users'
      }, function (err, resp) {
        Assert.ok(!err);
        console.log(resp.body);
        Assert.equal(resp.statusCode, 401);
        Assert.equal(resp.body.statusCode, 401);
        Assert.equal(resp.body.error, 'Unauthorized');
        done();
      });
    });

    it('should not allow access to non admin users', function (done) {
      Server.req({
        method: 'GET',
        url: '/_api/users',
        auth: { user: 'testuser1', pass: 'secret1' }
      }, function (err, resp) {
        Assert.ok(!err);
        console.log(resp.body);
        //Assert.equal(resp.statusCode, 401);
        //Assert.equal(resp.body.statusCode, 401);
        //Assert.equal(resp.body.error, 'Unauthorized');
        done();
      });
    });

  });

  describe('POST /users', function () {

    it('should ...', function (done) {
      Server.req({
        method: 'POST',
        url: '/_api/users',
        body: { name: 'admin', password: 'secret' }
      }, function (err, resp) {
        Assert.ok(!err);
        //var cookie = resp.headers['set-cookie'][0];
        //Assert.ok(/^AuthSession=/.test(cookie));
        //Assert.equal(resp.body.ok, true);
        //Assert.equal(resp.body.name, null);
        //Assert.deepEqual(resp.body.roles, [ '_admin' ]);
        done();
      });
    });

  });

});

