import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import path from "path";

const app = express();
const port = 3000; // The port for running the file in localhost

const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "MWRD",
    password: "Root123",
    port: 5432,
});

db.connect();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// Define the root directory
const rootDir = path.resolve();

// Route to the home page
app.get("/", (req, res) => {
    res.sendFile(path.join(rootDir, "public", "index.html"));
});

// Route to the registration page
app.get("/register", (req, res) => {
    res.sendFile(path.join(rootDir, "public", "register.html"));
});

// Route to the login page
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

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});
