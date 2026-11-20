const { execSync } = require('node:child_process');
const path = require('node:path');

// Applies pending migrations to the test DB (non-destructive). Tests create their own
// uniquely-named fixtures per run, so no reset/wipe is ever needed.
module.exports = async () => {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !/barit_test/.test(url)) {
    throw new Error('TEST_DATABASE_URL must point at the barit_test database');
  }
  execSync('npx prisma migrate deploy', {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: url, PRISMA_HIDE_UPDATE_MESSAGE: '1' },
    stdio: 'pipe',
  });
};
