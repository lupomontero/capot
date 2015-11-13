/*eslint no-var:0, prefer-arrow-callback: 0 */
'use strict';


var Handlebars = require('handlebars');

Handlebars.registerHelper('log', function (value) {
  console.log(value);
});

Handlebars.registerHelper('formatDate', function (date, format) {
  if (arguments.length === 2) {
    format = 'lll';
  }
  return new Handlebars.SafeString(moment(date).format(format));
});

Handlebars.registerHelper('fromNow', function (date) {
  return new Handlebars.SafeString(moment(date).fromNow());
});

Handlebars.registerHelper('glyphicon', function (name) {
  var str = '<span class="glyphicon glyphicon-' + name + '"> </span>';
  return new Handlebars.SafeString(str);
});

