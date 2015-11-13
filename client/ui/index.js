/*eslint no-var:0, prefer-arrow-callback: 0 */
'use strict';


// Use jQuery from global scope.
var $ = window.jQuery || window.$;
var _ = window._ = require('lodash');
var Backbone = window.Backbone = require('backbone');
var Handlebars = window.Handlebars = require('handlebars');
var moment = window.moment = require('moment');

// Backbone needs reference to glbal jQuery
Backbone.$ = $;


var Router = require('./router');


module.exports = function CapotUI(options) {

  return new Router(options);

};

