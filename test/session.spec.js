'use strict';


const Assert = require('assert');
const Async = require('async');
const TestServer = require('./server');


describe('capot/server/session', () => {

  const server = TestServer({ dummyData: false });

  before(server.start);

  describe('GET /_session', () => {

    it('should get empty session when no auth', (done) => {

      server.inject({
        method: 'GET',
        url: '/_session'
      }, (resp) => {

        const result = JSON.parse(resp.payload);
        Assert.equal(result.ok, true);
        Assert.equal(result.userCtx.name, null);
        Assert.deepEqual(result.userCtx.roles, []);
        done();
      });
    });

  });

  describe('POST /_session', () => {

    it('should require email', (done) => {

      server.inject({
        method: 'POST',
        url: '/_session',
        payload: {}
      }, (resp) => {

        Assert.equal(resp.statusCode, 400);
        Assert.equal(resp.result.validation.source, 'payload');
        Assert.equal(resp.result.validation.keys[0], 'email');
        done();
      });
    });

    it('should require valid email', (done) => {

      server.inject({
        method: 'POST',
        url: '/_session',
        payload: { email: 'foo' }
      }, (resp) => {

        Assert.equal(resp.statusCode, 400);
        Assert.ok(/valid email/i.test(resp.result.message));
        Assert.equal(resp.result.validation.source, 'payload');
        Assert.equal(resp.result.validation.keys[0], 'email');
        done();
      });
    });

    it('should require password', (done) => {

      server.inject({
        method: 'POST',
        url: '/_session',
        payload: { email: 'foo@localhost' }
      }, (resp) => {

        Assert.equal(resp.statusCode, 400);
        Assert.equal(resp.result.validation.source, 'payload');
        Assert.equal(resp.result.validation.keys[0], 'password');
        done();
      });
    });

    it('should return unauthorized when unknown email', (done) => {

      server.inject({
        method: 'POST',
        url: '/_session',
        payload: { email: 'foo@localhost', password: 'xxxxxxxx' }
      }, (resp) => {

        Assert.equal(resp.statusCode, 401);
        done();
      });
    });

    it('should return unauthorized when bad pass', (done) => {

      const credentials = { email: 'test2@localhost', password: 'secret' };

      server.inject({
        method: 'POST',
        url: '/_users',
        payload: credentials
      }, (resp) => {

        Assert.equal(resp.statusCode, 200);

        credentials.password = 'xxx';

        server.inject({
          method: 'POST',
          url: '/_session',
          payload: credentials
        }, (resp2) => {

          Assert.equal(resp2.statusCode, 401);
          done();
        });
      });
    });

    it('should authenticate valid credentials', (done) => {

      const credentials = { email: 'test3@localhost', password: 'secret' };

      server.inject({
        method: 'POST',
        url: '/_users',
        payload: credentials
      }, (resp) => {

        Assert.equal(resp.statusCode, 200);

        server.inject({
          method: 'POST',
          url: '/_session',
          payload: credentials
        }, (resp2) => {

          Assert.equal(resp2.statusCode, 200);

          const result = JSON.parse(resp2.payload);
          Assert.equal(result.ok, true);
          Assert.equal(result.name, credentials.email);

          const cookie = resp2.headers['set-cookie'][0];
          Assert.ok(/^AuthSession=[^;]+;/.test(cookie));
          done();
        });
      });
    });

    it('should authenticate valid credentials after pass changed by OAuth login', (done) => {

      const adminAuth = (new Buffer('admin:secret')).toString('base64');
      const credentials = {
        email: 'test' + Date.now() + '@localhost',
        password: 'secret'
      };

      Async.waterfall([
        function (cb) {

          server.inject({
            method: 'POST',
            url: '/_users',
            payload: credentials
          }, (resp) => {

            Assert.equal(resp.statusCode, 200);
            cb();
          });
        },
        function (cb) {

          server.inject({
            method: 'POST',
            url: '/_session',
            payload: credentials
          }, (resp) => {

            Assert.equal(resp.statusCode, 200);

            const result = JSON.parse(resp.payload);
            Assert.equal(result.ok, true);
            Assert.equal(result.name, credentials.email);

            const cookie = resp.headers['set-cookie'][0];
            Assert.ok(/^AuthSession=[^;]+;/.test(cookie));
            cb();
          });
        },
        function (cb) {

          server.inject({
            method: 'GET',
            url: '/_users/' + encodeURIComponent(credentials.email),
            headers: { authorization: 'Basic ' + adminAuth }
          }, (resp) => {

            Assert.equal(resp.statusCode, 200);

            const userDoc = JSON.parse(resp.payload);
            userDoc.password = 'foo';
            userDoc.derived_key2 = userDoc.derived_key;
            userDoc.salt2 = userDoc.salt;
            cb(null, userDoc);
          });
        },
        function (userDoc, cb) {

          server.inject({
            method: 'PUT',
            url: '/_users/' + encodeURIComponent(credentials.email),
            headers: { authorization: 'Basic ' + adminAuth },
            payload: userDoc
          }, (resp) => {

            Assert.equal(resp.statusCode, 201);
            Assert.equal(JSON.parse(resp.payload).ok, true);
            cb();
          });
        },
        function (cb) {

          server.inject({
            method: 'POST',
            url: '/_session',
            payload: credentials
          }, (resp) => {

            Assert.equal(resp.statusCode, 200);
            const cookie = resp.headers['set-cookie'][0];
            Assert.ok(/^AuthSession=[^;]+;/.test(cookie));

            const result = JSON.parse(resp.payload);
            Assert.equal(result.ok, true);
            Assert.equal(result.name, credentials.email);
            cb();
          });
        },
        function (cb) {

          server.inject({
            method: 'GET',
            url: '/_users/' + encodeURIComponent(credentials.email),
            headers: { authorization: 'Basic ' + adminAuth }
          }, (resp) => {

            Assert.equal(resp.statusCode, 200);
            // After successfull login with password, derived_key2 and
            // salt2 should be gone.
            const result = JSON.parse(resp.payload);
            Assert.ok(!result.derived_key2);
            Assert.ok(!result.salt2);
            cb();
          });
        }
      ], done);
    });

  });

});
