/*eslint no-var:0, prefer-arrow-callback: 0 */
'use strict';


var Collection = require('../../client/ui/collection');
var Email = require('../models/email');


module.exports = Collection.extend({

  model: Email,

  comparator: function (m) {

    return -1 * m.get('id');
  }

});

