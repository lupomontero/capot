/*eslint no-var:0, prefer-arrow-callback: 0 */
'use strict';


var EventEmitter = require('events').EventEmitter;
var Promise = require('promise');


var internals = {};


internals.couch = require('./couch')('/_couch');


internals.userDocUrl = function (email) {

  return '/_users/' + encodeURIComponent('org.couchdb.user:' + email);
};


internals.getState = function () {

  return JSON.parse(window.localStorage.getItem('__capot_session'));
};


internals.setState = function (data) {

  window.localStorage.setItem('__capot_session', JSON.stringify(data));
};


module.exports = function (capot) {

  var account = new EventEmitter();
  var hasInit = false;


  account.id = function () {

    var roles = ((account.session || {}).userCtx || {}).roles || [];

    return roles.reduce(function (memo, item) {

      var matches = /^capot:write:user\/([a-z0-9]+)$/.exec(item);
      if (matches && matches[1]) {
        return matches[1];
      }
      return memo;
    }, null);
  };


  account.signUp = function (email, pass) {

    return new Promise(function (resolve, reject) {

      var waitForUserReady = function () {

        capot.request('POST', '/_session', {
          email: email,
          password: pass
        }).then(function (data) {

          if (!data.roles.length) {
            return setTimeout(waitForUserReady, 1000);
          }
          account.init().then(resolve, reject);
        }, reject);
      };

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

    if (!email || typeof email !== 'string') {
      throw new TypeError('Email must be a string');
    }
    else if (!pass || typeof pass !== 'string') {
      throw new TypeError('Password must be a string');
    }

    return capot.request('POST', '/_session', {
      email: email,
      password: pass
    }).then(function () {

      return account.init();
    });
  };


  account.signOut = function () {

    return capot.request('DELETE', '/_session').then(function () {

      return account.init();
    });
  };


  account.changePassword = function (pass, newPass) {

    if (!pass || typeof pass !== 'string') {
      throw new TypeError('Password must be a string');
    }
    else if (!newPass || typeof newPass !== 'string') {
      throw new TypeError('New password must be a string');
    }

    var email = account.session.userCtx.name;
    var url = internals.userDocUrl(email);

    if (!email) {
      return new Promise(function (resolve, reject) {

        reject(new Error('User is not signed in'));
      });
    }
    else if (newPass.length < 8) {
      return new Promise(function (resolve, reject) {

        reject(new Error('Password must be at least 8 chars long'));
      });
    }

    return capot.request('POST', '/_session', { email: email, password: pass })
      .then(function () {

        return internals.couch.get(url);
      })
      .then(function (userDoc) {

        userDoc.password = newPass;
        return internals.couch.put(url, userDoc);
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
    var url = internals.userDocUrl(email);

    return capot.request('DELETE', url).then(function () {

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
      capot.log('debug', 'initializing account...');
    }
    else {
      capot.log('debug', 'refreshing account...');
    }

    cb = cb || function () {};

    var wasOnline = account.isOnline();
    var wasSignedIn = account.isSignedIn();

    return new Promise(function (resolve, reject) {

      var done = function () {

        internals.setState(account.session);

        if (!hasInit) {
          hasInit = true;
          account.emit('init');
          // Check session every 30s...
          window.setInterval(account.init.bind(account), 30 * 1000);
        }
        else if (wasOnline && account.isOffline()) {
          account.emit('offline');
        }
        else if (!wasOnline && account.isOnline()) {
          account.emit('online');
        }
        else if (!wasSignedIn && account.isSignedIn()) {
          account.emit('signin');
        }
        else if (wasSignedIn && !account.isSignedIn()) {
          account.emit('signout');
        }

        resolve();
        cb();
      };

      capot.request('GET', '/_session').then(function (data) {

        account.session = data;
        account.session.isOnline = true;
        done();
      }, function (err) {

        account.session = internals.getState() || {};
        account.session.isOnline = false;
        done();
      });
    });
  };


  //
  // Connect account with social provider.
  //
  account.connectWith = function (provider, options) {

    options = options || {};

    var url = '/_oauth/' + provider;

    if (options.redirectTo) {
      url += '?redirectTo=' + encodeURIComponent(options.redirectTo);
    }

    return new Promise(function (resolve, reject) {

      capot.request('GET', url).then(function (data) {

        window.location.href = data.authenticateUrl;
      }, reject);

    });
  };


  //
  // When loading we check whether we are coming back from an oauth dance.
  //
  account.on('init', function () {

    capot.request('GET', '/_oauth/session').then(function (session) {

      if (typeof session.data !== 'object') {
        return;
      }

      if (!session.data.cookie) {
        return account.emit('oauth', session);
      }

      //var matches = /(AuthSession=[^;]+);/.exec(session.data.cookie);
      //console.log(matches);
      account.init().then(function () {

        account.emit('oauth', session);
      });
    }, function (err) {

      if (xhr.status !== 401) {
        capot.log('error', 'Status: ' + xhr.status + '\n' + xhr.responseText);
      }
    });
  });


  var logEvent = function (eventName) {

    return function () {

      capot.log('debug', 'account:' + eventName, Array.prototype.slice.call(arguments, 0));
    };
  };

  if (capot.settings.debug === true) {
    ['init', 'signin', 'signout', 'offline', 'online'].forEach(function (eventName) {

      account.on(eventName, logEvent(eventName));
    });
  }


  return account;

};
