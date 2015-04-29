var _ = require('lodash');
var Collection = require('../../client/ui/collection');
var Email = require('../models/email');


module.exports = Collection.extend({
  
  model: Email,

  comparator: function (m) { return -1 * m.get('id'); }

});

