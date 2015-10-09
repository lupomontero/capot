var OAuth2 = require('oauth').OAuth2;


var internals = {};


internals.createClient = function (options, endpoint) {

  return new OAuth2(
    options.key,                // client id
    options.secret,             // client secret
    endpoint,      // baseUrl
    'login/oauth/authorize',    // authorize path
    'login/oauth/access_token', // access token path
    null                        // custom headers
  );

};


module.exports = function (options) {

  return {
  
    authenticate: function (req, cb) {

      var id = req.query.id;
      var oauth2 = internals.createClient(options, 'https://github.com/');
      var authUrl = oauth2.getAuthorizeUrl({
        redirect_uri: options.baseurl + '/_oauth/callback/github',
        scope: (options.scopes || []).join(','),
        state: 'some random string?'
      });

      cb(null, authUrl);
    },

    callback: function (req, cb) {

      var provider = this;
      var code = req.query.code;
      var error = req.query.error;

      // If github passed an error in query string we don't bother continuing
      // with the OAuth dance.
      if (error) {
        return cb(null, {
          connected: false,
          error: {
            message: req.query.error_description,
            reason: error,
            code: error,
            uri: req.query.error_uri
          }
        });
      }

      var oauth2 = internals.createClient(options, 'https://github.com/');
      oauth2.getOAuthAccessToken(code, {
        redirect_uri: options.baseurl + '/_oauth/callback/github'
      }, function (err, accessToken, refreshToken, results) {

        if (err) { return cb(err); }

        // get uid?
        provider.profile(accessToken, function (err, profile) {

          if (err) { return cb(err); }

          cb(null, {
            connected: true,
            uid: profile.id,
            access_token: accessToken,
            profile: profile
          });
        });
      });
    },

    profile: function (accessToken, cb) {

      var oauth2 = internals.createClient(options, 'https://api.github.com/');
      oauth2.get('https://api.github.com/user', accessToken, function (err, resp) {

        if (err) { return cb(err); }

        try {
          var profile = JSON.parse(resp);
          cb(null, profile);
        } catch (ex) {
          cb(new Error('Error parsing OAuth user profile'));
        }
      });
    }

  };
};

