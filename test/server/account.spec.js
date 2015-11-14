'use strict';


const Assert = require('assert');
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
        auth: { user: 'testuser1@example.com', pass: 'secret1' }
      }, (err, resp) => {

        Assert.ok(!err);
        Assert.equal(resp.statusCode, 401);
        Assert.equal(resp.body.statusCode, 401);
        Assert.equal(resp.body.error, 'Unauthorized');
        done();
      });
    });

  });

  describe('POST /_users', () => {

    it('should ...', (done) => {

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

});

