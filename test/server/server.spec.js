'use strict';


const Path = require('path');
const Assert = require('assert');
const Server = require('../../server');


describe('Server', () => {

  it('should have default settings', function (done) {

    this.timeout(10 * 1000);

    const server = Server({}, (err, s) => {

      Assert.ok(!err);

      const settings = server.settings.app;
      Assert.equal(settings.debug, false);
      Assert.equal(settings.port, 3001);
      Assert.equal(settings.cwd, process.cwd());
      Assert.equal(settings.data, Path.join(process.cwd(), 'data'));
      Assert.equal(settings.couchdb.url, 'http://127.0.0.1:3002');
      Assert.equal(settings.couchdb.user, 'admin');
      Assert.equal(settings.couchdb.pass, 'secret');
      Assert.equal(settings.couchdb.run, true);
      done();
    });
  });

});
