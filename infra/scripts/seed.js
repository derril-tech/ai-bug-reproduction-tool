#!/usr/bin/env node

const { Client } = require('pg');
require('dotenv').config();

async function seedDatabase() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();
        console.log('Connected to database for seeding');

        // Insert default organization and project for development
        const orgResult = await client.query(`
      INSERT INTO orgs (id, name, plan)
      VALUES ('00000000-0000-0000-0000-000000000001', 'Default Org', 'pro')
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `);

        if (orgResult.rows.length > 0) {
            console.log('Created default organization');

            await client.query(`
        INSERT INTO users (id, org_id, email, role)
        VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'admin@bugrepro.com', 'admin')
        ON CONFLICT (id) DO NOTHING
      `);

            await client.query(`
        INSERT INTO projects (id, org_id, name, repo_url, default_branch)
        VALUES ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Demo Project', 'https://github.com/example/demo-app', 'main')
        ON CONFLICT (id) DO NOTHING
      `);

            console.log('Created default user and project');
        }

        // Insert sample bug report for testing
        const reportResult = await client.query(`
      INSERT INTO reports (id, project_id, title, description, reporter, severity, env)
      VALUES (
        '00000000-0000-0000-0000-000000000004',
        '00000000-0000-0000-0000-000000000003',
        'Checkout button throws TypeError',
        'When clicking the checkout button after applying a coupon, the page crashes with "Cannot read property map of undefined"',
        'john.doe@example.com',
        'high',
        '{"browser": "Chrome", "version": "120.0", "os": "macOS"}'
      )
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `);

        if (reportResult.rows.length > 0) {
            console.log('Created sample bug report');

            // Insert sample signals
            await client.query(`
        INSERT INTO signals (id, report_id, kind, meta)
        VALUES (
          '00000000-0000-0000-0000-000000000005',
          '00000000-0000-0000-0000-000000000004',
          'log',
          '{"error": "TypeError: Cannot read property map of undefined", "stack": "at CheckoutPage.handleCoupon (checkout.js:45:12)", "timestamp": "2024-01-15T10:30:00Z"}'
        )
        ON CONFLICT (id) DO NOTHING
      `);

            console.log('Created sample signals');
        }

        console.log('Database seeding completed successfully');
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

seedDatabase();
