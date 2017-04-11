'use strict';


const Assert = require('assert');
const TestServer = require('./server');


describe('capot/server/www', () => {

  const server = TestServer({ dummyData: false });

  before(server.start);

  describe('GET /_couch', () => {

    it('should proxy to couchdb', (done) => {

      server.inject('/_couch', (resp) => {

        Assert.equal(resp.statusCode, 200);
        Assert.equal(JSON.parse(resp.payload).couchdb, 'Welcome');
        done();
      });
    });

  });

});
