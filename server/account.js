var EventEmitter = require('events').EventEmitter;

module.exports = function (bonnet, cb) {

  var account = bonnet.account = new EventEmitter();
  var usersDb = bonnet.couch.db('_users');


  function handleSignUp(userDoc) {
    var userDb = bonnet.couch.db(userDoc.database);
    var permissionsDdoc = {
      _id: '_design/permissions',
      language: 'javascript',
      validate_doc_update: [
        'function (newDoc, oldDoc, userCtx) {',
        '  for (var i = 0; i < userCtx.roles.length; i++) {',
        '    var r = userCtx.roles[i];',
        '    if (r === "bonnet:write:user/' + userDoc.bonnetId + '" || r === "_admin") {',
        '      return;',
        '    }',
        '  }',
        '  throw {unauthorized: "You are not authorized to write to this database"};',
        '}'
      ].join('\n')
    };

    userDb.put(permissionsDdoc, function (err) {
      if (err) {
        return console.error('Error adding permissions design doc to user db', userDoc, err);
      }
      userDoc.roles = [
        userDoc.bonnetId,
        'confirmed',
        'bonnet:read:user/' + userDoc.bonnetId,
        'bonnet:write:user/' + userDoc.bonnetId
      ];
      usersDb.put(userDoc, function (err, data) {
        if (err) {
          console.error('Error updating user roles', userDoc, err);
        }
        userDoc._rev = data.rev;
        account.emit('add', userDoc);
      });
    });
  }


  function handleAccountDeletion(userDoc) {
    console.log('delete account', userDoc);
    account.emit('remove', userDoc);
  }


  var changes = usersDb.changes({
    include_docs: true,
    live: true
  });

  changes.on('change', function (change) {
    // Ignore design docs.
    if (/^_design\//.test(change.id)) { return; }

    var userDoc = change.doc;

    if (userDoc.type !== 'user') { return; }

    if (change.deleted) {
      handleAccountDeletion(userDoc);
    } else if (!userDoc.roles.length) {
      handleSignUp(userDoc);
    } else {
      account.emit('update', userDoc);
    }
  });

  cb();

};

