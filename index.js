import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import path from "path";
import passport from "passport";
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
    callbackURL: `http://localhost:4000/auth/google/callback`,
    passReqToCallback: true
  },
  async (request, accessToken, refreshToken, profile, done) => {
    try {
        const result = await db.query("SELECT * FROM registration WHERE username = $1", [profile.email]);
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

// Route to serve the government official registration page
app.get("/register-govt", (req, res) => {
    res.sendFile(path.join(rootDir, "public", "govt_register.html"));
});

app.get("/welcome", (req, res) => {
    res.sendFile(path.join(rootDir, "public", "welcome.html"));
});

// Route to handle registration form submission for government officials
// Route to handle registration form submission for government officials
app.post("/register-govt", (req, res) => {
    const { id, username, password, dob, joined_date, profession, gender } = req.body;

    const query = `
        INSERT INTO govt_registration (emp_id, username, password, dob, joined_date, profession, gender)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    const values = [id, username, password, dob, joined_date, profession, gender];

    db.query(query, values, (err, result) => {
        if (err) {
            console.error("Error inserting data:", err);
            res.status(500).send("Error registering government official.");
        } else {
            // Redirect to a specific URL after successful registration
            res.redirect("/welcome");
        }
    });
});


app.post("/register", (req, res) => {
    const { id, username, password, name, dob, gender, address, district } = req.body;

    const query = `
        INSERT INTO registration (id, username, password, name, dob, gender, address, district)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    const values = [id, username, password, name, dob, gender, address, district];

    db.query(query, values, (err, result) => {
        if (err) {
            console.error("Error inserting data:", err);
            res.status(500).send("Error registering user.");
        } else {
            // Redirect to a specific URL
            res.redirect("/welcome");
        }
    });
});

// Route to fetch schemes applied by a farmer based on ID
// Route to fetch schemes applied by a farmer based on ID
app.get("/schemes", (req, res) => {
    const farmerId = req.query.farmer_id;

    // Query to fetch schemes applied by the farmer based on farmerId
    const query = `
        SELECT i.*, r.name AS farmer_name 
        FROM inspection i
        INNER JOIN registration r ON i.farm_id = r.id
        WHERE i.farm_id = $1
    `;
    const values = [farmerId];

    db.query(query, values, (err, result) => {
        if (err) {
            console.error("Error fetching schemes:", err);
            res.status(500).send("Error fetching schemes.");
        } else {
            const schemes = result.rows;
            
            // Render the schemes directly in response
            res.send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Schemes Applied</title>
                </head>
                <body>
                    <h1>Schemes Applied by Farmer</h1>
                    <ul>
                        ${schemes.map(scheme => `<li>${scheme.name} - ${scheme.status}</li>`).join("")}
                    </ul>
                    <a href="/">Back to Home</a>
                </body>
                </html>
            `);
        }
    });
});


// Route to start the Google OAuth process
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Route to handle the Google OAuth callback
app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/register' }),
    function(req, res) {
      // Successful authentication, redirect to welcome.html
      res.sendFile(path.join(rootDir, "public", "welcome.html")); 
    });

// Start the server and listen on the specified port
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});
