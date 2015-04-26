var View = require('../../client/ui/view');

module.exports = View.extend({

  className: 'container',
  templateName: 'users',

  initialize: function (opt) {
    View.prototype.initialize.call(this, opt);
    this.render();
  }

});

