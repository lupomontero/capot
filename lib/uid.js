'use strict';


//
// Generate sort of UIDs "á la hoodie"
//


const internals = {
  chars: '0123456789abcdefghijklmnopqrstuvwxyz'.split('')
};


module.exports = (length) => {

  const radix = internals.chars.length;
  let id = '';
  let char;

  // default uuid length to 7
  if (length === undefined) {
    length = 7;
  }

  for (let i = 0; i < length; ++i) {
    char = internals.chars[Math.floor(Math.random() * radix)];
    id += String(char).charAt(0);
  }

  return id;
};
