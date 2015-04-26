var View = require('../../client/ui/view');

module.exports = View.extend({

  className: 'container',
  templateName: 'index',

  initialize: function (opt) {
    View.prototype.initialize.call(this, opt);
    this.render();
  }

});

