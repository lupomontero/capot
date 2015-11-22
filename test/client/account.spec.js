/*eslint no-var:0, prefer-arrow-callback: 0 */
'use strict';


var Assert = require('assert');
var Capot = require('../../client');


describe('capot/client/account', function () {

  this.timeout(5 * 1000);


  var testUser = { email: 'testuser1@example.com', pass: 'secret1' };
  var capot = Capot();
  var acc = capot.account;

  before(function (done) {

    capot.start(done);
  });


  describe('account.id()', function () {


    it('should return null when not signed in', function () {

      Assert.equal(acc.id(), null);
    });


    it('should return the user\'s capotId when signed in', function () {

      acc.session = {
        userCtx: {
          roles: [
            'xxxxxxx',
            'confirmed',
            'capot:read:user/xxxxxxx',
            'capot:write:user/xxxxxxx'
          ]
        }
      };

      Assert.equal(acc.id(), 'xxxxxxx');
    });


  });


  describe('account.signUp()', function () {


    it('should create new user when good details', function (done) {

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


    it('should throw when no email provided', function () {

      Assert.throws(function () {

        acc.signIn();
      }, function (err) {

        return err instanceof TypeError &&
          err.message === 'Email must be a string';
      });
    });


    it('should throw when no password provided', function () {

      Assert.throws(function () {

        acc.signIn('foo@bar.com');
      }, function (err) {

        return err instanceof TypeError &&
          err.message === 'Password must be a string';
      });
    });


    it('should fail with 400 when invalid email', function (done) {

      acc.signIn('foo', 'xxxxxx').catch(function (err) {

        Assert.equal(err.statusCode, 400);
        done();
      });
    });


    it('should fail with 401 when wrong credentials', function (done) {

      acc.signIn('foo@bar.com', 'xxxxxx').catch(function (err) {

        Assert.equal(err.statusCode, 401);
        done();
      });
    });


  });


  describe('account.signOut()', function () {


    it('should destroy current session', function (done) {

      acc.signIn(testUser.email, testUser.pass).then(function () {

        Assert.equal(acc.session.userCtx.name, testUser.email);
        acc.signOut().then(function () {

          Assert.equal(acc.session.userCtx.name, null);
          done();
        });
      });
    });


  });


  describe('account.changePassword()', function () {


    it('should throw when no password provided', function () {

      Assert.throws(function () {

        acc.changePassword();
      }, function (err) {

        return err instanceof TypeError &&
          err.message === 'Password must be a string';
      });
    });


    it('should throw when no new password provided', function () {

      Assert.equal(acc.isSignedIn(), false);
      Assert.throws(function () {

        acc.changePassword('xxxxxxxx');
      }, function (err) {

        return err instanceof TypeError &&
          err.message === 'New password must be a string';
      });
    });


    it('should fail when not signed in', function (done) {

      Assert.equal(acc.isSignedIn(), false);
      acc.changePassword('xxxxxxxx', 'newsecret').catch(function (err) {

        Assert.ok(/not signed in/i.test(err.message));
        done();
      });
    });


    it('should fail when pass too short', function (done) {

      Assert.equal(acc.isSignedIn(), false);
      acc.signIn(testUser.email, testUser.pass).then(function () {

        acc.changePassword(testUser.pass, 'new').catch(function (err) {

          Assert.ok(/8 chars long/i.test(err));
          acc.signOut().then(done);
        });
      });
    });


    it('should fail with 401 when pass doesnt match', function (done) {

      Assert.equal(acc.isSignedIn(), false);
      acc.signIn(testUser.email, testUser.pass).then(function () {

        acc.changePassword('secret111', 'newsecret').catch(function (err) {

          Assert.equal(err.statusCode, 401);
          acc.signOut().then(done);
        });
      });
    });


    it('should change pass when all good', function (done) {

      Assert.equal(acc.isSignedIn(), false);
      acc.signIn(testUser.email, testUser.pass).then(function () {

        acc.changePassword(testUser.pass, 'newsecret').then(function () {

          Assert.ok(acc.isSignedIn());
          Assert.equal(acc.session.userCtx.name, testUser.email);

          acc.signOut().then(function () {

            Assert.ok(!acc.isSignedIn());
            acc.signIn(testUser.email, 'newsecret').then(function () {

              testUser.pass = 'newsecret';
              Assert.ok(acc.isSignedIn());
              acc.signOut().then(done);
            });
          });
        });
      });
    });


  });


  describe('account.changeUsername()', function () {

    it('should...');

  });


  describe('account.resetPassword()', function () {

    it('should...');

  });


  describe('account.destroy()', function () {

    it('should...');

  });


});

