var EventEmitter = require('events').EventEmitter;
var async = require('async');
var moment = require('moment');
var Boom = require('hapi/node_modules/boom');
var uid = require('../client/uid');


function permissionsDdoc(capotId) {
  return {
    _id: '_design/permissions',
    language: 'javascript',
    validate_doc_update: [
      'function (newDoc, oldDoc, userCtx) {',
      '  for (var i = 0; i < userCtx.roles.length; i++) {',
      '    var r = userCtx.roles[i];',
      '    if (r === "capot:write:user/' + capotId + '" || r === "_admin") {',
      '      return;',
      '    }',
      '  }',
      '  throw {unauthorized: "You are not authorized to write to this database"};',
      '}'
    ].join('\n')
  };
}


function securityDoc(capotId) {
  return {
    admins: { names: [], roles: [] },
    members: {
      admins: [],
      roles: [
        'capot:read:user/' + capotId,
        'capot:write:user/' + capotId
      ]
    }
  };
}


function roles(capotId) {
  return [
    capotId,
    'confirmed',
    'capot:read:user/' + capotId,
    'capot:write:user/' + capotId
  ];
}


module.exports = function (capot, cb) {

  var couch = capot.couch;
  var www = capot.www;
  var changes = capot.changes;
  var log = capot.log.child({ scope: 'capot.account' });
  var account = capot.account = new EventEmitter();
  var usersDb = couch.db('_users');
  var appDb = couch.db('app');


  function handleSignUp(userDoc) {
    var userDb = couch.db(userDoc.database);
    var capotId = userDoc.capotId;

    async.series([
      function (cb) {
        userDb.put(permissionsDdoc(capotId), cb);
      },
      function (cb) {
        userDb.addSecurity(securityDoc(capotId), cb);
      },
      function (cb) {
        appDb.put({
          _id: 'db/' + userDoc._id,
          type: 'db',
          database: userDoc.database,
          createdAt: new Date()
        }, cb);
      },
      function (cb) {
        userDoc.roles = roles(capotId);
        usersDb.put(userDoc, function (err, data) {
          if (err) { return cb(err); }
          userDoc._rev = data.rev;
          cb();
        });
      }
    ], function (err) {
      if (err) { return log.error(err); }
      account.emit('add', userDoc);
    });
  }


  function handleAccountDeletion(userDoc) {
    appDb.get('db/' + userDoc._id, function (err, dbDoc) {
      if (err) { return log.error(err); }
      couch.del(encodeURIComponent(dbDoc.database), function (err) {
        if (err) { return log.error(err); }
        appDb.remove(dbDoc, function (err) {
          if (err) { return log.error(err); }
          account.emit('remove', userDoc);
        });
      });
    });
  }


  changes.on('change', function (db, change) {
    // We only care about user docs..
    if (db !== '_users' || !/^org\.couchdb\.user:/.test(change.id)) { return; }

    var userDoc = change.doc;

    if (change.deleted) {
      handleAccountDeletion(userDoc);
    } else if (!userDoc.roles.length) {
      handleSignUp(userDoc);
    } else {
      account.emit('update', userDoc);
    }
  });


  function handlePassResetRequest(req, reply) {
    var baseurl = req.payload.baseurl;
    var userDocId = 'org.couchdb.user:' + req.payload.email;
    var userDocUrl = '/_users/' + encodeURIComponent(userDocId);

    function sendResetLink(userDoc) {
      capot.sendMail({
        to: userDoc.name,
        subject: 'Password reset',
        text: [
          'Hi there,',
          '',
          baseurl + '/_reset/' + userDoc.$reset.token
        ].join('\n')
      }, function (mailerErr, mailerResp) {
        userDoc.$reset.attempts.push({
          error: mailerErr,
          response: mailerResp
        });
        userDoc.$reset.updatedAt = new Date();
        usersDb.put(userDoc, function (err, data) {
          if (err) { return reply(err); }
          reply(mailerErr || data);
        });
      });
    }

    usersDb.get(userDocId, function (err, userDoc) {
      if (err) { return reply(Boom.notFound()); }

      // Check if we already have a reset token...
      if (userDoc.$reset && userDoc.$reset.createdAt &&
          moment(userDoc.$reset.createdAt).add(24, 'hours') >= Date.now()) {
        if (userDoc.$reset.attempts.length >= 3) {
          return reply(Boom.tooManyRequests(''));
        }
        return sendResetLink(userDoc);
      }

      userDoc.$reset = {
        createdAt: new Date(),
        email: userDoc.name,
        token: uid(40),
        attempts: []
      };

      usersDb.put(userDoc, function (err, data) {
        if (err) { return reply(err); }
        userDoc._rev = data.rev;
        sendResetLink(userDoc);
      });
    });
  }
  
  function handlePassResetConfirm(req, reply) {
    var token = req.params.token;
    usersDb.query('views/by_reset_token', { key: token }, function (err, data) {
      if (err) { return reply(err); }
      var row = data.rows.shift();
      if (!row || !row.id) { return reply(Boom.notFound()); }
      usersDb.get(row.id, function (err, userDoc) {
        if (err) { return reply(err); }
        // TODO: check that token is valid (hasnt expired, ...)
        userDoc.password = uid(10);
        userDoc.$reset = null;

        capot.sendMail({
          to: userDoc.name,
          subject: 'New password',
          text: userDoc.password
        }, function (mailerErr, mailerResp) {
          usersDb.put(userDoc, function (err, data) {
            reply(arguments);
          });
        });
      });
    });
  }

  www.route({
    method: 'POST',
    path: '/_reset',
    handler: handlePassResetRequest
  });

  www.route({
    method: 'GET',
    path: '/_reset/{token}',
    handler: handlePassResetConfirm
  });


  cb();

};

