var assert = require('assert');
var server = require('./server');


describe('capot/server/authorizations', function () {

  before(function (done) {
    this.timeout(30 * 1000);
    server.start(done);
  });

  after(function (done) {
    server.stop(done);
  });

  describe('GET /authorizations', function () {

    it.skip('should list authorizations', function (done) {
      server.req({
        method: 'GET',
        url: '/_api/authorizations'
      }, function (err, resp) {
        assert.ok(!err);
        console.log(resp.body);
        done();
      });
    });

  });

  describe('POST /authorizations', function () {

    it.skip('should create a new authorization', function (done) {
      server.req({
        method: 'POST',
        url: '/_api/authorizations',
        body: { note: 'This authorization is for blah blah blah' }
      }, function (err, resp) {
        assert.ok(!err);
        console.log(resp.body);
        done();
      });
    });

  });

  describe('GET /authorizations/:id', function () {
    it('should get single authorization');
  });

  describe('PUT /authorizations/clients/:client_id', function () {
    it('should create authorization for specific app');
    it('should get authorization for specific app');
  });

  describe('PUT /authorizations/clients/:client_id/:fingerprint', function () {
    it('should create authorization for specific app and fingerprint');
    it('should get authorization for specific app and fingerprint');
  });

  describe('PATCH /authorizations/:id', function () {
    it('should update an existing authorization');
  });

  describe('DELETE /authorizations/:id', function () {
    it('should delete an authorization');
  });

  describe('GET /applications/:client_id/tokens/:access_token', function () {
    it('should check an authorization');
  });

  describe('POST /applications/:client_id/tokens/:access_token', function () {
    it('should reset an authorization');
  });

  describe('DELETE /applications/:client_id/tokens', function () {
    it('should revoke all authorizations for an application');
  });

  describe('DELETE /applications/:client_id/tokens/:access_token', function () {
    it('should revoke an authorization for an application');
  });

});
