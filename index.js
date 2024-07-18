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
// const db = new pg.Client({
//     user: process.env.PG_USER,
//     host: process.env.PG_HOST,
//     database: process.env.PG_DATABASE,
//     password: process.env.PG_PASSWORD,
//     port: process.env.PG_PORT
// });


const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
})
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
            res.redirect("/govt-welcome");
        }
    });
});

// Route to handle registration form submission for general users
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
            // Redirect to a specific URL after successful registration
            res.sendFile(path.join(rootDir, "public", "welcome.html")); 
        }
    });
});

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

// Route to serve the government official welcome page
app.get("/govt-welcome", (req, res) => {
    res.sendFile(path.join(rootDir, "public", "govt_welcome.html"));
});

// Route to fetch schemes applied in new_entry table
app.get("/govt-schemes", (req, res) => {
    // Query to fetch all schemes from new_entry table
    const query = `
        SELECT *
        FROM new_entry
    `;

    db.query(query, (err, result) => {
        if (err) {
            console.error("Error fetching schemes:", err);
            res.status(500).send("Error fetching schemes.");
        } else {
            const schemes = result.rows;

            // Render the schemes with approve and disapprove buttons
            res.send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Schemes to Approve/Disapprove</title>
                </head>
                <body>
                    <h1>Schemes to Approve/Disapprove</h1>
                    <ul>
                        ${schemes.map(scheme => `
                            <li>
                                ${scheme.farm_id} - Applied on ${scheme.date_applied} for "${scheme.name}"
                                <form action="/approve-scheme" method="post">
                                    <input type="hidden" name="scheme_id" value="${scheme.id}">
                                    <button type="submit" name="action" value="approve">Approve</button>
                                </form>
                                <form action="/approve-scheme" method="post">
                                    <input type="hidden" name="scheme_id" value="${scheme.id}">
                                    <button type="submit" name="action" value="disapprove">Disapprove</button>
                                </form>
                            </li>
                        `).join("")}
                    </ul>
                    <a href="/govt-welcome">Back to Welcome Page</a>
                </body>
                </html>
            `);
        }
    });
});

// Route to handle approval or disapproval of a scheme
app.post("/approve-scheme", (req, res) => {
    const { scheme_id, action } = req.body;

    let query;
    if (action === "approve") {
        query = `
            UPDATE new_entry
            SET approved = true
            WHERE id = $1
        `;
    } else if (action === "disapprove") {
        query = `
            UPDATE new_entry
            SET approved = false
            WHERE id = $1
        `;
    }

    db.query(query, [scheme_id], (err, result) => {
        if (err) {
            console.error("Error updating scheme status:", err);
            res.status(500).send("Error updating scheme status.");
        } else {
            // Redirect back to the schemes list after update
            res.redirect("/govt-schemes");
        }
    });
});

// Route to serve the new scheme application form
app.get("/apply-scheme", (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Apply for a New Scheme</title>
        </head>
        <body>
            <h1>Apply for a New Scheme</h1>
            <div style="width: 300px; margin: 20px auto; padding: 20px; border: 1px solid #ccc; border-radius: 4px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
                <form action="/apply-scheme" method="post">
                    <div style="margin-bottom: 15px;">
                        <label for="farm_id">Farm ID:</label>
                        <input type="text" id="farm_id" name="farm_id" style="width: 100%; padding: 8px; margin: 5px 0; box-sizing: border-box;" required>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label for="date_applied">Date Applied:</label>
                        <input type="date" id="date_applied" name="date_applied" style="width: 100%; padding: 8px; margin: 5px 0; box-sizing: border-box;" required>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label for="scheme_name">Scheme Name:</label>
                        <input type="text" id="scheme_name" name="scheme_name" style="width: 100%; padding: 8px; margin: 5px 0; box-sizing: border-box;" required>
                    </div>
                    <button type="submit" style="width: 100%; padding: 10px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Submit Application</button>
                </form>
            </div>
            <a href="/govt-welcome">Back to Welcome Page</a>
        </body>
        </html>
    `);
});

// Start the server and listen on the specified port
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});
