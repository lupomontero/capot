var Hapi = require('hapi');
var path = require('path');


module.exports = function (bonnet, cb) {

  var config = bonnet.config;

  var server = bonnet.www = new Hapi.Server({
    connections: {
      routes: {
        payload: {
          maxBytes: 1048576 * 5 // 5Mb
        }
      }
    }
  });

  server.connection({ port: config.port });


  var apiHandler = {
    proxy: {
      passThrough: true,
      mapUri: function (req, cb) {
        cb(null, config.couchdb.url + req.url.path.substr(5), req.headers);
      }
    }
  };

  // Register `_api` methods as individual routes, otherwise proxy doesn't seem
  // to work as expected.
  [ 'GET', 'POST', 'PUT', 'DELETE' ].forEach(function (method) {
    server.route({ method: method, path: '/_api/{p*}', handler: apiHandler });
  });


  server.route({
    method: 'GET',
    path: '/{p*}',
    handler: {
      directory: {
        path: config.www || 'www'
      }
    }
  });


  // Redirect 404s for HTML docs to index.
  server.ext('onPostHandler', function (req, reply) {
    var resp = req.response;

    if (!resp.isBoom) { return reply.continue(); }

    var is404 = (resp.output.statusCode === 404);
    var isHTML = /text\/html/.test(req.headers.accept);

    // We only care about 404 for html requests...
    if (!is404 || !isHTML) { return reply.continue(); }

    var path = req.url.path.replace(/^\//, '');
    var prefix = '/';
    if (/^_admin/.test(path)) {
      prefix = '/_admin/';
      path = path.replace(/^_admin\//, '');
    }

    reply.redirect(prefix + '#' + path);
  });


  server.start(function () {
    bonnet.log.info('Web server started on port ' + config.port);
    cb();
  });

};

