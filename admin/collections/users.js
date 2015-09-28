var _ = require('lodash');
var Collection = require('../../client/ui/collection');
var User = require('../models/user');


module.exports = Collection.extend({
  
  model: User,

  comparator: function (m) { return -1 * m.get('id'); }

});

