/*eslint no-var:0, prefer-arrow-callback: 0 */
'use strict';


var Assert = require('assert');
var Capot = require('../../client');


describe('capot/client/account', function () {


  describe('account.id()', function () {

    var capot;

    beforeEach(function (done) {

      capot = Capot();
      capot.start(done);
    });

    afterEach(function (done) {

      //console.log('after', capot);
      done();
    });

    it('should return null when not signed in', function () {

      Assert.equal(capot.account.id(), null);
    });

    it('should return the user\'s capotId when signed in', function () {

      capot.account.session = {
        userCtx: {
          roles: [
            'xxxxxxx',
            'confirmed',
            'capot:read:user/xxxxxxx',
            'capot:write:user/xxxxxxx'
          ]
        }
      };

      Assert.equal(capot.account.id(), 'xxxxxxx');
    });

  });


  describe('account.signUp()', function () {

    //var capot = Capot();

    it('should...');

  });


  describe('account.signIn()', function () {

    //var capot = Capot();

    it('should...');

  });


  describe('account.signOut()', function () {

    //var capot = Capot();

    it('should...');

  });


});

