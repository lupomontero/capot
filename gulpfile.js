var path = require('path');
var gulp = require('gulp');
var concat = require('gulp-concat');
var declare = require('gulp-declare');
var favicons = require('favicons');
var handlebars = require('gulp-handlebars');
var imagemin = require('gulp-imagemin');
var jshint = require('gulp-jshint');
var manifest = require('gulp-manifest');
var mocha = require('gulp-mocha');
var rename = require('gulp-rename');
var replace = require('gulp-replace');
var uglify = require('gulp-uglify');
var gutil = require('gulp-util');
var wrap = require('gulp-wrap');
var merge = require('merge-stream');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var karma = require('karma').server;
var _ = require('lodash');


var pkg = require('./package.json');


var components = {
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


function bundle(bundler, dest) {
  var parts = dest.split('/');
  var name = parts.pop();
  var dir = parts.join('/');
  return bundler.bundle()
    .on('error', gutil.log.bind(gutil, 'Browserify Error'))
    .pipe(source(name))
    .pipe(buffer())
    .pipe(gulp.dest(dir))
    .pipe(uglify())
    .pipe(rename({ extname: '.min.js' }))
    .pipe(gulp.dest(dir));
}


gulp.task('lint:client', function () {
  return gulp.src([ components.client.files, components.client.tests ])
    .pipe(jshint({ predef: [ '-Promise' ] }))
    .pipe(jshint.reporter('jshint-stylish'));
});

gulp.task('lint:ui', function () {
  return gulp.src(components.ui.files)
    .pipe(jshint({ predef: [ '-Promise' ] }))
    .pipe(jshint.reporter('jshint-stylish'));
});

gulp.task('lint:admin', function () {
  return gulp.src(components.admin.files)
    .pipe(jshint({ predef: [ '-Promise' ] }))
    .pipe(jshint.reporter('jshint-stylish'));
});

gulp.task('lint:server', function () {
  return gulp.src(components.server.files.concat(components.server.tests))
    .pipe(jshint({ predef: [ '-Promise' ] }))
    .pipe(jshint.reporter('jshint-stylish'));
});

gulp.task('lint', [ 'lint:client', 'lint:ui', 'lint:admin', 'lint:server' ]);


gulp.task('test:client', [ 'lint:client' ], function (done) {
  karma.start({
    configFile: __dirname + '/karma.conf.js',
    singleRun: true
  }, done);
});

gulp.task('test:server', [ 'lint:server' ], function () {
  return gulp.src(components.server.tests, { read: false }).pipe(mocha());
});

gulp.task('test', [ 'test:client', 'test:server' ]);


gulp.task('hbs:admin', function () {
  var partialsWrapper = [
    'Handlebars.registerPartial(',
    '<%= processPartialName(file.relative) %>, ',
    'Handlebars.template(<%= contents %>)',
    ');'
  ].join('');

  var partials = gulp.src('admin/templates/_*.hbs')
    .pipe(handlebars({ handlebars: require('handlebars') }))
    .pipe(wrap(partialsWrapper, {}, {
      imports: {
        processPartialName: function(fileName) {
          // Strip the extension and the underscore
          // Escape the output with JSON.stringify
          return JSON.stringify(path.basename(fileName, '.js').substr(1));
        }
      }
    }));

  var templates = gulp.src('admin/templates/**/[^_]*.hbs')
    .pipe(handlebars({ handlebars: require('handlebars') }))
    .pipe(wrap('Handlebars.template(<%= contents %>)'))
    .pipe(declare({
      namespace: 'templates',
      noRedeclare: true, // Avoid duplicate declarations
      processName: function (filePath) {
        return declare.processNameByPath(filePath.replace('admin/templates/', ''));
      }
    }));

  return merge(partials, templates)
    .pipe(concat('templates.js'))
    .pipe(gulp.dest('admin'));
});



gulp.task('build:client', [ 'test:client' ], function () {
  var bundler = browserify(components.client.main, { standalone: 'Capot' });
  return bundle(bundler, components.client.dest);
});

gulp.task('build:ui', [ 'lint:ui' ], function () {
  var bundler = browserify(components.ui.main, { standalone: 'CapotUI' });
  return bundle(bundler, components.ui.dest);
});

gulp.task('build:admin', [ 'lint:admin', 'hbs:admin' ], function () {
  var bundler = browserify(components.admin.main);
  return bundle(bundler, components.admin.dest);
});

gulp.task('build', [ 'build:client', 'build:ui', 'build:admin' ]);


gulp.task('favicons', function (done) {
  favicons({
    files: {
      src: 'admin/icon.png',
      dest: 'admin/favicons',
      html: 'admin/index.html'
    },
    settings: {
      appName: pkg.name,
      appDescription: pkg.description,
      version: pkg.version,
      developer: 'Lupo Montero',
      developerURL: 'http://lupomontero.com',
      index: '/',
      url: 'http://lupomontero.github.io/capot/'
    }
  }, done);
});


gulp.task('watch', function () {
  gulp.watch([ components.client.files, components.client.tests ], [ 'build:client' ]);
  gulp.watch(components.ui.files, [ 'build:ui' ]);
  gulp.watch([ components.server.files, components.server.tests ], [ 'test:server' ]);
  gulp.watch([
    'admin/main.js',
    'admin/collections/**/*.js',
    'admin/models/**/*.js',
    'admin/util/**/*.js',
    'admin/views/**/*.js',
    'admin/templates/**/*.hbs'
  ], [ 'build:admin' ]);
});


gulp.task('default', [ 'test:server', 'build' ]);

