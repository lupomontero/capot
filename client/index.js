//
// External Dependencies
//
var extend = require('extend');
var async = require('async'); // (19K minified)
var noop = function () {};

//
// Other deps:
// * jQuery
// * events (5.1K minified)
// * Promise (6.9K minified)
// * PouchDB (142K minified)
//


//
// Default settings.
//
var defaults = { 
  remote: window.location.origin + '/_api'
};


//
// `Capot` Front end API
//
module.exports = function Capot(options) {

  var settings = extend({}, defaults, options);


  var capot = {
    settings: settings,
    uid: require('./uid'),
    log: require('./log')(settings)
  };


  var account = capot.account = require('./account')(capot);
  var store = capot.store = require('./store')(capot);
  var task = capot.task = require('./task')(capot);


  var log = capot.log.child({ scope: 'Capot' });
  log.debug('Dependencies: jQuery ' + jQuery.fn.jquery + ', PouchDB ' +
    require('pouchdb').version);


  capot.start = function (cb) {
    cb = cb || noop;
    var log = capot.log.child({ scope: 'capot.start' });
    log.info('Starting capot client...');
    async.applyEachSeries([
      async.apply(account.init),
      async.apply(store.init),
      //async.apply(task.init),
    ], function (err) {
      log.info(err || 'Capot client successfully started');
      cb(err);
    });
  };


  capot.stop = function (cb) {
    // remove logger listeners...
    // clear account.init interval...
  };

  return capot;

};

