# Capot Server

* Static files (`/`)
* HTTP API (`/_api`)
* Admin interface (`/_admin`)
* CouchDB proxy (`/_couch`)

## HTTP API

* `POST /session`
* `DELETE /session`
* `GET /session`
* `GET /info`
* `GET /users`
* `GET /users/:id_or_email`
* `PUT /users/:email`
* `POST /users/:id/_reset`
* `GET /users/:id/_reset/:token`
* `DELETE /users/:id_or_email`

### Authentication

These routes are proxied directly to CouchDB's `/_session` API.

#### Create session (cookie sign in)

`POST /session`

#### Close user session

`DELETE /session`

#### Get session

`GET /session`

### API info

`GET /info`

### Accounts API

#### List users (admin only)

`GET /users`

#### Get single user (users can get their own profile and admins any)

`GET /users/:id`

`GET /users/:email`

#### Create (sign up) or update user

`PUT /users/:email`

#### Request password reset

`POST /users/:id/_reset`

#### Confirm password request

`GET /users/:id/_reset/:token`
