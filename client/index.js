/*eslint no-var:0, prefer-arrow-callback: 0 */
'use strict';


//
// External Dependencies
//
var Extend = require('extend');
var Async = require('async');
var PouchDB = require('pouchdb');


var Request = require('./request');
var Uid = require('./uid');
var Log = require('./log');
var Account = require('./account');
var Store = require('./store');


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
    request: Request({ url: window.location.origin }),
    uid: Uid,
    log: Log(settings)
  };


  var account = capot.account = Account(capot);
  var store = capot.store = Store(capot);


  capot.log('debug', 'Dependencies: jQuery ' + jQuery.fn.jquery + ', PouchDB ' +
    PouchDB.version);


  capot.start = function (cb) {

    cb = cb || internals.noop;
    capot.log('debug', 'Starting capot client...');
    Async.applyEachSeries([
      Async.apply(account.init),
      Async.apply(store.init)
    ], function (err) {

      capot.log('info', err || 'Capot client successfully started');
      cb(err);
    });
  };


  return capot;

};
