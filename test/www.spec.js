'use strict';


const Assert = require('assert');
const TestServer = require('./server');


describe('capot/server/www', () => {

  let server;

  before(function (done) {

    this.timeout(30 * 1000);

    TestServer({ dummyData: false }, (err, s) => {

      if (err) {
        return done(err);
      }

      server = s;
      done();
    });
  });


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
