'use strict';


const OAuth = require('oauth').OAuth;


const internals = {};


internals.apiUrl = 'https://api.twitter.com/oauth';


internals.createClient = function (options) {

  return new OAuth(
    internals.apiUrl + '/request_token',
    internals.apiUrl + '/access_token',
    options.key,                // client id
    options.secret,             // client secret
    '1.0A',
    options.baseurl + '/_oauth/callback/twitter',
    'HMAC-SHA1'
  );
};


module.exports = function (options) {

  return {

    authenticate: function (req, cb) {

      //const id = req.query.id;
      const oauth = internals.createClient(options);

      oauth.getOAuthRequestToken((err, token, tokenSecret, results) => {

        if (err) {
          return cb(err);
        }

        cb(null, internals.apiUrl + '/authenticate?oauth_token=' + token, {
          token: token,
          tokenSecret: tokenSecret
        });
      });
    },

    callback: function (req, cb) {

      const error = req.query.error;
      const cred = req.auth.credentials;

      if (!cred.data) {
        return cb(new Error('No credentials'));
      }

      const reqToken = cred.data.token;
      const reqTokenSecret = cred.data.tokenSecret;
      const verifier = req.query.oauth_verifier;

      // If github passed an error in query string we don't bother continuing
      // with the OAuth dance.
      if (error) {
        const err = new Error(req.query.error_description);
        err.reason = error;
        err.code = error;
        return cb(err);
      }

      // If no `oauth_token` is passed in request it means the user did not
      // authorise the app.
      if (!req.query.oauth_token) {
        return cb(null, { connected: false });
      }

      if (req.query.oauth_token !== reqToken) {
        return cb(new Error('OAuth token mismatch'));
      }

      const oauth = internals.createClient(options);
      oauth.getOAuthAccessToken(reqToken, reqTokenSecret, verifier, (err, accessToken, accessTokenSecret, results) => {

        if (err) {
          return cb(err);
        }

        cb(null, {
          connected: true,
          uid: results.user_id,
          access_token: accessToken,
          access_token_secret: accessTokenSecret,
          profile: results
        });
      });
    }

  };
};

