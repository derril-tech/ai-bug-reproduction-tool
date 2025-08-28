#!/usr/bin/env node

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigrations() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();
        console.log('Connected to database');

        // Create migrations table if it doesn't exist
        await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMPTZ DEFAULT now()
      );
    `);

        // Get list of migration files
        const migrationsDir = path.join(__dirname, '..', 'migrations');
        const files = fs.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.sql'))
            .sort();

        // Get executed migrations
        const result = await client.query('SELECT version FROM schema_migrations');
        const executedMigrations = new Set(result.rows.map(row => row.version));

        // Run pending migrations
        for (const file of files) {
            if (!executedMigrations.has(file)) {
                console.log(`Running migration: ${file}`);
                const migrationPath = path.join(migrationsDir, file);
                const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

                await client.query('BEGIN');
                try {
                    await client.query(migrationSQL);
                    await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
                    await client.query('COMMIT');
                    console.log(`Migration ${file} completed successfully`);
                } catch (error) {
                    await client.query('ROLLBACK');
                    throw error;
                }
            }
        }

        console.log('All migrations completed successfully');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigrations();
