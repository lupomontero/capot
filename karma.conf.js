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
      'test/client/account.spec.js'
    ],

    preprocessors: {
      'test/client/*.js': ['browserify']
    },

    reporters: ['mocha'],

    client: {
      mocha: {
        reporter: 'tap'
      }
    },

    plugins: [
      'karma-browserify',
      'karma-mocha',
      'karma-mocha-reporter',
      'karma-phantomjs-launcher'
    ]

  });

};

