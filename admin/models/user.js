/*eslint no-var:0, prefer-arrow-callback: 0 */
'use strict';


var Model = require('../../client/ui/model');


module.exports = Model.extend({

  defaults: function () {

    return {
      type: 'user'
    };
  },

  database: '_users'

});

