'use strict';


const Assert = require('assert');
const Async = require('async');
const TestServer = require('../server');


describe('capot/server/account', () => {

  let server;

  before(function (done) {

    this.timeout(30 * 1000);
    server = TestServer();
    server.start(true, done);
  });


  after((done) => {

    server.stop(done);
  });


  describe('GET /_users', () => {


    it('should not allow unauthenticated access', (done) => {

      server.req({
        method: 'GET',
        url: '/_users'
      }, (err, resp) => {

        Assert.ok(!err);
        Assert.equal(resp.statusCode, 401);
        Assert.equal(resp.body.statusCode, 401);
        Assert.equal(resp.body.error, 'Unauthorized');
        done();
      });
    });


    it('should not allow access to non admin users', (done) => {

      server.req({
        method: 'GET',
        url: '/_users',
        auth: {
          user: server.testUsers[0].email,
          pass: server.testUsers[0].password
        }
      }, (err, resp) => {

        Assert.ok(!err);
        Assert.equal(resp.statusCode, 401);
        Assert.equal(resp.body.statusCode, 401);
        Assert.equal(resp.body.error, 'Unauthorized');
        done();
      });
    });


    it('should allow access to admin', (done) => {

      server.req({
        method: 'GET',
        url: '/_users',
        auth: { user: 'admin', pass: 'secret' }
      }, (err, resp) => {

        Assert.ok(!err);
        Assert.equal(resp.statusCode, 200);
        Assert.ok(resp.body && typeof resp.body.length === 'number');
        done();
      });
    });


  });


  describe('POST /_users', () => {


    it('should fail when email missing', (done) => {

      server.req({
        method: 'POST',
        url: '/_users',
        body: { password: 'secret' }
      }, (err, resp) => {

        Assert.ok(!err);
        Assert.equal(resp.statusCode, 400);
        Assert.equal(resp.body.validation.source, 'payload');
        Assert.deepEqual(resp.body.validation.keys, ['email']);
        done();
      });
    });


    it('should fail when invalid email', (done) => {

      server.req({
        method: 'POST',
        url: '/_users',
        body: { email: 'foo' }
      }, (err, resp) => {

        Assert.ok(!err);
        Assert.equal(resp.statusCode, 400);
        Assert.equal(resp.body.validation.source, 'payload');
        Assert.deepEqual(resp.body.validation.keys, ['email']);
        Assert.ok(/valid email/i.test(resp.body.message));
        done();
      });
    });


    it('should fail when password missing', (done) => {

      server.req({
        method: 'POST',
        url: '/_users',
        body: { email: 'test@localhost' }
      }, (err, resp) => {

        Assert.ok(!err);
        Assert.equal(resp.statusCode, 400);
        Assert.equal(resp.body.validation.source, 'payload');
        Assert.deepEqual(resp.body.validation.keys, ['password']);
        done();
      });
    });


    it('should create user when credentials ok', (done) => {

      server.req({
        method: 'POST',
        url: '/_users',
        body: { email: 'test@localhost', password: 'secret' }
      }, (err, resp) => {

        Assert.ok(!err);
        Assert.equal(resp.body.ok, true);
        Assert.equal(resp.body.email, 'test@localhost');
        Assert.equal(typeof resp.body.uid, 'string');
        done();
      });
    });


  });


  describe('GET /_users/{email}', () => {


    it('should fail with 404 when unauthenticated??', (done) => {

      server.req({
        method: 'GET',
        url: '/_users/' + server.testUsers[0].email
      }, (err, resp) => {

        Assert.ok(!err);
        Assert.equal(resp.statusCode, 404);
        done();
      });
    });


    it('should fail with 401 when getting someone elses user doc');


    it('should get own user doc', (done) => {

      const email = server.testUsers[1].email;
      const pass = server.testUsers[1].password;

      server.req({
        method: 'GET',
        url: '/_users/' + email,
        auth: {
          user: email,
          pass: pass
        }
      }, (err, resp) => {

        Assert.ok(!err);
        Assert.equal(resp.statusCode, 200);
        Assert.equal(resp.body.name, email);
        done();
      });
    });


    it('should allow admin to get any user doc', (done) => {

      server.req({
        method: 'GET',
        url: '/_users/' + server.testUsers[0].email,
        auth: { user: 'admin', pass: 'secret' }
      }, (err, resp) => {

        Assert.ok(!err);
        Assert.equal(resp.statusCode, 200);
        Assert.equal(typeof resp.body._id, 'string');
        Assert.equal(typeof resp.body._rev, 'string');
        Assert.equal(typeof resp.body.password_scheme, 'string');
        Assert.equal(typeof resp.body.iterations, 'number');
        Assert.equal(resp.body.name, server.testUsers[0].email);
        Assert.ok(resp.body.roles && typeof resp.body.roles.length === 'number');
        Assert.equal(resp.body.type, 'user');
        Assert.equal(typeof resp.body.uid, 'string');
        Assert.equal(resp.body.database, 'user/' + resp.body.uid);
        Assert.equal(typeof resp.body.derived_key, 'string');
        Assert.equal(typeof resp.body.salt, 'string');
        done();
      });
    });


  });


  describe('PUT /_users/{email}', () => {


    //it('should fail with 401 when unauthenticated', (done) => {

    it('should fail with 400 when bad email', (done) => {

      server.req({
        method: 'PUT',
        url: '/_users/foo',
        body: {}
      }, (err, resp) => {

        Assert.ok(!err);
        Assert.equal(resp.statusCode, 400);
        Assert.equal(resp.body.validation.source, 'params');
        Assert.deepEqual(resp.body.validation.keys, ['email']);
        done();
      });
    });


    it('should not allow changes if _rev missing (409)', (done) => {

      server.req({
        method: 'PUT',
        url: '/_users/' + server.testUsers[0].email,
        body: {
          name: server.testUsers[0].email,
          roles: [],
          type: 'user',
          password: 'secret2'
        },
        auth: {
          user: server.testUsers[0].email,
          pass: server.testUsers[0].password
        }
      }, (err, resp) => {

        Assert.ok(!err);
        Assert.equal(resp.statusCode, 409);
        Assert.equal(resp.body.error, 'conflict');
        done();
      });
    });


    it('should allow to change own\'s password', (done) => {

      const email = server.testUsers[0].email;
      const credentials = {
        user: email,
        pass: server.testUsers[0].password
      };

      Async.waterfall([
        function (cb) {

          server.req({
            method: 'GET',
            url: '/_users/' + email,
            auth: credentials
          }, (err, resp) => {

            Assert.ok(!err);
            Assert.equal(resp.statusCode, 200);
            cb(null, resp.body);
          });
        },
        function (userDoc, cb) {

          userDoc.password = 'secret2';

          server.req({
            method: 'PUT',
            url: '/_users/' + email,
            body: userDoc,
            auth: credentials
          }, (err, resp) => {

            Assert.ok(!err);
            Assert.equal(resp.statusCode, 201);
            Assert.equal(resp.body.ok, true);
            Assert.equal(resp.body.id, 'org.couchdb.user:' + email);
            server.testUsers[0].password = 'secret2';
            done();
          });
        }
      ], done);
    });


  });


  describe('DELETE /_users/{email}', () => {


    it('should...');


  });


  describe('POST /_users/{email}/_reset', () => {


    it('should...');


  });


  describe('GET /_users/{email}/_reset/{token}', () => {


    it('should...');


  });

});

