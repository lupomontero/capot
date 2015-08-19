#!/usr/bin/env node

var minimist = require('minimist');
var pkg = require('../package.json');
var argv = minimist(process.argv.slice(2));


// Show version if asked to do so.
if (argv.v || argv.version) {
  console.log(pkg.version);
  process.exit(0);
}


// Show help if applicable.
if (argv.h || argv.help) {
  console.log([
    '',
    'Usage:',
    '',
    pkg.name + ' [ <options> ]',
    '',
    'Options:',
    '',
    '--port           Port to start server on.',
    '--www            Path to directory to be served by the web server.',
    '--data           Path to data directory (if using built-in PouchDB server)',
    '--debug          Switch on verbose logging and long stack traces.',
    '',
    'Environment Variables',
    '',
    'COUCHDB_URL',
    'COUCHDB_USER',
    'COUCHDB_PASS',
    '',
    '-h, --help       Show this help.',
    '-v, --version    Show ' + pkg.name + ' version.',
    ''
  ].join('\n'));
  process.exit(0);
}


require('../server')(argv);

