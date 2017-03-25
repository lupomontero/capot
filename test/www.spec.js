'use strict';


const Assert = require('assert');
const Server = require('../');


describe('capot/server/www', () => {

  let server;

  before((done) => {

    server = Server({
      quiet: true,
      couchdb: {
        user: 'admin',
        pass: 'secret'
      }
    }, done);
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
