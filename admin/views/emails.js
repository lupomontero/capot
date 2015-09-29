var View = require('../../client/ui/view');

module.exports = View.extend({

  className: 'container',
  templateName: 'emails',

  initialize: function (opt) {
    
    var view = this;
    var app = opt.app;

    View.prototype.initialize.call(view, opt);

    var emails = view.model = app.createCollection('emails');
    var partial = Handlebars.partials.email;

    emails.on('change', function (email) {

      var html = partial(email.toViewContext());
      view.$('[data-id="' + email.id + '"]').replaceWith(html);
    });

    emails.once('sync', function () {

      view.render();
    });

    emails.fetch();
  },

  events: {
    'click [data-action="save-email"]': 'saveEmail'
  },

  saveEmail: function (e) {

    var $btn = $(e.currentTarget);
    var $panel = $btn.parents('.panel');
    var $textarea = $panel.find('textarea');
    var id = $panel.data('id');
    var text = $textarea.val();
    var model = this.model.get(id);
    model.save({ text: text });
  }

});

