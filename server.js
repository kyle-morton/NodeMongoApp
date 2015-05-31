// BASE SETUP
// ======================================


// CALL THE PACKAGES --------------------
var express = require('express'); // call express
var app = express(); // define our app using express
var bodyParser = require('body-parser'); // get body-parser
var morgan = require('morgan'); // used to see requests
var mongoose = require('mongoose'); // for working w/ our database
var port = process.env.PORT || 8080; // set the port for our app
var User = require('./models/user');

//Get JSON web token package
var jwt = require('jsonwebtoken');

//create secret (SALT) to create tokens with 
var superSecret = 'ilovescotchscotchyscotchscotch';


//connect to our database (hosted by mongolabs)
mongoose.connect('kyle:oagland@ds041992.mongolab.com:41992/meanmongo');

// APP CONFIGURATION ---------------------
// use body parser so we can grab information from POST requests
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


// configure our app to handle CORS requests
app.use(function(req, res, next) {
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
	res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type, \
	Authorization');
	next();
});


// log all requests to the console
app.use(morgan('dev'));


// ROUTES FOR OUR API
// =============================
// basic route for the home page
app.get('/', function(req, res) {
	res.send('Welcome to the home page!');
});

// get an instance of the express router
var apiRouter = express.Router();


//initial authenication route
apiRouter.post('/Authenticate', function (req, res) {

	// find the user
	// select the name username and password explicitly
	User.findOne({
		username: req.body.username
	}).select('name username password').exec(function(err, user) {


	if (err) throw err;

	// no user with that username was found
	if (!user) {
		res.json({
			success: false,
			message: 'Authentication failed. User not found.'
		});
	} else if (user) {
		// check if password matches
		var validPassword = user.comparePassword(req.body.password);

		//Doesn't match password
		if (!validPassword) {
			res.json({
			success: false,
			message: 'Authentication failed. Wrong password.'
			});
		} 
		//passed authentication
		else {
			// if user is found and password is right
			// create a token
			var token = jwt.sign({
				name: user.name,
				username: user.username
			}, superSecret, {
				expiresInMinutes: 1440 // expires in 24 hours
			});

			// return the information including token as JSON
			res.json({
				success: true,
				message: 'Enjoy your token!',
				token: token
			});
		}

	}

	});

});


//middleware to use for all requests(Logging)
apiRouter.use(function(req, res, next) {
	console.log("Somebody just came to our app!");

	//Authenticate user here

	/*
	* REM: Flexible since allow token passing in POST, HTTP header, or URL params
	*/

	console.log("req header: " + req.headers['x-access-token']);

	// check header or url parameters or post parameters for token
	var token = req.body.token || req.query.token 
			|| req.headers['x-access-token'];

	console.log("TOKEN: " + token);

	// decode token
	if (token) {

		// verifies secret and checks exp
		jwt.verify(token, superSecret, function(err, decoded) {
			if (err) {
			return res.status(403).send({
				success: false,
				message: 'Failed to authenticate token.'
			});
			} else {
				// if everything is good, save to request for use in other routes
				req.decoded = decoded;
				next();
			}
		});
	} 

	else {
	// if there is no token
	// return an HTTP response of 403 (access forbidden) and an error message
		return res.status(403).send({
			success: false,
			message: 'No token provided.'
		});
	}

});

// test route to make sure everything is working
// accessed at GET http://localhost:8080/api
apiRouter.get('/', function(req, res) {
	res.json({ message: 'hooray! welcome to our api!' });
});


// more routes for our API will happen here

apiRouter.route('/users')

//get all users (GET request)
	.get(function(req, res) {

		//Use our model method to get users
		User.find(function(err, users) {
			if (err) res.send(err);

			//return the user
			res.json(users);
		});
	})

	// create a user (accessed at POST http://localhost:8080/api/users)
	.post(function(req, res) {
		// create a new instance of the User model
		var user = new User();
		// set the users information (comes from the request)
		user.name = req.body.name;
		user.username = req.body.username;
		user.password = req.body.password;
		// save the user and check for errors
		user.save(function(err) {
			if (err) {
			// duplicate entry
			if (err.code == 11000)
				return res.json({ success: false, message: 'A user with that\
				username already exists. '});
			else
				return res.send(err);
			}
			res.json({ message: 'User created!' });
		});
	});


// on routes that end in /users/:user_id
// ----------------------------------------------------
apiRouter.route('/users/:user_id')

	// get the user with that id
	// (accessed at GET http://localhost:8080/api/users/:user_id)
	.get(function(req, res) {

		console.log(req.params);

		User.findById(req.params.user_id, function(err, user) {
			if (err) res.send(err);
			// return that user
			res.json(user);
		});
	})

	

	// update the user with this id
	// (accessed at PUT http://localhost:8080/api/users/:user_id)
	.put(function(req, res) {
		// use our user model to find the user we want
		User.findById(req.params.user_id, function(err, user) {

			if (err) res.send(err);

			if (user === null) res.send("User doesn't exist");
			else {


				// update the users info only if its new
				if (req.body.name) user.name = req.body.name;
				if (req.body.username) user.username = req.body.username;
				if (req.body.password) user.password = req.body.password;
				// save the user
				user.save(function(err) {
					if (err) res.send(err);
					// return a message
					res.json({ message: 'User updated!' });
				});
			}

			
		});
	})

	// delete the user with this id
	// (accessed at DELETE http://localhost:8080/api/users/:user_id)
	.delete(function(req, res) {
		User.remove({_id: req.params.user_id}, function(err, user) {
			if (err) return res.send(err);
			res.json({ message: 'Successfully deleted' });
		});
	});

// api endpoint to get user information
apiRouter.get('/me', function(req, res) {
	res.send(req.decoded);
});




// REGISTER OUR ROUTES -------------------------------
// all of our routes will be prefixed with /api
app.use('/api', apiRouter);


// START THE SERVER
// ===============================
app.listen(port);
console.log('Magic happens on port ' + port);