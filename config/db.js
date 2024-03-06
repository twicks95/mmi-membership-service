const { Client } = require('pg')
const connectionString = `postgres://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`

// Connect to PostgreSQL
const postgresClient = new Client(connectionString);
postgresClient.connect((err) => {
    if (err) {
        console.error('Connection error:', err.stack);
    } else {
        console.log(`Connected to PostgreSQL database host:${process.env.DB_HOST}`);
    }
});

module.exports = postgresClient;