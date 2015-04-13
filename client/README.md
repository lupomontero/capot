# Bonnet Client

This is the bare-bones front-end library (for a full blown experience check out [BonnetUI](./ui/)). This assumes you are using `browserify` to bundle your browser scripts.

```js
// ie: in your `main.js`
var Bonnet = require('bonnet/client');
var bonnet = Bonnet(options);
```

## Options

* `remote`: URL to backend HTTP API. Default is `/_api`.

***

## `bonnet.account`

### Methods

#### `bonnet.account.id()`

Get account `id`. Returns either a `String` or `null`.

```js
var id = bonnet.account.id();
```

#### `bonnet.account.signUp(email, pass)`

Create new user.

```js
bonnet.account.signUp(email, pass).then(function () {
  console.log('account created!');
});
```

#### `bonnet.account.signIn(email, id)`
#### `bonnet.account.signOut()`
#### `bonnet.account.changePassword(secret, newSecret)`
#### `bonnet.account.changeUsername(secret, newEmail)`
#### `bonnet.account.resetPassword(email)`
#### `bonnet.account.destroy()`
#### `bonnet.account.isSignedIn()`
#### `bonnet.account.isOnline()`
#### `bonnet.account.isOffline()`

### Events

#### `init`

This is emitted only once, when bonnet is started. At this point you can check `account.isSignedIn()`, `account.isOffline()` and so on.

#### `signin`

This is emitted when the session changes from anonymous to signed in. Note that this is not emitted on page load.

#### `signout`

This is emitted when the session changes from signed in to anonymous. Note that this is not emitted on page load.

#### `offline`

This is triggered when the session changes from online to offline. Note that this is not emitted on page load.

#### `online`

This is triggered when the session changes from offline to online. Note that this is not emitted on page load.

#### `error`

???

### Properties

#### `session`

```json
{
  "ok" : true,
  "userCtx" : {
    "name": "lupomontero@gmail.com",
    "roles": [
      "8mndu5c",
      "confirmed",
      "bonnet:read:user/8mndu5c",
      "bonnet:write:user/8mndu5c"
    ]
  },
  "info": {
    "authentication_handlers": ["cookie", "default"],
    "authentication_db": "_users",
    "authenticated": "cookie"
  },
  "isOnline": true
}
```

***

## `bonnet.store`

### Methods

#### `bonnet.store.find(type, id, options)`
#### `bonnet.store.findAll(type, options)`
#### `bonnet.store.add(type, attrs)`
#### `bonnet.store.update(type, id, attrs)`
#### `bonnet.store.remove(type, id)`
#### `bonnet.store.removeAll(type)`
#### `bonnet.store.attach(type, id, attachments)`
#### `bonnet.store.getAttachments(type, id)`
#### `bonnet.store.sync()`

### Events

#### `add`
#### `update`
#### `remove`
#### `change`???
#### `sync`
#### `sync:error`
#### `sync:paused`
#### `sync:active`
#### `sync:change`
#### `sync:complete`

***

## `bonnet.task`

### Methods

#### `bonnet.task.start(type, attrs)`
#### `bonnet.task.abort(type, id)`
#### `bonnet.task.restart(type, id, extraAttrs)`
#### `bonnet.task.restartAll()`

### Events

#### `start`
#### `abort`
#### `restart`
