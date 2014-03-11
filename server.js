express = require('express');
Playlyfe = require('playlyfe-node-sdk')

// Put in your application details here.
var config = {
  client_id: 'MzQwMGVhMmYtZDUyOC00NGVhLTk1NDgtMzliYjA0ZGQyYzll',
  client_secret: 'ZWNlZjNhMWUtZWI1Ni00NTZiLWJiMjctNTEwYmRhNTk5YzViZTFkMmFhZTAtYTdhMS0xMWUzLTk0NzUtZGJhMDJlZWFhMjJm',
  redirect_uri: 'http://localhost:8080/auth/redirect',
  player_id: 'dummy'
};

client = new Playlyfe(config);

app = express();
app.use(express.cookieParser());
app.use(express.session({ secret: 'TOP_SECRET' }));
app.use(express.static(__dirname+"/public"));
app.use(app.router);
app.use(express.logger());
app.use(express.errorHandler());

var auth = function (req, res, next) {
  if (req.session.logged_in) {
    return next();
  } else {
    return res.redirect(client.getAuthorizationURI());
  }
};

// start playlyfe oauth authorization code flow
app.get('/auth', auth, function (req, res) {
  return res.redirect('/home');
});

// get access token and save it
app.get('/auth/redirect', function (req, res) {
  if (req.query.code !== null) {
    client.getToken(req.query.code, function(err, token) {
      if (err) return res.json(500, err);
      req.session.auth = token;
      req.session.logged_in = true;
      res.redirect('/api/player');
    });
  } else {
    res.redirect('/api/player');
  }
});

// Proxy requests to playlyfe server.
// We keep the access token away from cheaters by using the authoirization code flow.
// This can be integrated with the Playlyfe Javascript SDK to provide secure transparent endpoint for browser clients.
app.all('/api/*', auth, function(req, res) {
  res.header("Cache-Control", "no-cache, no-store, must-revalidate");
  res.header("Pragma", "no-cache");
  res.header("Expires", 0);
  client.api(
    '/' + req.params[0],
    req.route.method.toUpperCase(),
    { qs: req.query, body: req.body },
    req.session.auth.token.access_token,
    function(err, response, body) {
      for (header in response.headers) {
        res.header(header, response.headers[header]);
      }
      res.end(body);
    }
  );
});

app.get('/logout', auth, function (req, res) {
  req.session.logged_in = false;
  delete req.session.auth;
  res.redirect('/');
});

app.listen(8080);