var gulp = require('gulp');
var gutil = require('gulp-util');
var jshint = require('gulp-jshint');
var mocha = require('gulp-mocha');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var browserify = require('browserify');
var karma = require('karma').server;
var _ = require('lodash');


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


gulp.task('build:client', [ 'test:client' ], function () {
  var bundler = browserify(components.client.main, { standalone: 'Capot' });
  return bundle(bundler, components.client.dest);
});

gulp.task('build:ui', [ 'lint:ui' ], function () {
  var bundler = browserify(components.ui.main, { standalone: 'CapotUI' });
  return bundle(bundler, components.ui.dest);
});

gulp.task('build:admin', [ 'lint:admin' ], function () {
  var bundler = browserify(components.admin.main);
  return bundle(bundler, components.admin.dest);
});

gulp.task('build', [ 'build:client', 'build:ui', 'build:admin' ]);


gulp.task('watch', function () {
  gulp.watch([ components.client.files, components.client.tests ], [ 'build:client' ]);
  gulp.watch(components.ui.files, [ 'build:ui' ]);
  gulp.watch(components.admin.files, [ 'build:admin' ]);
  gulp.watch([ components.server.files, components.server.tests ], [ 'test:server' ]);
});


gulp.task('default', [ 'test:server', 'build' ]);

