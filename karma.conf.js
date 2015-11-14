'use strict';


module.exports = function (config) {

  config.set({

    frameworks: ['browserify', 'mocha'],

    browsers: ['PhantomJS'],

    files: [
      // Function.prototype.bind is missing in PhantomJS, so we add polyfill.
      // See:
      // https://github.com/ariya/phantomjs/issues/10522
      // Taken from:
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind#Polyfill
      'test/client/vendor/bind-polyfill.js',
      'test/client/vendor/jquery.min.js',
      'test/client/vendor/jquery.mockjax.js',
      'test/client/*.spec.js'
    ],

    preprocessors: {
      'test/client/*.js': ['browserify']
    },

    browserify: {
      debug: true
    },

    reporters: ['mocha'],

    client: {
      mocha: {
        reporter: 'tap'
      }
    },

    urlRoot: '/__karma__/',

    proxies: {
      '/': 'http://127.0.0.1:3333'
    },

    plugins: [
      'karma-browserify',
      'karma-mocha',
      'karma-mocha-reporter',
      'karma-phantomjs-launcher'
    ]

  });

};

