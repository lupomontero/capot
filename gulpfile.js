var Path = require('path');
var Gulp = require('gulp');
var Concat = require('gulp-concat');
var Declare = require('gulp-declare');
var Favicons = require('favicons');
var Handlebars = require('gulp-handlebars');
var Jshint = require('gulp-jshint');
var Mocha = require('gulp-mocha');
var Rename = require('gulp-rename');
var Uglify = require('gulp-uglify');
var Gutil = require('gulp-util');
var Wrap = require('gulp-wrap');
var Merge = require('merge-stream');
var Browserify = require('browserify');
var Source = require('vinyl-source-stream');
var Buffer = require('vinyl-buffer');
var Karma = require('karma');
var _ = require('lodash');


var Pkg = require('./package.json');


var internals = {};


internals.components = {
  client: {
    files: 'client/*.js',
    main: './client/index.js',
    dest: 'dist/capot.js',
    tests: 'test/client/**/*.spec.js'
  },
  ui: {
    files: 'client/ui/*.js',
    main: './client/ui/index.js',
    dest: 'dist/capot-ui.js'
  },
  admin: {
    files: 'admin/**/*.js',
    main: './admin/main.js',
    dest: 'admin/bundle.js'
  },
  server: {
    files: [ 'bin/**/*.js', 'server/**/*.js' ],
    tests: 'test/server/**/*.spec.js'
  }
};


internals.bundle = function (bundler, dest) {

  var parts = dest.split('/');
  var name = parts.pop();
  var dir = parts.join('/');

  bundler.ignore('jquery');

  return bundler.bundle()
    .on('error', Gutil.log.bind(Gutil, 'Browserify Error'))
    .pipe(Source(name))
    .pipe(Buffer())
    .pipe(Gulp.dest(dir))
    .pipe(Uglify())
    .pipe(Rename({ extname: '.min.js' }))
    .pipe(Gulp.dest(dir));
};


Gulp.task('lint:client', function () {

  return Gulp.src([
    internals.components.client.files,
    internals.components.client.tests
  ])
    .pipe(Jshint({ predef: [ '-Promise' ] }))
    .pipe(Jshint.reporter('jshint-stylish'));
});


Gulp.task('lint:ui', function () {

  return Gulp.src(internals.components.ui.files)
    .pipe(Jshint({ predef: [ '-Promise' ] }))
    .pipe(Jshint.reporter('jshint-stylish'));
});


Gulp.task('lint:admin', function () {

  return Gulp.src(internals.components.admin.files)
    .pipe(Jshint({ predef: [ '-Promise' ] }))
    .pipe(Jshint.reporter('jshint-stylish'));
});


Gulp.task('lint:server', function () {

  return Gulp.src(internals.components.server.files.concat(internals.components.server.tests))
    .pipe(Jshint({ predef: [ '-Promise' ] }))
    .pipe(Jshint.reporter('jshint-stylish'));
});


Gulp.task('lint', [ 'lint:client', 'lint:ui', 'lint:admin', 'lint:server' ]);


Gulp.task('test:client', [ 'lint:client' ], function (done) {

  var server = new Karma.Server({
    configFile: __dirname + '/karma.conf.js',
    singleRun: true
  }, done);

  server.start();
});


Gulp.task('test:server', [ 'lint:server' ], function () {

  return Gulp.src(internals.components.server.tests, { read: false })
    .pipe(Mocha());
});


Gulp.task('test', [ 'test:client', 'test:server' ]);


Gulp.task('hbs:admin', function () {

  var partialsWrapper = [
    'Handlebars.registerPartial(',
    '<%= processPartialName(file.relative) %>, ',
    'Handlebars.template(<%= contents %>)',
    ');'
  ].join('');

  var partials = Gulp.src('admin/templates/_*.hbs')
    .pipe(Handlebars({ handlebars: require('handlebars') }))
    .pipe(Wrap(partialsWrapper, {}, {
      imports: {
        processPartialName: function (fileName) {

          // Strip the extension and the underscore
          // Escape the output with JSON.stringify
          return JSON.stringify(Path.basename(fileName, '.js').substr(1));
        }
      }
    }));

  var templates = Gulp.src('admin/templates/**/[^_]*.hbs')
    .pipe(Handlebars({ handlebars: require('handlebars') }))
    .pipe(Wrap('Handlebars.template(<%= contents %>)'))
    .pipe(Declare({
      namespace: 'templates',
      noRedeclare: true, // Avoid duplicate declarations
      processName: function (filePath) {

        return Declare.processNameByPath(filePath.replace('admin/templates/', ''));
      }
    }));

  return Merge(partials, templates)
    .pipe(Concat('templates.js'))
    .pipe(Gulp.dest('admin'));
});


Gulp.task('build:client', [ 'test:client' ], function () {

  var bundler = Browserify(internals.components.client.main, {
    standalone: 'Capot'
  });

  return internals.bundle(bundler, internals.components.client.dest);
});


Gulp.task('build:ui', [ 'lint:ui' ], function () {

  var bundler = Browserify(internals.components.ui.main, {
    standalone: 'CapotUI'
  });

  return internals.bundle(bundler, internals.components.ui.dest);
});


Gulp.task('build:admin', [ 'lint:admin', 'hbs:admin' ], function () {

  var bundler = Browserify(internals.components.admin.main);
  return internals.bundle(bundler, internals.components.admin.dest);
});


Gulp.task('build', [ 'build:client', 'build:ui', 'build:admin' ]);


Gulp.task('favicons', function (done) {

  Favicons({
    files: {
      src: 'admin/icon.png',
      dest: 'admin/favicons',
      html: 'admin/index.html'
    },
    settings: {
      appName: Pkg.name,
      appDescription: Pkg.description,
      version: Pkg.version,
      developer: 'Lupo Montero',
      developerURL: 'http://lupomontero.com',
      index: '/',
      url: 'http://lupomontero.github.io/capot/'
    }
  }, done);
});


Gulp.task('watch', function () {

  Gulp.watch([
    internals.components.client.files,
    internals.components.client.tests
  ], [ 'build:client' ]);

  Gulp.watch(internals.components.ui.files, [ 'build:ui' ]);

  Gulp.watch([
    internals.components.server.files,
    internals.components.server.tests
  ], [ 'test:server' ]);

  Gulp.watch([
    'admin/main.js',
    'admin/collections/**/*.js',
    'admin/models/**/*.js',
    'admin/util/**/*.js',
    'admin/views/**/*.js',
    'admin/templates/**/*.hbs'
  ], [ 'build:admin' ]);
});


Gulp.task('default', [ 'build' ]);

