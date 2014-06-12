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

/**
 * set up express middleware
 */
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var favicon = require('serve-favicon');
//var urlencoded = require('urlencode');
//var router = require('router');


function errorHandler(err, req, res, next) {
  res.status(500);
  res.render('error', { error: err });
}

function clientErrorHandler(err, req, res, next) {
  if (req.xhr) {
    res.send(500, { error: 'Something blew up!' });
  } else {
    next(err);
  }
}

function logErrors(err, req, res, next) {
  console.error(err.stack);
  next(err);
}

/**
 * set up express
 */
//app.use(logger('dev'));
//app.use(json());
//app.use(urlencode());

app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(bodyParser());
app.use(methodOverride());
//app.use(favicon());
app.use(express.static(path.join(__dirname, 'public')));
app.use(logErrors);
app.use(clientErrorHandler);

if (cli.env == "development") {
  app.use(errorHandler);
}

/**
 * couch config
 */
var dbUrl = "http://" + config["var"].db.credentials.username + ":" +
  config["var"].db.credentials.password + "@" +
  config["var"].db.host + ":" + config["var"].db.port;
var nano = require('nano')(dbUrl);
var dbName = config["var"].db.name;
var db = nano.use(dbName);

/**
 * es config
 */
var es = require('elasticsearch');
var esc = new es.Client({
  host: 'http://couch.zitny.eu:9200'
});

/**
 * routes
 */
app.get('/', function(req, res){ 
  res.render('index', {
  });
});

app.get('/search', function(req, res){ 
  var query = req.query.search;
  // query ref at http://goo.gl/w0v7y and http://goo.gl/RzIHet
  esc.search({
    index: "massnow_t",
    size: 50,
    body: {
      query: {
        query_string: {
          query: query,
          default_field: "name"
        }
      }
    }
  }).then(function (resp) {
    console.log("found " + resp.hits.hits.length + " for " + query);
    res.render('search', {
      query: query,
      hits: resp.hits.hits
    });
  });
});

app.get('/browse', function(req, res){ 
  db.list({"include_docs": true}, function(err, body) {
    if (!err) {
      res.render('browse', {
        docs: body.rows
      });
    }
  });
});

app.get('/church', function(req, res){ 
  db.get(req.query.id, { revs_info: true }, function(err, body) {
    if (!err)
      res.render('church', {
        church: body
      });
  });
});

http.createServer(app).listen(config.port, function(){
  console.log('Express server listening on port ' + config.port + ' (' + config.env + ')..');
});

