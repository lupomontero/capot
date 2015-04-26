var CapotUI = require('../client/ui');
var app = window.app = CapotUI({
  debug: true,
  routePrefix: '_admin/',
  views: {
    index: require('./views/index'),
    signin: require('./views/signin'),
    users: require('./views/users'),
    config: require('./views/config'),
    header: require('./views/_header')
  },
  templates: require('./templates').templates
});


app.couch = require('../client/couch')('/_api');


var session;


function requireAdmin(fn) {
  return function () {
    if (session.userCtx.roles.indexOf('_admin') === -1) {
      return app.navigate('signin', { trigger: true });
    }
    fn.apply(this, Array.prototype.slice.call(arguments, 0));
  };
}


app.addRegion('header', {
  view: 'header',
  prepend: true,
  tagName: 'header',
  className: 'navbar navbar-inverse navbar-fixed-top'
});


app.route('', requireAdmin(function () {
  app.showView('index');
}));


app.route('users', requireAdmin(function () {
  app.showView('users');
}));


app.route('config', requireAdmin(function () {
  app.showView('config');
}));


app.route('signin', function () {
  app.showView('signin');
});


app.couch.get('/_session').then(function (data) {
  session = data || { userCtx: { name: null, roles: [] } };
  app.start();
}, function (err) {
  console.error(err);
});

