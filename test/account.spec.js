'use strict';


const Assert = require('assert');
const Sinon = require('sinon');
const Async = require('async');
const TestServer = require('./server');


describe('capot/server/account', () => {

  let server;

  before(function (done) {

    this.timeout(30 * 1000);

    TestServer({ dummyData: true }, (err, s) => {

      if (err) {
        return done(err);
      }

      server = s;
      done();
    });
  });


  describe('GET /_users', () => {


    it('should not allow unauthenticated access', (done) => {

      server.inject({
        method: 'GET',
        url: '/_users'
      }, (resp) => {

        Assert.equal(resp.statusCode, 401);
        Assert.equal(resp.result.statusCode, 401);
        Assert.equal(resp.result.error, 'Unauthorized');
        done();
      });
    });


    it('should not allow access to non admin users', (done) => {

      const name = server.testUsers[0].email;
      const pass = server.testUsers[0].password;
      const auth = (new Buffer(name + ':' + pass)).toString('base64');

      server.inject({
        method: 'GET',
        url: '/_users',
        headers: {
          authorization: 'Basic ' + auth
        }
      }, (resp) => {

        Assert.equal(resp.statusCode, 401);
        Assert.equal(resp.result.statusCode, 401);
        Assert.equal(resp.result.error, 'Unauthorized');
        done();
      });
    });


    it('should allow access to admin', (done) => {

      const auth = (new Buffer('admin:secret')).toString('base64');

      server.inject({
        method: 'GET',
        url: '/_users',
        headers: {
          authorization: 'Basic ' + auth
        }
      }, (resp) => {

        Assert.equal(resp.statusCode, 200);
        Assert.ok(resp.result && typeof resp.result.length === 'number');
        done();
      });
    });


  });


  describe('POST /_users', () => {


    it('should fail when email missing', (done) => {

      server.inject({
        method: 'POST',
        url: '/_users',
        payload: { password: 'secret' }
      }, (resp) => {

        Assert.equal(resp.statusCode, 400);
        Assert.equal(resp.result.validation.source, 'payload');
        Assert.deepEqual(resp.result.validation.keys, ['email']);
        done();
      });
    });


    it('should fail when invalid email', (done) => {

      server.inject({
        method: 'POST',
        url: '/_users',
        payload: { email: 'foo' }
      }, (resp) => {

        Assert.equal(resp.statusCode, 400);
        Assert.equal(resp.result.validation.source, 'payload');
        Assert.deepEqual(resp.result.validation.keys, ['email']);
        Assert.ok(/valid email/i.test(resp.result.message));
        done();
      });
    });


    it('should fail when password missing', (done) => {

      server.inject({
        method: 'POST',
        url: '/_users',
        payload: { email: 'test@localhost' }
      }, (resp) => {

        Assert.equal(resp.statusCode, 400);
        Assert.equal(resp.result.validation.source, 'payload');
        Assert.deepEqual(resp.result.validation.keys, ['password']);
        done();
      });
    });


    it('should create user when credentials ok', (done) => {

      server.inject({
        method: 'POST',
        url: '/_users',
        payload: { email: 'test@localhost', password: 'secret' }
      }, (resp) => {

        const result = JSON.parse(resp.payload);

        Assert.equal(result.ok, true);
        Assert.equal(result.email, 'test@localhost');
        Assert.equal(typeof result.uid, 'string');
        done();
      });
    });


  });


  describe('GET /_users/{email}', () => {


    it('should fail with 404 when unauthenticated??', (done) => {

      server.inject({
        method: 'GET',
        url: '/_users/' + server.testUsers[0].email
      }, (resp) => {

        Assert.equal(resp.statusCode, 404);
        done();
      });
    });


    it('should fail with 401 when getting someone elses user doc');


    it('should get own user doc', (done) => {

      const email = server.testUsers[1].email;
      const pass = server.testUsers[1].password;
      const auth = (new Buffer(email + ':' + pass)).toString('base64');

      server.inject({
        method: 'GET',
        url: '/_users/' + email,
        headers: {
          authorization: 'Basic ' + auth
        }
      }, (resp) => {

        Assert.equal(resp.statusCode, 200);
        Assert.equal(JSON.parse(resp.result).name, email);
        done();
      });
    });


    it('should allow admin to get any user doc', (done) => {

      const auth = (new Buffer('admin:secret')).toString('base64');

      server.inject({
        method: 'GET',
        url: '/_users/' + server.testUsers[0].email,
        headers: { authorization: 'Basic ' + auth }
      }, (resp) => {

        Assert.equal(resp.statusCode, 200);

        const doc = JSON.parse(resp.payload);

        Assert.equal(typeof doc._id, 'string');
        Assert.equal(typeof doc._rev, 'string');
        Assert.equal(typeof doc.password_scheme, 'string');
        Assert.equal(typeof doc.iterations, 'number');
        Assert.equal(doc.name, server.testUsers[0].email);
        Assert.ok(doc.roles && typeof doc.roles.length === 'number');
        Assert.equal(doc.type, 'user');
        Assert.equal(typeof doc.uid, 'string');
        Assert.equal(doc.database, 'user/' + doc.uid);
        Assert.equal(typeof doc.derived_key, 'string');
        Assert.equal(typeof doc.salt, 'string');

        done();
      });
    });


  });


  describe('PUT /_users/{email}', () => {


    //it('should fail with 401 when unauthenticated', (done) => {

    it('should fail with 400 when bad email', (done) => {

      server.inject({
        method: 'PUT',
        url: '/_users/foo',
        payload: {}
      }, (resp) => {

        Assert.equal(resp.statusCode, 400);
        Assert.equal(resp.result.validation.source, 'params');
        Assert.deepEqual(resp.result.validation.keys, ['email']);
        done();
      });
    });


    it('should not allow changes if _rev missing (409)', (done) => {

      const name = server.testUsers[0].email;
      const pass = server.testUsers[0].password;
      const auth = (new Buffer(name + ':' + pass)).toString('base64');

      server.inject({
        method: 'PUT',
        url: '/_users/' + server.testUsers[0].email,
        payload: {
          name: server.testUsers[0].email,
          roles: [],
          type: 'user',
          password: 'secret2'
        },
        headers: {
          authorization: 'Basic ' + auth
        }
      }, (resp) => {

        Assert.equal(resp.statusCode, 409);
        Assert.equal(JSON.parse(resp.payload).error, 'conflict');
        done();
      });
    });


    it('should allow to change own\'s password', (done) => {

      const email = server.testUsers[0].email;
      const credentials = {
        user: email,
        pass: server.testUsers[0].password
      };
      const auth = (new Buffer(credentials.user + ':' + credentials.pass)).toString('base64');

      Async.waterfall([
        function (cb) {

          server.inject({
            method: 'GET',
            url: '/_users/' + email,
            headers: {
              authorization: 'Basic ' + auth
            }
          }, (resp) => {

            Assert.equal(resp.statusCode, 200);
            cb(null, JSON.parse(resp.payload));
          });
        },
        function (userDoc, cb) {

          userDoc.password = 'secret2';

          server.inject({
            method: 'PUT',
            url: '/_users/' + email,
            payload: userDoc,
            headers: {
              authorization: 'Basic ' + auth
            }
          }, (resp) => {

            Assert.equal(resp.statusCode, 201);
            const result = JSON.parse(resp.payload);
            Assert.equal(result.ok, true);
            Assert.equal(result.id, 'org.couchdb.user:' + email);
            server.testUsers[0].password = 'secret2';
            cb();
          });
        }
      ], done);
    });


  });


  describe('DELETE /_users/{email}', () => {


    it('should fail when not authenticated', (done) => {

      server.inject({
        method: 'DELETE',
        url: '/_users/' + server.testUsers[0].email
      }, (resp) => {

        Assert.equal(resp.statusCode, 404);
        done();
      });
    });


    it('should fail when rev missing', (done) => {

      const name = server.testUsers[0].email;
      const pass = server.testUsers[0].password;
      const auth = (new Buffer(name + ':' + pass)).toString('base64');

      server.inject({
        method: 'DELETE',
        url: '/_users/' + server.testUsers[0].email,
        headers: {
          authorization: 'Basic ' + auth
        }
      }, (resp) => {

        Assert.equal(resp.statusCode, 409);
        done();
      });
    });


    it('should delete when all good', (done) => {

      const email = server.testUsers[1].email;
      const pass = server.testUsers[1].password;
      const auth = (new Buffer(email + ':' + pass)).toString('base64');

      Async.waterfall([
        function (cb) {

          server.inject({
            method: 'GET',
            url: '/_users/' + email,
            headers: { authorization: 'Basic ' + auth }
          }, (resp) => {

            Assert.equal(resp.statusCode, 200);
            cb(null, JSON.parse(resp.payload));
          });
        },
        function (userDoc, cb) {

          server.inject({
            method: 'DELETE',
            url: '/_users/' + email,
            headers: {
              authorization: 'Basic ' + auth,
              'if-match': userDoc._rev
            }
          }, (resp) => {

            Assert.equal(resp.statusCode, 200);
            Assert.equal(JSON.parse(resp.payload).id, 'org.couchdb.user:' + email);
            done();
          });
        }
      ], done);
    });


  });


  describe('POST /_users/{email}/_reset', () => {


    it('should fail when bad email', (done) => {

      server.inject({
        method: 'POST',
        url: '/_users/foo/_reset',
        payload: {}
      }, (resp) => {

        Assert.equal(resp.statusCode, 400);
        Assert.equal(resp.result.validation.source, 'params');
        Assert.deepEqual(resp.result.validation.keys, ['email']);
        done();
      });
    });


    it('should send password reset link via email', (done) => {

      const email = server.testUsers[0].email;

      Sinon.stub(server.app, 'sendMail').callsArgWith(1, null, {});

      server.inject({
        method: 'POST',
        url: '/_users/' + email + '/_reset',
        payload: {}
      }, (resp) => {

        Assert.equal(resp.statusCode, 200);
        Assert.deepEqual(resp.result, { ok: true });

        Assert.equal(server.app.sendMail.callCount, 1);
        const call = server.app.sendMail.getCall(0);
        Assert.equal(call.args.length, 2);
        Assert.equal(call.args[0].to, email);
        Assert.equal(call.args[0].template, 'password-reset');
        Assert.equal(typeof call.args[0].context.resetLink, 'string');
        Assert.equal(typeof call.args[1], 'function');

        server.app.sendMail.restore();

        done();
      });
    });


  });


  describe('GET /_users/{email}/_reset/{token}', () => {


    it('should fail with 404 when unknown token', (done) => {

      server.inject({
        method: 'GET',
        url: '/_users/' + server.testUsers[0].email + '/_reset/xxxx'
      }, (resp) => {

        Assert.equal(resp.statusCode, 404);
        done();
      });
    });


    it('should reset password', function (done) {

      this.timeout(10 * 1000);

      const email = server.testUsers[0].email;

      Async.waterfall([
        // 1. Request password reset
        function (cb) {

          Sinon.stub(server.app, 'sendMail').callsArgWith(1, null, {});

          server.inject({
            method: 'POST',
            url: '/_users/' + email + '/_reset',
            payload: {}
          }, (resp) => {

            Assert.equal(resp.statusCode, 200);
            Assert.deepEqual(JSON.parse(resp.payload), { ok: true });

            Assert.equal(server.app.sendMail.callCount, 1);
            const call = server.app.sendMail.getCall(0);
            Assert.equal(call.args.length, 2);
            Assert.equal(call.args[0].to, email);
            Assert.equal(call.args[0].template, 'password-reset');
            Assert.equal(typeof call.args[0].context.resetLink, 'string');
            Assert.equal(typeof call.args[1], 'function');

            server.app.sendMail.restore();

            cb();
          });
        },
        // 2. Check reset token on db.
        function (cb) {

          const docId = 'org.couchdb.user:' + email;
          const docUrl = '/_users/' + encodeURIComponent(docId);

          server.app.couch.get(docUrl, (err, resp) => {

            Assert.ok(!err);
            Assert.equal(typeof resp.$reset.token, 'string');
            cb(null, resp.$reset.token);
          });
        },
        // 3. Follow confirmation link...
        function (token, cb) {

          server.inject({
            method: 'GET',
            url: '/_users/' + email + '/_reset/' + token
          }, (resp) => {

            Assert.equal(resp.statusCode, 200);
            Assert.equal(resp.result.ok, true);
            cb();
          });
        }
      ], done);
    });


  });

});
