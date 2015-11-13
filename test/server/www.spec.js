'use strict';


const Assert = require('assert');
const Server = require('./server');


describe('capot/server/www', () => {


  before(function (done) {

    this.timeout(30 * 1000);
    Server.start(done);
  });


  after((done) => {

    Server.stop(done);
  });


  describe('GET /_couch', () => {

    it('should proxy to couchdb', (done) => {

      Server.req('/_couch', (err, resp) => {

        Assert.ok(!err);
        Assert.equal(resp.statusCode, 200);
        Assert.equal(resp.body.couchdb, 'Welcome');
        done();
      });
    });

  });

});

