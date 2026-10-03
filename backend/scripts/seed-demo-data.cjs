'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const argon2 = require('argon2');

const { DataSource } = require('typeorm');

async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'connect',
    ssl: false,
  });
  await dataSource.initialize();

  try {
    console.log('--- Seeding Demo Data ---');
    const passwordHash = await argon2.hash('Demo@12345');

    // 1. Create or update Demo User & Team Users
    const usersData = [
      { email: 'demo@connect.com', first_name: 'Alex', last_name: 'Morgan', status: 'active' },
      { email: 'sarah.chen@connect.com', first_name: 'Sarah', last_name: 'Chen', status: 'active' },
      { email: 'david.kim@connect.com', first_name: 'David', last_name: 'Kim', status: 'active' },
      { email: 'elena.rostova@connect.com', first_name: 'Elena', last_name: 'Rostova', status: 'active' },
      { email: 'michael.brown@connect.com', first_name: 'Michael', last_name: 'Brown', status: 'active' },
    ];

    const userMap = {};
    for (const u of usersData) {
      let [existing] = await dataSource.query(`SELECT id FROM users WHERE email = $1`, [u.email]);
      if (!existing) {
        const [inserted] = await dataSource.query(
          `INSERT INTO users (email, password_hash, first_name, last_name, email_verified_at, status)
           VALUES ($1, $2, $3, $4, NOW(), $5) RETURNING id`,
          [u.email, passwordHash, u.first_name, u.last_name, u.status]
        );
        userMap[u.email] = inserted.id;
      } else {
        await dataSource.query(
          `UPDATE users SET password_hash = $1, first_name = $2, last_name = $3, email_verified_at = NOW(), status = 'active' WHERE id = $4`,
          [passwordHash, u.first_name, u.last_name, existing.id]
        );
        userMap[u.email] = existing.id;
      }
    }

    const demoUserId = userMap['demo@connect.com'];

    // 2. Organization
    let [org] = await dataSource.query(`SELECT id FROM organizations WHERE slug = 'connect-workspace'`);
    let orgId;
    if (!org) {
      const [insertedOrg] = await dataSource.query(
        `INSERT INTO organizations (name, slug, created_by) VALUES ('Connect Workspace', 'connect-workspace', $1) RETURNING id`,
        [demoUserId]
      );
      orgId = insertedOrg.id;
    } else {
      orgId = org.id;
      await dataSource.query(`UPDATE organizations SET name = 'Connect Workspace' WHERE id = $1`, [orgId]);
    }

    // Set demo user's current org
    await dataSource.query(`UPDATE users SET current_organization_id = $1 WHERE id = $2`, [orgId, demoUserId]);

    // 3. Memberships
    const roles = {
      'demo@connect.com': 'owner',
      'sarah.chen@connect.com': 'admin',
      'david.kim@connect.com': 'member',
      'elena.rostova@connect.com': 'member',
      'michael.brown@connect.com': 'member',
    };

    for (const [email, role] of Object.entries(roles)) {
      const uid = userMap[email];
      const [existingMem] = await dataSource.query(
        `SELECT id FROM memberships WHERE user_id = $1 AND organization_id = $2`,
        [uid, orgId]
      );
      if (!existingMem) {
        await dataSource.query(
          `INSERT INTO memberships (user_id, organization_id, role) VALUES ($1, $2, $3)`,
          [uid, orgId, role]
        );
      } else {
        await dataSource.query(
          `UPDATE memberships SET role = $1 WHERE id = $2`,
          [role, existingMem.id]
        );
      }
    }

    // 4. Projects
    const projectsData = [
      { name: 'Phoenix Core Development', description: 'Core distributed backend services, real-time messaging pipeline, and WebSocket architecture.' },
      { name: 'Cloud Infrastructure Migration', description: 'Multi-region AWS ECS cluster rollout, Redis Sentinel failover, and automated monitoring.' },
      { name: 'Design System & UI Library', description: 'Tailwind CSS component system, Dark mode tokens, accessibility audits, and motion guidelines.' },
      { name: 'Customer Mobile App', description: 'Cross-platform iOS and Android mobile client with offline sync and push notifications.' }
    ];

    const projectMap = {};
    for (const p of projectsData) {
      let [existingProj] = await dataSource.query(
        `SELECT id FROM projects WHERE organization_id = $1 AND name = $2 AND deleted_at IS NULL`,
        [orgId, p.name]
      );
      if (!existingProj) {
        const [insertedProj] = await dataSource.query(
          `INSERT INTO projects (organization_id, name, description, created_by) VALUES ($1, $2, $3, $4) RETURNING id`,
          [orgId, p.name, p.description, demoUserId]
        );
        projectMap[p.name] = insertedProj.id;
      } else {
        projectMap[p.name] = existingProj.id;
      }
    }

    const phoenixId = projectMap['Phoenix Core Development'];
    const cloudId = projectMap['Cloud Infrastructure Migration'];
    const designId = projectMap['Design System & UI Library'];

    // 5. Tasks
    const tasks = [
      // To Do
      { project: phoenixId, title: 'Optimize PostgreSQL query indexes & pooling', description: 'Analyze slow query logs on organization-level filters and apply composite indexes.', status: 'todo', priority: 'high', assignee: userMap['david.kim@connect.com'], due: '2026-10-15' },
      { project: phoenixId, title: 'Define RBAC policy matrix & automated tests', description: 'Document permission levels and write Jest integration tests for Org guards.', status: 'todo', priority: 'medium', assignee: userMap['sarah.chen@connect.com'], due: '2026-10-18' },
      { project: designId, title: 'Draft Marketing & Documentation Site', description: 'Create responsive landing components with interactive feature tours.', status: 'todo', priority: 'low', assignee: userMap['elena.rostova@connect.com'], due: '2026-10-25' },

      // In Progress
      { project: phoenixId, title: 'Implement Socket.IO Real-Time Gateway', description: 'Connect WebSocket clients with JWT auth and broadcast domain events to org rooms.', status: 'in_progress', priority: 'urgent', assignee: demoUserId, due: '2026-10-12' },
      { project: phoenixId, title: 'Refactor Stripe Subscription & Usage Entitlements', description: 'Upgrade Stripe webhook listener to handle customer portal session lifecycle.', status: 'in_progress', priority: 'high', assignee: userMap['sarah.chen@connect.com'], due: '2026-10-14' },
      { project: designId, title: 'Mobile App Layout & Responsive Polish', description: 'Tune drawer navigation and touch interactions for mobile viewport devices.', status: 'in_progress', priority: 'medium', assignee: userMap['michael.brown@connect.com'], due: '2026-10-16' },

      // In Review
      { project: phoenixId, title: 'Stripe Webhook Signature Verification', description: 'Added cryptographic signature check on raw request buffer with secret rotation.', status: 'in_review', priority: 'urgent', assignee: userMap['sarah.chen@connect.com'], due: '2026-10-10' },
      { project: designId, title: 'Design System Tokens (V2 release)', description: 'Exported consistent HSL color tokens for dark/light themes and badge components.', status: 'in_review', priority: 'high', assignee: userMap['elena.rostova@connect.com'], due: '2026-10-11' },

      // Done
      { project: cloudId, title: 'Setup Multi-Tenant PostgreSQL Cluster', description: 'Provisioned high-availability database with automated backups and connection pooling.', status: 'done', priority: 'urgent', assignee: userMap['david.kim@connect.com'], due: '2026-10-01' },
      { project: phoenixId, title: 'REST API Documentation & Postman Collection', description: 'Generated OpenAPI specifications and collection with authenticated environments.', status: 'done', priority: 'medium', assignee: demoUserId, due: '2026-10-02' },
      { project: designId, title: 'Onboarding & Workspace Creation Flow', description: 'Implemented wizard for creating new organizations and inviting team collaborators.', status: 'done', priority: 'high', assignee: userMap['elena.rostova@connect.com'], due: '2026-10-03' },
      { project: cloudId, title: 'Configure GitHub Actions CI/CD Pipeline', description: 'Automated linting, test suite execution, and multi-stage Docker build pipeline.', status: 'done', priority: 'high', assignee: userMap['david.kim@connect.com'], due: '2026-10-04' },
    ];

    for (const t of tasks) {
      const [existingTask] = await dataSource.query(
        `SELECT id FROM tasks WHERE organization_id = $1 AND title = $2 AND deleted_at IS NULL`,
        [orgId, t.title]
      );
      if (!existingTask) {
        await dataSource.query(
          `INSERT INTO tasks (organization_id, project_id, title, description, status, priority, assigned_to, due_date, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [orgId, t.project, t.title, t.description, t.status, t.priority, t.assignee, t.due, demoUserId]
        );
      }
    }

    // 6. Activities
    const activities = [
      { event_type: 'task.moved', entity_type: 'task', payload: JSON.stringify({ title: 'Implement Socket.IO Real-Time Gateway', from: 'todo', to: 'in_progress' }), triggered_by: demoUserId },
      { event_type: 'task.completed', entity_type: 'task', payload: JSON.stringify({ title: 'Configure GitHub Actions CI/CD Pipeline', project: 'Cloud Infrastructure' }), triggered_by: userMap['david.kim@connect.com'] },
      { event_type: 'member.joined', entity_type: 'organization', payload: JSON.stringify({ member: 'Elena Rostova', role: 'member' }), triggered_by: userMap['elena.rostova@connect.com'] },
      { event_type: 'task.created', entity_type: 'task', payload: JSON.stringify({ title: 'Design System Tokens (V2 release)', priority: 'high' }), triggered_by: userMap['elena.rostova@connect.com'] },
    ];

    for (const a of activities) {
      await dataSource.query(
        `INSERT INTO activities (organization_id, event_type, entity_type, entity_id, payload, triggered_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orgId, a.event_type, a.entity_type, demoUserId, a.payload, a.triggered_by]
      );
    }

    console.log('✅ Demo data successfully seeded for Connect Workspace!');
  } finally {
    await dataSource.destroy();
  }
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
