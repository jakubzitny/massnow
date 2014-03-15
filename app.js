#!/usr/bin/env node

/**
 * MassNow  
 *
 * @author Jakub Zitny
 * @since Sat Mar 15 19:36:13 HKT 2014
 *
 */


/**
 * Deps.
 */
var cli = require('commander');
var express = require('express');
var path = require('path');
var http = require('http');

var common = require('./common');

// var Promise = require('es6-promise').Promise;
// var express = require('express.io');
// TODO explore https://github.com/techpines/express.io

/**
 * parse cli arguments and config
 */
cli
  .version('0.0.1')
  .option('-e, --env [mode]', 'Choose environment for webserver (development or production).', 'development')
  .option('-p, --prefetch', 'Run in prefetch mode.')
  .parse(process.argv);

var config = common.config();
var app = express();

if (cli.prefetch) {
  // do prefetch and don't run the server
}

if (cli.env == "development") {
  app.use(express.errorHandler());
}


/**
 * set up express
 */
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

/**
 * routes
 */
app.get('/', function(req, res){ 
  res.render('index', { title: 'MassNow' });
});

http.createServer(app).listen(config.port, function(){
  console.log('Express server listening on port ' + config.port + ' (' + config.env + ')..');
});

