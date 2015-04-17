# CapotUI

Full blown front-end framework (assumes `browserify`, includes `Backbone`, `Handlebars`, `moment`, `async`...).

For a more minimal and less opinionated approach check out the bare-bones client library: [Capot](../).


```js
// ie: in your `main.js`
var CapotUI = require('capot/client/ui');

var app = CapotUI({
  views: {},
  models: {},
  collections: {},
  templates: {}
});

app.route('', function () {
  app.showView('index');
});

app.start();
```

## `View`

```js
var View = require('capot/client/ui/view');

module.exports = View.extend({
  className: 'container',
  templateName: 'index',
  initialize: function () {
    var view = this;
    var app = view.app;
    var notes = view.model = app.createCollection('note');
    notes.on('sync', function () {
      view.render();
    });
    notes.fetch();
  }
});
```

## `Model`

```js
var Model = require('capot/client/ui/model');

module.exports = Model.extend({
  defaults: function () {
    return {
      type: 'note',
      createdAt: new Date()
    };
  }
});
```

## `Collection`

```js
var Collection = require('capot/client/ui/collection');
var Note = require('../models/note');

module.exports = Collection.extend({
  model: Note
});
```
