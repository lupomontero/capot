'use strict';


const Assert = require('assert');
const Server = require('./server');


describe('capot/server/auth', () => {

  before((done) => {

    this.timeout(30 * 1000);
    Server.start(done);
  });

  after((done) => {

    Server.stop(done);
  });

  describe('GET /_session', () => {

    it('should get empty session when no auth', (done) => {

      Server.req({
        method: 'GET',
        url: '/_session'
      }, (err, resp) => {

        Assert.ok(!err);
        Assert.equal(resp.body.ok, true);
        Assert.equal(resp.body.userCtx.name, null);
        Assert.deepEqual(resp.body.userCtx.roles, []);
        done();
      });
    });

  });

  describe('POST /_session', () => {

    it('should require email', (done) => {

      Server.req({
        method: 'POST',
        url: '/_session',
        body: {}
      }, (err, resp) => {

        Assert.ok(!err);
        Assert.equal(resp.statusCode, 400);
        Assert.equal(resp.body.validation.source, 'payload');
        Assert.equal(resp.body.validation.keys[0], 'email');
        done();
      });
    });

    it('should require valid email', (done) => {

      Server.req({
        method: 'POST',
        url: '/_session',
        body: { email: 'foo' }
      }, (err, resp) => {

        Assert.ok(!err);
        Assert.ok(/valid email/i.test(resp.body.message));
        Assert.equal(resp.statusCode, 400);
        Assert.equal(resp.body.validation.source, 'payload');
        Assert.equal(resp.body.validation.keys[0], 'email');
        done();
      });
    });

    it('should require password', (done) => {

      Server.req({
        method: 'POST',
        url: '/_session',
        body: { email: 'foo@localhost' }
      }, (err, resp) => {

        Assert.ok(!err);
        Assert.equal(resp.statusCode, 400);
        Assert.equal(resp.body.validation.source, 'payload');
        Assert.equal(resp.body.validation.keys[0], 'password');
        done();
      });
    });

    it('should return unauthorized when unknown email', (done) => {

      Server.req({
        method: 'POST',
        url: '/_session',
        body: { email: 'foo@localhost', password: 'xxxxxxxx' }
      }, (err, resp) => {

        Assert.ok(!err);
        Assert.equal(resp.statusCode, 401);
        done();
      });
    });

    it('should return unauthorized when bad pass', (done) => {

      const credentials = { email: 'test2@localhost', password: 'secret' };

      Server.req({
        method: 'POST',
        url: '/_users',
        body: credentials
      }, (err) => {

        credentials.password = 'xxx';

        Server.req({
          method: 'POST',
          url: '/_session',
          body: credentials
        }, (err, resp) => {

          Assert.ok(!err);
          Assert.equal(resp.statusCode, 401);
          done();
        });
      });
    });

    it('should authenticate valid credentials', (done) => {

      const credentials = { email: 'test3@localhost', password: 'secret' };

      Server.req({
        method: 'POST',
        url: '/_users',
        body: credentials
      }, (err) => {

        Server.req({
          method: 'POST',
          url: '/_session',
          body: credentials
        }, (err, resp) => {

          Assert.ok(!err);
          Assert.equal(resp.statusCode, 200);
          Assert.equal(resp.body.ok, true);
          Assert.equal(resp.body.name, credentials.email);
          const cookie = resp.headers['set-cookie'][0];
          Assert.ok(/^AuthSession=[^;]+;/.test(cookie));
          done();
        });
      });
    });

    it('should authenticate valid credentials after pass changed by OAuth login', (done) => {

      const credentials = { email: 'test4@localhost', password: 'secret' };

      Server.req({
        method: 'POST',
        url: '/_users',
        body: credentials
      }, (err) => {

        Server.req({
          method: 'POST',
          url: '/_session',
          body: credentials
        }, (err, resp) => {

          Assert.ok(!err);
          Assert.equal(resp.statusCode, 200);
          Assert.equal(resp.body.ok, true);
          Assert.equal(resp.body.name, credentials.email);
          const cookie = resp.headers['set-cookie'][0];
          Assert.ok(/^AuthSession=[^;]+;/.test(cookie));

          Server.req({
            method: 'GET',
            url: '/_users/' + encodeURIComponent(credentials.email),
            auth: { user: 'admin', pass: 'secret' }
          }, (err, resp, userDoc) => {

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
            }, (err, resp) => {

              Assert.ok(!err);

              Server.req({
                method: 'POST',
                url: '/_session',
                body: credentials
              }, (err, resp) => {

                Assert.ok(!err);
                Assert.equal(resp.statusCode, 200);
                const cookie = resp.headers['set-cookie'][0];
                Assert.ok(/^AuthSession=[^;]+;/.test(cookie));
                Assert.equal(resp.body.ok, true);
                Assert.equal(resp.body.name, credentials.email);

                Server.req({
                  method: 'GET',
                  url: '/_users/' + encodeURIComponent(credentials.email),
                  auth: { user: 'admin', pass: 'secret' }
                }, (err, resp) => {

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

