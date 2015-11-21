/*eslint no-var:0, prefer-arrow-callback: 0 */
'use strict';


var Assert = require('assert');
var Capot = require('../../client');


describe('capot/client/account', function () {

  var capot = Capot();

  before(function (done) {

    capot.start(done);
  });


  describe('account.id()', function () {

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

    it('should create new user when good details', function (done) {

      var acc = capot.account;
      var email = 'foo' + Date.now() + '@example.com';
      var pass = 'xxxxxxxx';

      acc.signUp(email, pass).then(function () {

        return acc.signIn(email, pass);
      }).then(function () {

        Assert.equal(typeof acc.id(), 'string');
        Assert.equal(acc.session.ok, true);
        Assert.equal(acc.session.userCtx.name, email);
        done();
      });
    });

  });


  describe('account.signIn()', function () {

    it('should...');

  });


  describe('account.signOut()', function () {

    it('should...');

  });


});

