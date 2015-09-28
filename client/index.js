//
// External Dependencies
//
var extend = require('extend');
var async = require('async'); // (19K minified)
var noop = function () {};


//
// Default settings.
//
var defaults = { 
  remote: window.location.origin + '/_couch'
};


//
// `Capot` Front end API
//
module.exports = function Capot(options) {

  var settings = extend({}, defaults, options);


  var capot = {
    settings: settings,
    request: require('./request')({ url: window.location.origin }),
    uid: require('./uid'),
    log: require('./log')(settings)
  };


  var account = capot.account = require('./account')(capot);
  var store = capot.store = require('./store')(capot);
  var task = capot.task = require('./task')(capot);


  capot.log('debug', 'Dependencies: jQuery ' + jQuery.fn.jquery + ', PouchDB ' +
    require('pouchdb').version);


  capot.start = function (cb) {
    cb = cb || noop;
    capot.log('info', 'Starting capot client...');
    async.applyEachSeries([
      async.apply(account.init),
      async.apply(store.init),
      //async.apply(task.init),
    ], function (err) {
      capot.log('info', err || 'Capot client successfully started');
      cb(err);
    });
  };


  return capot;

};

