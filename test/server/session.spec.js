var Assert = require('assert');
var Server = require('./server');


describe('capot/server/auth', function () {

  before(function (done) {
    this.timeout(30 * 1000);
    Server.start(done);
  });

  after(function (done) {
    Server.stop(done);
  });

  describe('GET /_session', function () {

    it('should get empty session when no auth', function (done) {
      Server.req({
        method: 'GET',
        url: '/_session'
      }, function (err, resp) {
        Assert.ok(!err);
        Assert.equal(resp.body.ok, true);
        Assert.equal(resp.body.userCtx.name, null);
        Assert.deepEqual(resp.body.userCtx.roles, []);
        done();
      });
    });

  });

  describe('POST /_session', function () {

    it('should require email', function (done) {

      Server.req({
        method: 'POST',
        url: '/_session',
        body: {}
      }, function (err, resp) {

        Assert.ok(!err);
        Assert.equal(resp.statusCode, 400);
        Assert.equal(resp.body.validation.source, 'payload');
        Assert.equal(resp.body.validation.keys[0], 'email');
        done();
      });
    });

    it('should require valid email', function (done) {

      Server.req({
        method: 'POST',
        url: '/_session',
        body: { email: 'foo' }
      }, function (err, resp) {

        Assert.ok(!err);
        Assert.ok(/valid email/i.test(resp.body.message));
        Assert.equal(resp.statusCode, 400);
        Assert.equal(resp.body.validation.source, 'payload');
        Assert.equal(resp.body.validation.keys[0], 'email');
        done();
      });
    });

    it('should require password', function (done) {

      Server.req({
        method: 'POST',
        url: '/_session',
        body: { email: 'foo@localhost' }
      }, function (err, resp) {

        Assert.ok(!err);
        Assert.equal(resp.statusCode, 400);
        Assert.equal(resp.body.validation.source, 'payload');
        Assert.equal(resp.body.validation.keys[0], 'password');
        done();
      });
    });

    it('should return unauthorized when unknown email', function (done) {

      Server.req({
        method: 'POST',
        url: '/_session',
        body: { email: 'foo@localhost', password: 'xxxxxxxx' }
      }, function (err, resp) {

        Assert.ok(!err);
        Assert.equal(resp.statusCode, 401);
        done();
      });
    });

    it('should return unauthorized when bad pass', function (done) {

      var credentials = { email: 'test2@localhost', password: 'secret' };

      Server.req({
        method: 'POST',
        url: '/_users',
        body: credentials
      }, function (err) {
    
        credentials.password = 'xxx';

        Server.req({
          method: 'POST',
          url: '/_session',
          body: credentials
        }, function (err, resp) {

          Assert.ok(!err);
          Assert.equal(resp.statusCode, 401);
          done();
        });
      });
    });

    it('should authenticate valid credentials', function (done) {

      var credentials = { email: 'test3@localhost', password: 'secret' };

      Server.req({
        method: 'POST',
        url: '/_users',
        body: credentials
      }, function (err) {
    
        Server.req({
          method: 'POST',
          url: '/_session',
          body: credentials
        }, function (err, resp) {

          Assert.ok(!err);
          Assert.equal(resp.statusCode, 200);
          Assert.equal(resp.body.ok, true);
          Assert.equal(resp.body.name, credentials.email);
          var cookie = resp.headers['set-cookie'][0];
          Assert.ok(/^AuthSession=[^;]+;/.test(cookie));
          done();
        });
      });
    });

    it('should authenticate valid credentials after pass changed by OAuth login', function (done) {

      var credentials = { email: 'test4@localhost', password: 'secret' };

      Server.req({
        method: 'POST',
        url: '/_users',
        body: credentials
      }, function (err) {
    
        Server.req({
          method: 'POST',
          url: '/_session',
          body: credentials
        }, function (err, resp) {

          Assert.ok(!err);
          Assert.equal(resp.statusCode, 200);
          Assert.equal(resp.body.ok, true);
          Assert.equal(resp.body.name, credentials.email);
          var cookie = resp.headers['set-cookie'][0];
          Assert.ok(/^AuthSession=[^;]+;/.test(cookie));

          Server.req({
            method: 'GET',
            url: '/_users/' + encodeURIComponent(credentials.email),
            auth: { user: 'admin', pass: 'secret' }
          }, function (err, resp, userDoc) {

            Assert.ok(!err);
            Assert.equal(resp.statusCode, 200);

            userDoc.password = 'foo';
            userDoc.derived_key2 = userDoc.derived_key;
            userDoc.salt2 = userDoc.salt;

            Server.req({
              method: 'PUT',
              url: '/_users/' + encodeURIComponent(credentials.email),
              auth: { user: 'admin', pass: 'secret' },
              body: userDoc
            }, function (err, resp) {

              Assert.ok(!err);

              Server.req({
                method: 'POST',
                url: '/_session',
                body: credentials
              }, function (err, resp) {

                Assert.ok(!err);
                Assert.equal(resp.statusCode, 200);
                var cookie = resp.headers['set-cookie'][0];
                Assert.ok(/^AuthSession=[^;]+;/.test(cookie));
                Assert.equal(resp.body.ok, true);
                Assert.equal(resp.body.name, credentials.email);

                Server.req({
                  method: 'GET',
                  url: '/_users/' + encodeURIComponent(credentials.email),
                  auth: { user: 'admin', pass: 'secret' },
                }, function (err, resp) {
                
                  Assert.ok(!err);
                  Assert.equal(resp.statusCode, 200);
                  // After successfull login with password, derived_key2 and
                  // salt2 should be gone.
                  Assert.ok(!resp.body.derived_key2);
                  Assert.ok(!resp.body.salt2);
                  done();
                });
              });
            });
          });
        });
      });
    });

  });

});

