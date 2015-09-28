var _ = require('lodash');
var Model = require('../../client/ui/model');


module.exports = Model.extend({

  defaults: function () {
    return {
      type: 'user'
    };
  },

  database: '_users'

});

