import { schedule } from 'node-cron';
import buildServer from '../src/server.js';
import '../src/util/env.js';
import { migrate } from '../src/db/index.js';
import reviewPortfolios from '../src/jobs/review-portfolio.js';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

async function main() {
  migrate();
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const routesDir = path.join(__dirname, '../src/routes');
  const app = await buildServer(routesDir);
  const log = app.log;

  const schedules: Record<string, string> = {
    '1h': '0 * * * *',
    '3h': '0 */3 * * *',
    '5h': '0 */5 * * *',
    '12h': '0 */12 * * *',
    '24h': '0 0 * * *',
    '3d': '0 0 */3 * *',
    '1w': '0 0 * * 0',
  };
  for (const [interval, cronExp] of Object.entries(schedules)) {
    schedule(cronExp, () => reviewPortfolios(log, interval));
  }

  try {
    await app.listen({ port: 3000 });
    log.info('server started');
  } catch (err) {
    log.error(err);
    process.exit(1);
  }
}

main();
