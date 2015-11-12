//
// External Dependencies
//
var Extend = require('extend');
var Async = require('async');


var internals = {};


internals.noop = function () {};


//
// Default settings.
//
internals.defaults = {
  debug: false
};


//
// `Capot` Front end API
//
module.exports = function Capot(options) {

  var settings = Extend({}, internals.defaults, options);


  var capot = {
    settings: settings,
    request: require('./request')({ url: window.location.origin }),
    uid: require('./uid'),
    log: require('./log')(settings)
  };


  var account = capot.account = require('./account')(capot);
  var store = capot.store = require('./store')(capot);


  capot.log('debug', 'Dependencies: jQuery ' + jQuery.fn.jquery + ', PouchDB ' +
    require('pouchdb').version);


  capot.start = function (cb) {

    cb = cb || internals.noop;
    capot.log('debug', 'Starting capot client...');
    Async.applyEachSeries([
      Async.apply(account.init),
      Async.apply(store.init),
    ], function (err) {

      capot.log('info', err || 'Capot client successfully started');
      cb(err);
    });
  };


  return capot;

};
