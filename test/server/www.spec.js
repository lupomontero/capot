'use strict';


const Assert = require('assert');
const TestServer = require('../server');


describe('capot/server/www', () => {

  let server;

  before(function (done) {

    this.timeout(30 * 1000);
    server = TestServer();
    server.start(done);
  });


  after((done) => {

    server.stop(done);
  });


  describe('GET /_couch', () => {

    it('should proxy to couchdb', (done) => {

      server.req('/_couch', (err, resp) => {

        Assert.ok(!err);
        Assert.equal(resp.statusCode, 200);
        Assert.equal(resp.body.couchdb, 'Welcome');
        done();
      });
    });

  });

});

