// Import required packages
const express = require('express');
const mysql = require('mysql2/promise'); // MySQL driver
const cors = require('cors'); // To allow frontend to call the backend
require('dotenv').config(); // To load environment variables (like the database URL)

// Create the Express app
const app = express();

// --- Middleware ---
// Allow requests from your frontend (Render static site)
app.use(cors()); 
// Parse incoming JSON data from the form
app.use(express.json());

// --- Database Connection (Aiven for MySQL) ---
// The connection string (DATABASE_URL) will be securely stored on Render
// as an environment variable.
// Aiven's MySQL URL format is: mysql://USER:PASSWORD@HOST:PORT/DATABASE
const connectionString = process.env.DATABASE_URL;

const pool = mysql.createPool({
  uri: connectionString,
  ssl: {
    // This is often required for secure cloud database connections
    rejectUnauthorized: false
  }
});

// --- API Routes ---

// Health check route
app.get('/api', (req, res) => {
  res.status(200).json({ message: 'Tohf-e-Hayat Backend (MySQL) is running!' });
});

// Donor registration route
app.post('/api/register', async (req, res) => {
  // Extract data from the request body
  const { 
    fullName, 
    email, 
    phone, 
    bloodGroup, 
    city, 
    isBloodDonor, 
    isOrganDonor, 
    organs 
  } = req.body;

  // Basic validation
  if (!fullName || !email || !phone || !city) {
    return res.status(400).json({ error: 'Please fill out all required fields.' });
  }

  // If they are a blood donor, blood group must be provided
  if (isBloodDonor && (!bloodGroup || bloodGroup === '')) {
     return res.status(400).json({ error: 'Blood group is required for blood donors.' });
  }

  // Convert the organs array to a JSON string for database storage
  const organsJson = JSON.stringify(organs);
  // Use 'null' if bloodGroup is empty (for organ-only donors)
  const finalBloodGroup = bloodGroup === '' ? null : bloodGroup;

  // The SQL query to insert a new donor
  // Uses parameterized queries (?) to prevent SQL injection
  const query = `
    INSERT INTO donors (full_name, email, phone, blood_group, city, is_blood_donor, is_organ_donor, organs_to_donate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?);
  `;
  
  const values = [
    fullName, 
    email, 
    phone, 
    finalBloodGroup, 
    city, 
    isBloodDonor, 
    isOrganDonor, 
    organsJson
  ];

  let connection;
  try {
    // Get a connection from the pool
    connection = await pool.getConnection();
    
    // Execute the query
    const [result] = await connection.query(query, values);
    console.log(`New donor registered with ID: ${result.insertId}`);
    
    // Send a success response back to the frontend
    res.status(201).json({ 
      message: 'Registration successful!', 
      donorId: result.insertId 
    });

  } catch (error) {
    console.error('Database insertion error:', error);
    
    // Check for unique email violation
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'This email is already registered.' });
    }
    
    // Send a generic error response
    res.status(500).json({ error: 'An error occurred during registration. Please try again.' });
  } finally {
    // Release the connection back to the pool
    if (connection) {
      connection.release();
    }
  }
});

// --- Start the Server ---
// Render provides the PORT environment variable
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

