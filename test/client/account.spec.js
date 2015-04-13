var assert = require('assert');
var Bonnet = require('../../client');


describe('bonnet/client/account', function () {


  describe('account.id()', function () {

    var bonnet;

    beforeEach(function (done) {
      bonnet = Bonnet();
      bonnet.start(done);
    });

    afterEach(function (done) {
      //console.log('after', bonnet);
      done();
    });

    it('should return null when not signed in', function () {
      assert.equal(bonnet.account.id(), null);
    });

    it('should return the user\'s bonnetId when signed in', function () {
      bonnet.account.session = {
        userCtx: {
          roles: [
            'xxxxxxx',
            'confirmed',
            'bonnet:read:user/xxxxxxx',
            'bonnet:write:user/xxxxxxx'
          ]
        }
      };

      assert.equal(bonnet.account.id(), 'xxxxxxx');
    });

  });


  describe('account.signUp()', function () {

    var bonnet = Bonnet();

    it('should...', function () {
      //...
    });

  });


  describe('account.signIn()', function () {

    var bonnet = Bonnet();

    it('should...', function () {
      //...
    });

  });


  describe('account.signOut()', function () {

    var bonnet = Bonnet();

    it('should...', function () {
      //...
    });

  });


});

