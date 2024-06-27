-- Home page where the user registers (if he visits the website for the first time)
-- and his password and username are stored
CREATE TABLE registration_details (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL
);

-- The same credentials can be used once he logs in
-- Now once the user logs in we can store the name of his district to which
-- he/she belongs and we can ask him to select his district
CREATE TABLE districts (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL REFERENCES registration_details(username),
    district_name VARCHAR(100)
);

