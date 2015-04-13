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
// `Bonnet` Front end API
//
module.exports = function Bonnet(options) {

  var settings = extend({}, defaults, options);


  var bonnet = {
    settings: settings,
    uid: require('./uid'),
    log: require('./log')(settings)
  };


  var account = bonnet.account = require('./account')(bonnet);
  var store = bonnet.store = require('./store')(bonnet);
  var task = bonnet.task = require('./task')(bonnet);


  var log = bonnet.log.child({ scope: 'Bonnet' });
  log.debug('Dependencies: jQuery ' + jQuery.fn.jquery + ', PouchDB ' +
    require('pouchdb').version);


  bonnet.start = function (cb) {
    cb = cb || noop;
    var log = bonnet.log.child({ scope: 'bonnet.start' });
    log.info('Starting bonnet client...');
    async.applyEachSeries([
      async.apply(account.init),
      async.apply(store.init),
      //async.apply(task.init),
    ], function (err) {
      log.info(err || 'Bonnet client successfully started');
      cb(err);
    });
  };


  bonnet.stop = function (cb) {
    // remove logger listeners...
    // clear account.init interval...
  };

  return bonnet;

};

