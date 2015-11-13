#!/usr/bin/env node

'use strict';


const Minimist = require('minimist');
const Pkg = require('../package.json');
const Server = require('../server');


const internals = {};


internals.argv = Minimist(process.argv.slice(2));


// Show version if asked to do so.
if (internals.argv.v || internals.argv.version) {
  console.log(Pkg.version);
  process.exit(0);
}


// Show help if applicable.
if (internals.argv.h || internals.argv.help) {
  console.log([
    '',
    'Usage:',
    '',
    Pkg.name + ' [ <options> ]',
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
    '-v, --version    Show ' + Pkg.name + ' version.',
    ''
  ].join('\n'));
  process.exit(0);
}


Server(internals.argv);

