// Import required packages and modules
const express = require('express');
const app = express();
const port = 3000;
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
// Import the 'cookie-parser' middleware for handling cookies in Express
// Use the 'cookie-parser' middleware to parse cookies in incoming requests
const cookieParser = require('cookie-parser');
const download = require('image-downloader');
// download images from the internet, provided the link
const multer = require('multer');
//Multer is a middleware that is used for the easy handling of multipart/form data that is used when file uploading is done
const User = require('./models/User.js'); // Import the User model from a file
require('dotenv').config(); // Load environment variables from a .env file

const path = require('path');
//path module to use the path on system
const fs = require('fs');
// files module to deal with file upload/download

// Generate a salt for bcrypt hashing and get JWT secret from environment variables
const bcryptSalt = bcrypt.genSaltSync(10);
const jwtsecret = process.env.JWT_SECRET;

app.use(
  cors({
    credentials: true, // Allow credentials (cookies) to be sent with cross-origin requests
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'], // Allow requests from these specified origins
  })
);
app.options('*', cors()); // Enable CORS preflight for all routes
app.use('/uploads',express.static(__dirname+'/uploads'))
app.use(express.json()); // Use middleware to parse JSON bodies in requests
app.use(cookieParser()); // Use cookie-parser middleware to parse cookies
mongoose.connect(process.env.MONGO_URL); // Connect to MongoDB using the provided URL

// Define a basic route to send 'Hello World!' as a response
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Define a test route to send 'Ok' as a JSON response
app.get('/test', (req, res) => {
  res.json('Ok');
});

// Define a route for user registration
app.post('/register', async (req, res) => {
  // Destructure relevant information (username, email, password) from the request body
  const { username, email, password } = req.body;
  try {
    // Attempt to create a new user using the User model and provided information
    const userDoc = await User.create({
      username,
      email,
      // Hash the provided password using bcrypt before storing it in the database
      password: bcrypt.hashSync(password, bcryptSalt),
    });
    // Send a JSON response containing the created user information
    res.json(userDoc);
  } catch (e) {
    // If an error occurs during registration, handle it by sending a JSON response with a 422 status code
    res.status(422).json(e);
  }
});


// Define a route for user login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    // Find a user by email in the database
    const userDoc = await User.findOne({ email });
    if (userDoc) {
      // If user exists, compare the provided password with the stored hashed password
      const passOk = bcrypt.compareSync(password, userDoc.password);
      if (passOk) {
        // If password is correct, sign a JWT token and set it as a cookie
        // Generate a JSON Web Token (JWT) for authentication
        jwt.sign(
          {
            email: userDoc.email, 
            id: userDoc._id 
            // Include user's email and user's ID in the token payload
          },
          jwtsecret, // Use the JWT secret for signing the token
          (err, token) => {
            // Callback function executed after JWT is generated
            if (err) {
              // If an error occurs during JWT generation, log the error and send a 500 Internal Server Error response
              console.error(err);
              res.status(500).json('Internal Server Error');
            } else {
              // If JWT is successfully generated, set it as an HTTP-only cookie and send it in the response
              res.cookie('token', token, { httpOnly: true, sameSite: 'None', secure: true}).json(userDoc).on('error', (err) => console.error('Error setting cookie:', err));
            }
          }
        );

      } else {
        res.status(422).json('Password is incorrect'); // Handle incorrect password
      }
    } else {
      res.status(422).json('User does not exist'); // Handle non-existent user
    }
  } catch (e) {
    res.status(500).json('Internal Server Error'); // Handle unexpected errors
  }
});


// Define a route to retrieve and log the token from cookies
// Define a route for handling requests to the '/profile' endpoint
app.get('/profile', (req, res) => {
  // Extract the 'token' from the cookies in the incoming request
  const { token } = req.cookies;

  // Check if a token exists
  if (token) {
    // Verify the token using jwt.verify
    jwt.verify(token, jwtsecret, {}, async (err, userData) => {
      // Handle errors during token verification
      if (err) throw err;

      // Destructure relevant information (email, username, _id) from the user data obtained from the token
      const { email, username, _id } = await User.findById(userData.id);

      // Send a JSON response containing the user information
      res.json({
        email,
        username,
        _id
      });
    });
  } else {
    // If no token exists, send a JSON response with null
    res.json(null);
  }
});

// Define a route to handle user logout
app.post('/logout', (req, res) => {
  try {
    // Try to clear the 'token' cookie by setting its value to an empty string
    res.cookie('token', '', { expires: new Date(0), httpOnly: true, sameSite: 'None', secure: true });

    // Send a JSON response indicating a successful logout
    res.json(true);
  } catch (error) {
    // If an error occurs during the logout process, handle it
    console.error('Error clearing token cookie:', error);

    // Send a 500 Internal Server Error response with an error message
    res.status(500).json('Internal Server Error');
  }
});

// Define a route handler for POST requests to '/upload-by-link'
app.post('/upload-by-link', (req, res) => {
  // Extract the 'link' property from the request body
  const { link } = req.body;

  // Log the received link for debugging purposes
  console.log(link);

  // Generate a random string to create a unique filename
  const randomString = Math.random().toString(36).substring(7);

  // Create a new filename using the current timestamp and the generated random string
  const newName = `${Date.now()}_${randomString}.jpg`;

  // Construct the destination path using path.join and the 'uploads' directory
  const destPath = path.join(__dirname, 'uploads', newName);

  // Configure options for downloading the image using the 'download' library
  const options = {
    url: link,
    dest: destPath, // Set the destination path for saving the downloaded image
  };

  // Define an asynchronous function fetchImage to handle the image download process
  const fetchImage = async () => {
    try {
      // Use the 'download' library to download the image and get the saved filename
      const { filename } = await download.image(options);

      // Log a success message indicating the saved filename
      console.log('Saved to', filename);

      // Send a successful response to the client with the saved filename
      res.status(200).json({ message: 'Image downloaded successfully', filename: newName });
    } catch (error) {
      // Log an error if there's an issue with the image download
      console.error(error);

      // Send an error response to the client
      res.status(500).json({ message: 'Error downloading image' });
    }
  };

  // Call the fetchImage function to initiate the image download process
  fetchImage();
});


// Configure multer middleware to handle file uploads and specify the destination directory
const photosMiddleware = multer({ dest: 'uploads/' });

// Define a route handler for POST requests to '/upload' with the configured multer middleware
app.post("/upload", photosMiddleware.array('photos', 100), (req, res) => {
  try {
    // Map over the uploaded files to process and rename each file
    const filenames = req.files.map((file) => {
      // Extract the file extension from the original filename
      const fileExtension = file.originalname.slice(file.originalname.lastIndexOf('.'));
      
      // Generate a new filename using the current timestamp, a random string, and the original file extension
      const newName = `${Date.now()}_${Math.random().toString(36).substring(7)}${fileExtension}`;

      // Construct the destination path using path.join and the 'uploads' directory
      const destPath = path.join(__dirname, 'uploads', newName);

      // Rename and move the uploaded file to the destination path
      fs.renameSync(file.path, destPath);

      // Return the new filename for further processing or response
      return newName;
    });

    // Send a JSON response indicating successful image uploads and the generated filenames
    res.json({ message: 'Images uploaded successfully', filenames });
  } catch (error) {
    // Log an error if there's an issue with the file upload process
    console.error('Error uploading images:', error);

    // Send an error response to the client
    res.status(500).json({ message: 'Internal Server Error - Unable to upload images' });
  }
});

// Define a route handler for POST requests to the '/places' endpoint
app.post('/places', (req, res) => {
  // Extract the 'token' property from the cookies of the incoming request
  const { token } = req.cookies;

  // Extract specific properties from the request body using destructuring
  const {
    title, address, addedPhotos, description,
    perks, extraInfo, checkIn, checkOut, maxGuests,
  } = req.body;

  // Verify the token extracted from cookies using jwt.verify method
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    // Handle error if verification fails
    if (err) throw err;

    // Create a new Place document in the database using the Place model
    const placeDoc = await Place.create({
      // Set the owner field of the Place document to the user's id extracted from the token
      owner: userData.id,

      // Set other fields of the Place document to the corresponding values from the request body
      title, address, photos: addedPhotos, description,
      perks, extraInfo, checkIn, checkOut, maxGuests,
    });

    // Send the created Place document as a JSON response
    res.json(placeDoc);
  });
});

// Start the server and listen on the specified port
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
