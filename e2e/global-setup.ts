import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const backendDir = fileURLToPath(new URL('../backend', import.meta.url));

function wrangler(args: string[]) {
  execFileSync('npx', ['wrangler', ...args], { cwd: backendDir, stdio: 'inherit' });
}

export default function globalSetup() {
  wrangler(['d1', 'migrations', 'apply', 'DB', '--local']);
  wrangler([
    'd1',
    'execute',
    'DB',
    '--local',
    '--command',
    'DELETE FROM chores; DELETE FROM rooms; DELETE FROM join_requests; DELETE FROM household_members; DELETE FROM user_notifications; DELETE FROM users; DELETE FROM households;',
  ]);
  wrangler([
    'd1',
    'execute',
    'DB',
    '--local',
    '--command',
    "INSERT INTO households (id, name, timezone) VALUES (1, 'E2E Household', 'UTC'); " +
      // Zero members on purpose — lets an admin cross-household add-user test
      // target somewhere other than their own current household.
      "INSERT INTO households (id, name, timezone) VALUES (2, 'E2E Household B', 'UTC'); " +
      // A second household admin-e2e belongs to, distinct from household 2
      // above — gives that user 2 memberships so the admin-panel household
      // switcher (HouseholdSection.tsx) actually renders in e2e/local dev,
      // rather than only being exercised by frontend unit tests. Deliberately
      // has no rooms seeded, so switching to it is visibly distinguishable
      // from household 1.
      "INSERT INTO households (id, name, timezone) VALUES (3, 'E2E Household C', 'UTC'); " +
      "INSERT INTO users (id, email, timezone, is_admin) VALUES (1, 'admin-e2e@example.com', 'America/Los_Angeles', 1); " +
      "INSERT INTO users (id, email, timezone, is_admin) VALUES (2, 'member-e2e@example.com', 'Europe/London', 0); " +
      'INSERT INTO household_members (user_id, household_id) VALUES (1, 1); ' +
      'INSERT INTO household_members (user_id, household_id) VALUES (2, 1); ' +
      'INSERT INTO household_members (user_id, household_id) VALUES (1, 3); ' +
      "INSERT INTO rooms (id, household_id, name) VALUES (1, 1, 'Living Room'); " +
      "INSERT INTO rooms (id, household_id, name) VALUES (2, 1, 'Kitchen'); " +
      "INSERT INTO chores (household_id, name, room_id, date_last_completed, duration, frequency, version) VALUES (1, 'Vacuum', 1, '2026-06-01T00:00:00.000Z', 20, 7, 1); " +
      "INSERT INTO chores (household_id, name, room_id, date_last_completed, duration, frequency, version) VALUES (1, 'Dishes', 2, '2026-06-20T00:00:00.000Z', 5, 1, 1);",
  ]);
}
