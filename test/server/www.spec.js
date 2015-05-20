var assert = require('assert');
var path = require('path');
var request = require('request');
var Www = require('../../server/www');


function createFakeCapot() {
  return {
    config: {
      cwd: process.cwd(),
      www: 'admin',
      port: 33001
    },
    log: {
      child: function () {
        return {
          info: function () {
            //console.log.apply(console, Array.prototype.slice.call(arguments, 0));
          },
          error: function () {
            //console.log.apply(console, Array.prototype.slice.call(arguments, 0));
          }
        };
      }
    }
  };
};


describe('capot/server/www', function () {

  it('should throw if first arg not an obj', function () {
    assert.throws(function () {
      Www();
    }, TypeError);
  });

  it('should throw if capot doesnt have a logger', function () {
    assert.throws(function () {
      Www({});
    }, TypeError);
  });

  it('should throw if no config.cwd', function () {
    assert.throws(function () {
      Www({ config: {}, log: { child: function () {} } });
    }, TypeError);
  });


  describe('capot/server/www (started)', function () {
  
    var capot;

    before(function (done) {
      capot = createFakeCapot();
      Www(capot, done);
    });

    after(function (done) {
      capot.www.stop(done);
    });

    it('should serve the web root', function (done) {
      request('http://127.0.0.1:33001/', function (err, resp) {
        assert.ok(!err);
        assert.equal(resp.statusCode, 200);
        assert.ok(/<title>Capot Admin<\/title>/i.test(resp.body));
        done();
      });
    });

  });

});

