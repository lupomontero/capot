/*eslint no-var:0, prefer-arrow-callback: 0 */
'use strict';


var Moment = require('moment');
var Handlebars = window.Handlebars;


Handlebars.registerHelper('log', function (value) {

  console.log(value);
});


Handlebars.registerHelper('formatDate', function (date, format) {

  if (arguments.length === 2) {
    format = 'lll';
  }

  return new Handlebars.SafeString(Moment(date).format(format));
});


Handlebars.registerHelper('fromNow', function (date) {

  return new Handlebars.SafeString(Moment(date).fromNow());
});


Handlebars.registerHelper('glyphicon', function (name) {

  var str = '<span class="glyphicon glyphicon-' + name + '"> </span>';
  return new Handlebars.SafeString(str);
});

