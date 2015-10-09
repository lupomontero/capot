var OAuth = require('oauth').OAuth;


var internals = {};


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

      var id = req.query.id;
      var oauth = internals.createClient(options);

      oauth.getOAuthRequestToken(function (err, token, tokenSecret, results) {

        if (err) { return cb(err); }

        cb(null, internals.apiUrl + '/authenticate?oauth_token=' + token, {
          token: token,
          tokenSecret: tokenSecret
        });
      });
    },

    callback: function (req, cb) {

      var provider = this;
      var error = req.query.error;
      var code = req.query.code;
      var cred = req.auth.credentials;

      if (!cred.data) { return cb(new Error('No credentials')); }

      var reqToken = cred.data.token;
      var reqTokenSecret = cred.data.tokenSecret;
      var verifier = req.query.oauth_verifier;

      // If github passed an error in query string we don't bother continuing
      // with the OAuth dance.
      if (error) {
        var err = new Error(req.query.error_description);
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

      var oauth = internals.createClient(options);
      oauth.getOAuthAccessToken(reqToken, reqTokenSecret, verifier, function (err, accessToken, accessTokenSecret, results) {

        if (err) { return cb(err); }
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

