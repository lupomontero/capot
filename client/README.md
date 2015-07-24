# Capot Client

This is the bare-bones front-end library (for a full blown experience check out [CapotUI](./ui/)). This assumes you are using `browserify` to bundle your browser scripts.

```js
// ie: in your `main.js`
var Capot = require('capot/client');
var capot = Capot(options);
```

## Options

* `remote`: URL to backend HTTP API. Default is `/_couch`.

***

## `capot.account`

### Methods

#### `capot.account.id()`

Get account `id`. Returns either a `String` or `null`.

```js
var id = capot.account.id();
```

#### `capot.account.signUp(email, pass)`

Create new user.

```js
capot.account.signUp(email, pass).then(function () {
  console.log('account created!');
});
```

#### `capot.account.signIn(email, id)`
#### `capot.account.signOut()`
#### `capot.account.changePassword(secret, newSecret)`
#### `capot.account.changeUsername(secret, newEmail)`
#### `capot.account.resetPassword(email)`
#### `capot.account.destroy()`
#### `capot.account.isSignedIn()`
#### `capot.account.isOnline()`
#### `capot.account.isOffline()`

### Events

#### `init`

This is emitted only once, when capot is started. At this point you can check `account.isSignedIn()`, `account.isOffline()` and so on.

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
      "capot:read:user/8mndu5c",
      "capot:write:user/8mndu5c"
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

## `capot.store`

### Methods

#### `capot.store.find(type, id, options)`
#### `capot.store.findAll(type, options)`
#### `capot.store.add(type, attrs)`
#### `capot.store.update(type, id, attrs)`
#### `capot.store.remove(type, id)`
#### `capot.store.removeAll(type)`
#### `capot.store.attach(type, id, attachments)`
#### `capot.store.getAttachments(type, id)`
#### `capot.store.sync()`

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

## `capot.task`

### Methods

#### `capot.task.start(type, attrs)`
#### `capot.task.abort(type, id)`
#### `capot.task.restart(type, id, extraAttrs)`
#### `capot.task.restartAll()`

### Events

#### `start`
#### `abort`
#### `restart`
