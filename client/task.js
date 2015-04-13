var EventEmitter = require('events').EventEmitter;

module.exports = function (bonnet) {

  var task = new EventEmitter();

  task.start = function (type, attrs) {};

  task.abort = function (type, id) {};

  task.restart = function (type, id, extraAttrs) {};

  task.abortAll = function () {};

  task.restartAll = function () {};

  return task;

};

