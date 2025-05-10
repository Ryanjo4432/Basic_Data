require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// PostgreSQL Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for Render.com
});

// Test the database connection
pool.connect((err, client, release) => {
    if (err) {
        return console.error('Error acquiring client', err.stack);
    }
    console.log('Connected to the database successfully!');
    release();
});

// API Route to update the database
app.post('/update-data', async (req, res) => {
    try {
        const { Name, IP, Date, Data } = req.body;
       console.log(req.body);
        // Corrected SQL Query with proper conflict handling
        const query = `
            INSERT INTO "saved data" ("Name", "IP", "Date", "Data") 
            VALUES ($1, $2, $3, $4)
        `;

    
        await pool.query(query, [Name, IP, Date, Data]);
        res.send("its working bitchass!");
    } catch (error) {
        console.error("Error:", error);
        res.status(500).send("Server error");
    }
});

// Start Server
app.listen(port, () => console.log(`Server running on port ${port}`));
