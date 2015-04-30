#!/usr/bin/env node

var minimist = require('minimist');
var pkg = require('../package.json');
var argv = minimist(process.argv.slice(2));
var cmd = argv._.shift();


// Show version if asked to do so.
if (argv.v || argv.version) {
  console.log(pkg.version);
  process.exit(0);
}


// Show help if applicable.
if (argv.h || argv.help || !cmd || cmd === 'help') {
  console.log([
    '',
    'Usage:',
    '',
    pkg.name + ' <cmd> [ <options> ]',
    '',
    'Commands:',
    '',
    'start            Start ' + pkg.name + ' server.',
    '',
    'Options:',
    '',
    '--port           Port to start server on.',
    '--www            Path to directory to be served by the web server.',
    '--data           Path to data directory (if using built-in PouchDB server)',
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


if (cmd === 'start') {

  require('../server')(argv);

} else {

  console.log('ha');

}

