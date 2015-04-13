var bunyan = require('bunyan');


function pad(n, digits, padding) {
  var str = '' + n;
  if (typeof digits !== 'number') { digits = 2; }
  if (typeof padding === 'undefined') { padding = '0'; }
  var diff = digits - str.length;
  if (diff <= 0) { return str; }
  for (var i = 0; i < diff; i++) {
    str = padding + str;
  }
  return str;
}


function formatDate(d) {
  return [
    pad(d.getHours()),
    pad(d.getMinutes()),
    pad(d.getSeconds()),
    pad(d.getMilliseconds(), 3)
  ].join(':');
}


function BrowserStream() {}
BrowserStream.prototype.write = function (rec) {
  var t = rec.time;
  console.log(
    '[%s] %s (%s): %s',
    formatDate(rec.time),
    bunyan.nameFromLevel[rec.level].toUpperCase(),
    rec.scope || 'bonnet',
    rec.msg
  );
};


function IgnoreStream() {}
IgnoreStream.prototype.write = function () {};

module.exports = function (options) {

  return bunyan.createLogger({
    name: 'bonnet',
    streams: [
      {
        level: 'debug',
        stream: options.debug ? new BrowserStream(): new IgnoreStream(),
        type: 'raw'
      }
    ]
  });

};

