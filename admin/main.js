/*eslint no-var:0, prefer-arrow-callback: 0 */
'use strict';


var Couch = require('../client/couch');
var CapotUI = require('../client/ui');


var app = window.app = CapotUI({
  //debug: true,
  routePrefix: '_admin/',
  views: {
    index: require('./views/index'),
    signin: require('./views/signin'),
    users: require('./views/users'),
    config: require('./views/config'),
    emails: require('./views/emails'),
    header: require('./views/_header')
  },
  models: {
    user: require('./models/user'),
    config: require('./models/config'),
    email: require('./models/email')
  },
  collections: {
    users: require('./collections/users'),
    emails: require('./collections/emails')
  },
  templates: require('./templates').templates
});


app.couch = Couch('/_couch');


app.addRegion('header', {
  view: 'header',
  prepend: true,
  tagName: 'header',
  className: 'navbar navbar-inverse navbar-fixed-top'
});


app.route('', app.requireAdmin(function () {

  app.showView('index');
}));


app.route('users', app.requireAdmin(function () {

  app.showView('users');
}));


app.route('config', app.requireAdmin(function () {

  app.showView('config');
}));


app.route('emails', app.requireAdmin(function () {

  app.showView('emails');
}));


app.route('signin', function () {

  if (app.account.isSignedIn() && !app.account.isAdmin()) {
    window.location.href = '/';
  }
  else if (app.account.isSignedIn()) {
    app.navigate('', { trigger: true });
  }
  else {
    app.showView('signin');
  }
});


app.start();

