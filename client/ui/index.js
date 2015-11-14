/*eslint no-var:0, prefer-arrow-callback: 0 */
'use strict';


// Use jQuery from global scope.
var $ = window.jQuery || window.$;
var Backbone = window.Backbone = require('backbone');

// Set Handlebars in global scope (needed for templates)
window.Handlebars = require('handlebars');

// Backbone needs reference to glbal jQuery
Backbone.$ = $;


var Router = require('./router');


module.exports = function CapotUI(options) {

  return new Router(options);

};

