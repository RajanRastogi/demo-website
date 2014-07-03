express = require('express');
sockjs = require('sockjs');
request = require('request');
_ = require('lodash');

var credentials = {
  clientID: '<clientID>',
  clientSecret: '<clientSecret>',
  site: 'http://playlyfe.com',
  tokenPath: "/auth/token"
};

oauth = require('simple-oauth2')(credentials)

// Put in your application details here.
var config = require('./config');

token = {};

app = express();
app.use(express.cookieParser());
app.use(express.json());
app.use(express.cookieSession({ secret: 'TOP_SECRET', cookie: { domain: 'localhost' } }));
app.use(express.static(__dirname+"/public"));
app.use(app.router);
app.use(express.logger());
app.use(express.errorHandler());

var getToken = function (callback) {
  if (_.isEmpty(token) || token.expired()) {
    oauth.Client.getToken({}, function(err, data) {
      if(err) callback(err);
      token = oauth.AccessToken.create(data);
      console.log(data);
      callback(null, token);
    })
  }  
}

var auth = function (req, res, next) {
  if (req.session.logged_in && req.session.auth != null) {
    return next();
  } else {
    // take to index page
    //return res.redirect(client.getAuthorizationURI());
  }
};

var authApi = function (req, res, next) {
  console.log("AUTHING", req.session);
  if (req.session.logged_in && req.session.auth != null) {
    getToken(function (err, data) {
      if(err) {
        console.log(err);
        return res.json(500, {
          error: 'server_error',
          error_description: err.message || "Poof"
        });
      }
      next();
    });
  } else {
    return res.json(401, {
      error: 'access_denied',
      error_description: 'You are not authorized on this site'
    });
  }
};
// Proxy requests to playlyfe server.
var proxyApi = function(req, res) {
  try {
    console.log('Proxying', req);
    res.header("Cache-Control", "no-cache, no-store, must-revalidate");
    res.header("Pragma", "no-cache");
    res.header("Expires", 0);

    req.query.access_token = token.token.access_token;
    req.query.player_id = req.session.auth.player_id;
    req.query.debug = true;



    endpoint = 'http://api.playlyfe.com/v1'
    url = endpoint+'/'+(req.params[0] != null ? req.params[0] : '');

    console.log(url);

    request({
      url: url,
      method: req.route.method.toUpperCase(),
      qs: req.query,
      headers:{
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body),
      encoding: null,
    }, function(err, response, body) {
        if (err) throw err;
        res.statusCode = response.statusCode;
        for (header in response.headers) {
          res.header(header, response.headers[header]);
        }
        res.end(body.toString());
      })
  } catch (e) {
    res.json(500, { error: "server_error", error_description: e.message });
  }
}

app.get('/api', authApi, proxyApi);
app.all('/api/*', authApi, proxyApi);

app.post('/login', function(req, res){
  console.log("login route");
  req.session.logged_in = true;
  req.session.auth = {
    player_id : req.body.player_id
  };
  req.session.auth.player_id = req.body.player_id;
  
  // res.header("Cache-Control", "no-cache, no-store, must-revalidate");
  // res.header("Pragma", "no-cache");
  // res.header("Expires", 0);
  
  // req.query.access_token = token.token.access_token;
  // req.query.player_id = req.body.player_id;
  // req.query.debug = true;

  // request({
  //   url: 'http://api.playlyfe.com/v1/player',
  //   method: 'GET',
  //   qs: req.query,
  //   headers:{
  //     'Content-Type': 'application/json'
  //   },
  //   body: JSON.stringify(req.body),
  //   encoding: null,
  // }, function(err, response, body) {
  //     if (err) throw err;
  //     res.statusCode = response.statusCode;
  //     for (header in response.headers) {
  //       res.header(header, response.headers[header]);
  //     }
  //     res.json(body.toString());
  //   })

  req.params[0] = 'player';
  req.route.method = 'GET';
  proxyApi(req, res);
});

app.get('/logout', auth, function (req, res) {
  req.session.logged_in = false;
  delete req.session.auth;
  res.redirect('/');
});

app.listen(3001, getToken(function(err, data){
  console.log("Server up, got token ",data.token.access_token)
}));
