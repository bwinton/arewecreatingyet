/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true,
   strict:true, undef:true, unused:true, curly:true, browser:true, white:true,
   moz:true, esnext:false, indent:2, maxerr:50, devel:true, node:true, boss:true,
   globalstrict:true, nomen:false, newcap:false */

'use strict';

/**
 * Module dependencies.
 */

var app_log = require('debug')('foxograph:app');
var request_log = require('debug')('foxograph:request');
var ejs = require('ejs');
var express = require('express');
var mongoose = require('mongoose');
var routes = require('./routes');
var url = require('url');

var app = module.exports = express();
var server = require('http').createServer(app);

var logTmpl = ejs.compile('<%= date %> (<%= response_time %>ms): ' +
                          '<%= status %> <%= method %> <%= url %>');

// Configuration

var mongo_url = 'mongodb://localhost/my_database';
if (process.env.VCAP_SERVICES) {
  var services = JSON.parse(process.env.VCAP_SERVICES);
  var mongo_data = services.mongodb[0].credentials;
  mongo_url = 'mongodb://' + mongo_data.username + ':' + mongo_data.password +
              '@' + mongo_data.host + ':' + mongo_data.port + '/' + mongo_data.db;
} else if (process.env.MONGO_URL) {
  mongo_url = process.env.MONGO_URL;
}
mongoose.connect(mongo_url);
app_log('Mongo URL: %s', mongo_url);

var session_secret = 'mytestsessionsecret';
if (process.env.SESSION_SECRET) {
  session_secret = process.env.SESSION_SECRET;
}
app_log('Session Secret: %s', session_secret);

var PORT = process.env.PORT || process.env.VCAP_APP_PORT || 3000;
var HOST = process.env.IP_ADDRESS || process.env.VCAP_APP_HOST || '127.0.0.1';
app_log('Port: %s', PORT);
app_log('Host: %s', HOST);

var audience = 'http://' + HOST + ':' + PORT; // Must match your browser's address bar
if (process.env.VMC_APP_INSTANCE) {
  var instance = JSON.parse(process.env.VMC_APP_INSTANCE);
  audience = 'https://' + instance.uris[0] + '/';
} else if (process.env.AUDIENCE) {
  audience = process.env.AUDIENCE;
}
app_log('Audience: %s', audience);

app.configure(function () {
  app.set('views', __dirname + '/views');
  app.engine('html', ejs.renderFile);
  app.use(function (req, res, next) {
    var rEnd = res.end;

    // To track response time
    req._rlStartTime = new Date();

    // Setup the key-value object of data to log and include some basic info
    req.kvLog = {
      date: req._rlStartTime.toISOString(),
      method: req.method,
      url: url.parse(req.originalUrl).pathname,
    };

    // Proxy the real end function
    res.end = function (chunk, encoding) {
      // Do the work expected
      res.end = rEnd;
      res.end(chunk, encoding);

      // And do the work we want now (logging!)

      // Save a few more variables that we can only get at the end
      req.kvLog.status = res.statusCode;
      req.kvLog.response_time = (new Date() - req._rlStartTime);

      // Print the log
      //if (res.statusCode != 200 && res.statusCode != 304)
      request_log(logTmpl(req.kvLog));
    };

    next();
  });
  app.use(express.bodyParser());
  app.use(express.cookieParser());
  app.use(express.session({secret: session_secret}));
  app.use(express.methodOverride());
  app.use(app.router);
});

app.configure('development', function () {
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function () {
  app.use(express.errorHandler());
});

// Static files.
app.use('/r', express.static(__dirname + '/www'));

// User-facing routes.
app.get('/', routes.index);
app.get('/new', routes.index);
app.get('/project/:project_id', routes.index);
app.get('/project/:project_id/:mockup_id', routes.index);
app.get('/profile/:user_email', routes.index);
app.get('/products', routes.index);
app.get('/themes', routes.index);

// API Themes
app.get('/api/themes', routes.getThemes);
app.post('/api/themes', routes.postTheme);
app.put('/api/themes/:theme_id', routes.putTheme);
app.delete('/api/themes/:theme_id', routes.deleteTheme);

// API Products
app.get('/api/products', routes.getProducts);
app.post('/api/products', routes.postProduct);
app.put('/api/products/:product_id', routes.putProduct);
app.delete('/api/products/:product_id', routes.deleteProduct);

// API Projects.
app.get('/api/projects', routes.getProjects);
app.post('/api/projects', routes.postProject);
app.get('/api/projects/:project_id', routes.getProject);
app.put('/api/projects/:project_id', routes.putProject);
app.delete('/api/projects/:project_id', routes.disabled);

// API Mockups.
app.post('/api/projects/:project_id/mockups', routes.postMockup);
app.put('/api/projects/:project_id/mockups/:mockup_id', routes.putMockup);
app.get('/api/projects/:project_id/mockups/:mockup_id', routes.getMockup);
app.get('/api/projects/:project_id/mockups/:mockup_id/img', routes.getMockupImg);

// API Bugs
app.get('/api/projects/:project_id/bugs', routes.getBugs);
app.get('/api/projects/:project_id/mockups/:mockup_id/bugs', routes.getBugs);
app.post('/api/projects/:project_id/mockups/:mockup_id/bugs', routes.postBug);
app.get('/api/bugs/:bug_id', routes.getBug);
app.get('/api/bugs', routes.getBugs);
app.put('/api/projects/:project_id/mockups/:mockup_id/bugs/:bug_id', routes.putBug);
app.delete('/api/projects/:project_id/mockups/:mockup_id/bugs/:bug_id', routes.deleteBug);

// Persona API.
app.get('/user', routes.getUser);
app.post('/logout', routes.logout);

// API Admin
// scary API calls disabled
// app.get('/api/deleteAll', routes.deleteAll);
// app.get('/api/dump', routes.dump);

require('express-persona')(app, {
  audience: audience
});

server.listen(PORT, HOST, function () {
  app_log('Listening on %s', audience);
});
