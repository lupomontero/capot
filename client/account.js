var EventEmitter = require('events').EventEmitter;
var Promise = require('promise');
var couch = require('./couch')('/_couch');
var noop = function () {};


function userDocUrl(email) {
  return '/_users/' + encodeURIComponent('org.couchdb.user:' + email);
}

function getState() {
  return JSON.parse(window.localStorage.getItem('__capot_session'));
}

function setState(data) {
  window.localStorage.setItem('__capot_session', JSON.stringify(data));
}


module.exports = function (capot) {

  var log = capot.log.child({ scope: 'capot.account' });
  var account = new EventEmitter();
  var hasInit = false;


  account.id = function () {
    var roles = ((account.session || {}).userCtx || {}).roles || [];
    return roles.reduce(function (memo, item) {
      var matches = /^capot:write:user\/([a-z0-9]+)$/.exec(item);
      if (matches && matches[1]) { return matches[1]; }
      return memo;
    }, null);
  };


  account.signUp = function (email, pass) {
    return new Promise(function (resolve, reject) {
      function waitForUserReady() {
        capot.request('POST', '/_session', {
          name: email,
          password: pass
        }).then(function (data) {
          if (!data.roles.length) { return setTimeout(waitForUserReady, 1000); }
          account.init().then(resolve, reject);
        }, reject);
      }

      if (pass.length < 8) {
        return reject(new Error('Password must be at least 8 chars long'));
      }

      capot.request('POST', '/_users', {
        email: email,
        password: pass
      }).then(function () {
        setTimeout(waitForUserReady, 300);
      }, reject);
    });
  };


  account.signIn = function (email, pass) {
    return couch.post('/_session', {
      name: email,
      password: pass
    }).then(function () {
      return account.init();
    });
  };


  account.signOut = function () {
    return couch.del('/_session').then(function () {
      return account.init();
    });
  };


  account.changePassword = function (pass, newPass) {
    var email = account.session.userCtx.name;
    var url = userDocUrl(email);

    if (newPass.length < 8) {
      return new Promise(function (resolve, reject) {
        reject(new Error('Password must be at least 8 chars long'));
      });
    }

    return couch.post('/_session', { name: email, password: pass })
      .then(function () {
        return couch.get(url);
      })
      .then(function (userDoc) {
        userDoc.password = newPass;
        return couch.put(url, userDoc);
      })
      .then(function () {
        return account.signIn(email, newPass);
      });
  };


  account.changeUsername = function (secret, newEmail) {
    throw new Error('FIXME: Unimplented!');
  };


  account.resetPassword = function (email) {
    return capot.request('POST', '/_reset', {
      email: email,
      baseurl: window.location.origin
    });
  };


  account.destroy = function () {
    var email = account.session.userCtx.name;
    var url = userDocUrl(email);

    return capot.request.del(url).then(function () {
      return account.init();
    });
  };


  account.isSignedIn = function () {
    var userCtx = (account.session || {}).userCtx || {};
    return (typeof userCtx.name === 'string' && userCtx.name.length > 0);
  };


  account.isAdmin = function () {
    var userCtx = (account.session || {}).userCtx || {};
    return userCtx.roles && userCtx.roles.indexOf('_admin') >= 0;
  };


  account.isOnline = function () {
    return account.session && account.session.isOnline;
  };


  account.isOffline = function () {
    return !account.isOnline();
  };


  account.init = function (cb) {
    if (!hasInit) {
      log.info('initializing...');
    } else {
      log.info('refreshing...');
    }

    cb = cb || noop;

    var wasOnline = account.isOnline();
    var wasSignedIn = account.isSignedIn();

    return new Promise(function (resolve, reject) {
      function done() {
        setState(account.session);

        if (!hasInit) {
          hasInit = true;
          account.emit('init');
          // Check session every 30s...
          window.setInterval(account.init.bind(account), 30 * 1000);
        } else if (wasOnline && account.isOffline()) {
          account.emit('offline');
        } else if (!wasOnline && account.isOnline()) {
          account.emit('online');
        } else if (!wasSignedIn && account.isSignedIn()) {
          account.emit('signin');
        } else if (wasSignedIn && !account.isSignedIn()) {
          account.emit('signout');
        }

        resolve();
        cb();
      }

      couch.get('/_session').then(function (data) {
        account.session = data;
        account.session.isOnline = true;
        done();
      }, function (err) {
        account.session = getState() || {};
        account.session.isOnline = false;
        done();
      });
    });
  };


  function logEvent(eventName) {
    var log = capot.log.child({ scope: 'capot.account:' + eventName });
    return function () {
      log.debug(Array.prototype.slice.call(arguments, 0));
    };
  }

  if (capot.settings.debug === true) {
    [ 'init', 'signin', 'signout', 'offline', 'online' ].forEach(function (eventName) {
      account.on(eventName, logEvent(eventName));
    });
  }


  return account;

};

