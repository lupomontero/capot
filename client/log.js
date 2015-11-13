/*eslint no-var:0, prefer-arrow-callback: 0 */
'use strict';


var internals = {};


internals.pad = function (n, digits, padding) {

  var str = '' + n;
  if (typeof digits !== 'number') {
    digits = 2;
  }
  if (typeof padding === 'undefined') {
    padding = '0';
  }

  var diff = digits - str.length;
  if (diff <= 0) {
    return str;
  }

  for (var i = 0; i < diff; i++) {
    str = padding + str;
  }

  return str;
};


internals.formatDate = function (d) {

  return [
    internals.pad(d.getHours()),
    internals.pad(d.getMinutes()),
    internals.pad(d.getSeconds()),
    internals.pad(d.getMilliseconds(), 3)
  ].join(':');
};


module.exports = function (options) {

  return function (tags) {

    if (typeof console === 'undefined' || typeof console.log !== 'function') {
      return;
    }

    if (typeof tags === 'string') {
      tags = [tags];
    }

    if (!options.debug && tags.indexOf('debug') >= 0) {
      return;
    }

    var data = Array.prototype.slice.call(arguments, 1);
    if (data.length === 1) {
      data = data[0];
    }

    console.log(internals.formatDate(new Date()), tags, data);
  };

};

