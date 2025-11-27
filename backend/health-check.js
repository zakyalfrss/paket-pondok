const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST || 'mysql',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'paket_pondok',
    port: 3306
};

async function checkHealth() {
    try {
        const connection = await mysql.createConnection(dbConfig);
        await connection.execute('SELECT 1');
        await connection.end();
        process.exit(0); // Healthy
    } catch (error) {
        console.error('Health check failed:', error.message);
        process.exit(1); // Unhealthy
    }
}

checkHealth();