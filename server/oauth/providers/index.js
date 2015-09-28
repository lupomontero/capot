var Fs = require('fs');


exports.getAvailable = function () {

  return Fs.readdirSync(__dirname).reduce(function (memo, fname) {
    var parts = fname.split('.');
    var ext = parts.pop();
    var name = parts.join('.');

    if (name === 'index' || ext !== 'js') { return memo; }

    memo.push(name);
    return memo;
  }, []);
};

