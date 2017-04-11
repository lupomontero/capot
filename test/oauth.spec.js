'use strict';


const Assert = require('assert');
const TestServer = require('./server');


describe('capot/server/oauth', () => {

  const server = TestServer({ dummyData: false });

  before(server.start);

  describe('GET /_oauth/providers', () => {

    it('should only get enabled providers', (done) => {

      server.inject({
        method: 'GET',
        url: '/_oauth/providers'
      }, (resp) => {

        Assert.equal(resp.statusCode, 200);
        Assert.deepEqual(JSON.parse(resp.payload), []);
        done();
      });
    });

  });

  describe('GET /_oauth/available_providers', () => {

    it('should get unauthorised when not admin', (done) => {

      server.inject({
        method: 'GET',
        url: '/_oauth/available_providers'
      }, (resp) => {

        Assert.equal(resp.statusCode, 401);
        done();
      });
    });

    it('should get all available providers when admin', (done) => {

      const auth = (new Buffer('admin:secret')).toString('base64');

      server.inject({
        method: 'GET',
        url: '/_oauth/available_providers',
        headers: { authorization: 'Basic ' + auth }
      }, (resp) => {

        Assert.equal(resp.statusCode, 200);
        Assert.deepEqual(JSON.parse(resp.payload), [
          'github',
          'twitter'
        ]);
        done();
      });
    });

  });

  describe('GET /_oauth/{provider}', () => {

    it.skip('should...', (done) => {

      server.inject({
        method: 'GET',
        url: '/_oauth/bitbucket'
      }, (resp) => {

        //Assert.equal(resp.statusCode, 401);
        console.log(resp.result);
        done();
      });
    });

  });

  describe('GET /_oauth/session', () => {

    it('should return 401 when missing cookie', (done) => {

      server.inject({
        method: 'GET',
        url: '/_oauth/session'
      }, (resp) => {

        Assert.equal(resp.statusCode, 401);
        Assert.equal(resp.result.statusCode, 401);
        Assert.equal(resp.result.message, 'Missing authentication');
        done();
      });
    });

  });

});
