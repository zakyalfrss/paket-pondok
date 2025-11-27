const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'paket_pondok',
    port: 3306
};

async function checkHealth() {
    let connection;
    try {
        console.log('🔍 Testing database connection...');
        connection = await mysql.createConnection(dbConfig);
        await connection.execute('SELECT 1');
        console.log('✅ Database health check passed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Health check failed:', error.message);
        process.exit(1);
    } finally {
        if (connection) await connection.end();
    }
}

checkHealth();