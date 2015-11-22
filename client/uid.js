/*eslint no-var:0, prefer-arrow-callback: 0 */
'use strict';


//
// Generate sort of UIDs "á la hoodie"
//


var internals = {
  chars: '0123456789abcdefghijklmnopqrstuvwxyz'.split('')
};


module.exports = function (length) {

  var id = '';
  var radix = internals.chars.length;

  // default uuid length to 7
  if (length === undefined) {
    length = 7;
  }

  for (var i = 0; i < length; ++i) {
    var rand = Math.random() * radix;
    var char = internals.chars[Math.floor(rand)];
    id += String(char).charAt(0);
  }

  return id;
};

