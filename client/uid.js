//
// Generate sort of UIDs "á la hoodie"
//


var chars = '0123456789abcdefghijklmnopqrstuvwxyz'.split('');


module.exports = function (length) {

  var id = '';
  var radix = chars.length;

  // default uuid length to 7
  if (length === undefined) {
    length = 7;
  }

  for (var i = 0; i < length; i++) {
    var rand = Math.random() * radix;
    var char = chars[Math.floor(rand)];
    id += String(char).charAt(0);
  }

  return id;
};

