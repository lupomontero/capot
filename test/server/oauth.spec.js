'use strict';


const Assert = require('assert');
const TestServer = require('../server');


describe('capot/server/oauth', () => {

  let server;

  before(function (done) {

    this.timeout(30 * 1000);
    server = TestServer();
    server.start(done);
  });


  after((done) => {

    server.stop(done);
  });


  describe('GET /_oauth/providers', () => {

    it('should only get enabled providers', (done) => {

      server.req({
        method: 'GET',
        url: '/_oauth/providers'
      }, (err, resp) => {

        Assert.ok(!err);
        Assert.equal(resp.statusCode, 200);
        Assert.deepEqual(resp.body, []);
        done();
      });
    });

  });

  describe('GET /_oauth/available_providers', () => {

    it('should get unauthorised when not admin', (done) => {

      server.req({
        method: 'GET',
        url: '/_oauth/available_providers'
      }, (err, resp) => {

        Assert.ok(!err);
        Assert.equal(resp.statusCode, 401);
        done();
      });
    });

    it('should get all available providers when admin', (done) => {

      server.req({
        method: 'GET',
        url: '/_oauth/available_providers',
        auth: { user: 'admin', pass: 'secret' }
      }, (err, resp) => {

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

  describe('GET /_oauth/{provider}', () => {

    it.skip('should...', (done) => {

      server.req({
        method: 'GET',
        url: '/_oauth/bitbucket'
      }, (err, resp) => {

        Assert.ok(!err);
        //Assert.equal(resp.statusCode, 401);
        console.log(resp.body);
        done();
      });
    });

  });

  describe('GET /_oauth/session', () => {

    it('should return 401 when missing cookie', (done) => {

      server.req({
        method: 'GET',
        url: '/_oauth/session'
      }, (err, resp) => {

        Assert.ok(!err);
        Assert.equal(resp.statusCode, 401);
        Assert.equal(resp.body.statusCode, 401);
        Assert.equal(resp.body.message, 'Missing authentication');
        done();
      });
    });

  });

});

