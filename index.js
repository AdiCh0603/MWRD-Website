import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import path from "path";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth2";
import env from "dotenv";
import session from "express-session";

// Load environment variables
env.config();

const app = express();
const port = 4000; // Port number for running the server locally

// PostgreSQL database configuration
const db = new pg.Client({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT
});

// Connect to the PostgreSQL database
db.connect(err => {
    if (err) {
        console.error('Failed to connect to the database:', err);
    } else {
        console.log('Connected to the database');
    }
});

// Configure session management
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true
}));

// Initialize Passport and restore authentication state, if any, from the session
app.use(passport.initialize());
app.use(passport.session());

// Configure Google OAuth strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:4000/auth/google/callback",
    passReqToCallback: true
  },
  async (request, accessToken, refreshToken, profile, done) => {
    try {
        const result = await db.query("SELECT * FROM registration_details WHERE username = $1", [profile.email]);
        if (result.rows.length === 0) {
            const newUser = await db.query(
                "INSERT INTO registration_details (username, password) VALUES ($1, $2)",
                [profile.email, "google"]
            );
            return done(null, newUser.rows[0]);
        } else {
            return done(null, result.rows[0]);
        }
    } catch (err) {
        return done(err);
    }
  }
));

// Middleware setup
app.use(bodyParser.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(express.static("public")); // Serve static files from the "public" directory

// Resolve the root directory path
const rootDir = path.resolve();

// Passport session setup
passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    done(null, obj);
});

// Route to serve the home page
app.get("/", (req, res) => {
    res.sendFile(path.join(rootDir, "public", "index.html")); 
});

// Route to serve the registration page
app.get("/register", (req, res) => {
    res.sendFile(path.join(rootDir, "public", "register.html"));
});

// Route to serve the login page
app.get("/login", (req, res) => {
    res.sendFile(path.join(rootDir, "public", "login.html"));
});

// Route to handle registration form submission
app.post("/register", (req, res) => {
    const { username, password } = req.body;

    const query = "INSERT INTO registration_details (username, password) VALUES ($1, $2)";
    db.query(query, [username, password], (err, result) => {
        if (err) {
            console.error("Error inserting data:", err);
            res.status(500).send("Error registering user.");
        } else {
            res.send("User registered successfully.");
        }
    });
});

// Route to handle login form submission
app.post("/login", (req, res) => {
    const { username, password } = req.body;

    const query = "SELECT * FROM registration_details WHERE username = $1 AND password = $2";
    db.query(query, [username, password], (err, result) => {
        if (err) {
            console.error("Error querying data:", err);
            res.status(500).send("Error logging in user.");
        } else if (result.rows.length > 0) {
            res.send("Login successful.");
        } else {
            res.status(401).send("Invalid username or password.");
        }
    });
});

// Route to start the Google OAuth process
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Route to handle the Google OAuth callback
app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/welcome.html');
  });

// Start the server and listen on the specified port
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});
