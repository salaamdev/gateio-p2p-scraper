// Simple, fast, non-blocking healthcheck
const fs = require('fs/promises');
const path = require('path');

async function check() {
  // 1) Verify critical runtime deps are importable (no side effects)
  try { require('puppeteer'); } catch (e) { throw new Error(`puppeteer missing: ${e.message}`); }
  try { require('sqlite3'); } catch (e) { throw new Error(`sqlite3 missing: ${e.message}`); }

  // 2) Verify data/logs dirs are writable
  const root = path.join(__dirname, '..');
  const dataDir = path.join(root, 'data');
  const logsDir = path.join(root, 'logs');

  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(logsDir, { recursive: true });

  const testFile = path.join(dataDir, `.healthcheck_${Date.now()}.tmp`);
  await fs.writeFile(testFile, 'ok');
  await fs.unlink(testFile).catch(() => {});

  // 3) Basic env sanity (optional)
  if (!process.env.NODE_ENV) {
    // Default to production semantics for container healthchecks
    process.env.NODE_ENV = 'production';
  }

  return 'OK';
}

if (require.main === module) {
  check()
    .then((msg) => {
      console.log(msg);
  // Exit immediately to avoid lingering handles in some environments
  // eslint-disable-next-line n/no-process-exit
  process.exit(0);
    })
    .catch((e) => {
      console.error(`HEALTHCHECK_FAILED: ${e.message}`);
  // eslint-disable-next-line n/no-process-exit
  process.exit(1);
    });
}

module.exports = { check };
