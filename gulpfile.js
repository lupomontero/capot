'use strict';


const Path = require('path');
const Gulp = require('gulp');
const Concat = require('gulp-concat');
const Declare = require('gulp-declare');
const Eslint = require('gulp-eslint');
const Favicons = require('gulp-favicons');
const Handlebars = require('gulp-handlebars');
const Mocha = require('gulp-mocha');
const Rename = require('gulp-rename');
const Uglify = require('gulp-uglify');
const Gutil = require('gulp-util');
const Wrap = require('gulp-wrap');
const Merge = require('merge-stream');
const Browserify = require('browserify');
const Source = require('vinyl-source-stream');
const Buffer = require('vinyl-buffer');
const Karma = require('karma');
const Pkg = require('./package.json');
const TestServer = require('./test/server');


const internals = {};


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
  server: {
    files: ['bin/**/*.js', 'server/**/*.js'],
    tests: 'test/server/**/*.spec.js'
  }
};


internals.bundle = function (bundler, dest) {

  const parts = dest.split('/');
  const name = parts.pop();
  const dir = parts.join('/');

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


Gulp.task('lint', () => {

  return Gulp.src(['**/*.js'])
    .pipe(Eslint({
      rules: {
        'object-shorthand': 0
      }
    }))
    .pipe(Eslint.format())
    .pipe(Eslint.failAfterError());
});


Gulp.task('test:client', (done) => {

  TestServer({}, (err, server) => {

    if (err) {
      return done(err);
    }

    server.start((err) => {

      if (err) {
        return done(err);
      }

      process.env.TESTUSER_1_EMAIL = server.testUsers[0].email;
      process.env.TESTUSER_1_PASSWORD = server.testUsers[0].password;

      const karma = new Karma.Server({
        configFile: __dirname + '/karma.conf.js',
        singleRun: true
      }, (exitCode) => {

        server.stop(() => {

          if (exitCode) {
            process.exit(exitCode);
          }

          process.exit(0);
        });
      });

      karma.start();
    });
  });
});


Gulp.task('test:server', () => {

  return Gulp.src(internals.components.server.tests, { read: false })
    .pipe(Mocha())
    .once('end', () => {

      process.exit();
    });
});


Gulp.task('hbs:admin', () => {

  const partialsWrapper = [
    'Handlebars.registerPartial(',
    '<%= processPartialName(file.relative) %>, ',
    'Handlebars.template(<%= contents %>)',
    ');'
  ].join('');

  const partials = Gulp.src('admin/templates/_*.hbs')
    .pipe(Handlebars({ handlebars: require('handlebars') }))
    .pipe(Wrap(partialsWrapper, {}, {
      processPartialName: function (fileName) {

        // Strip the extension and the underscore
        // Escape the output with JSON.stringify
        return JSON.stringify(Path.basename(fileName, '.js').substr(1));
      }
    }));

  const templates = Gulp.src('admin/templates/**/[^_]*.hbs')
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


Gulp.task('build:client', () => {

  const bundler = Browserify(internals.components.client.main, {
    standalone: 'Capot'
  });

  return internals.bundle(bundler, internals.components.client.dest);
});


Gulp.task('build:ui', () => {

  const bundler = Browserify(internals.components.ui.main, {
    standalone: 'CapotUI'
  });

  return internals.bundle(bundler, internals.components.ui.dest);
});


Gulp.task('build:admin', ['hbs:admin'], () => {

  const bundler = Browserify('./admin/main.js');
  return internals.bundle(bundler, 'admin/bundle.js');
});


Gulp.task('build', ['build:client', 'build:ui', 'build:admin']);


Gulp.task('favicons', () => {

  return Gulp.src('admin/icon.png')
    .pipe(Favicons({
      html: 'admin/index.html',
      appName: Pkg.name,
      appDescription: Pkg.description,
      version: Pkg.version,
      developerName: Pkg.author.name,
      developerURL: Pkg.author.url,
      index: '/',
      url: Pkg.homepage,
      path: 'favicons/'
    }))
    .pipe(Gulp.dest('admin/favicons'));
});


Gulp.task('watch', () => {

  Gulp.watch([
    internals.components.client.files,
    internals.components.client.tests
  ], ['test:client']);

  Gulp.watch([
    internals.components.server.files,
    internals.components.server.tests
  ], ['test:server']);

  Gulp.watch(internals.components.ui.files, ['build:ui']);

  Gulp.watch([
    'admin/main.js',
    'admin/collections/**/*.js',
    'admin/models/**/*.js',
    'admin/util/**/*.js',
    'admin/views/**/*.js',
    'admin/templates/**/*.hbs'
  ], ['build:admin']);
});


Gulp.task('default', ['build']);
