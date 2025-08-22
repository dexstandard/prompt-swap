import { schedule } from 'node-cron';
import buildServer from '../src/server.js';
import { env } from '../src/util/env.js';
import { migrate } from '../src/db/index.js';
import reviewPortfolio from '../src/jobs/review-portfolio.js';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Logger } from 'pino';

async function main() {
  migrate();
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const routesDir = path.join(__dirname, '../src/routes');
  const app = await buildServer(routesDir);

  schedule(env.CRON, () => reviewPortfolio(app.log as unknown as Logger));

  try {
    await app.listen({ port: 3000 });
    (app.log as unknown as Logger).info('server started');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
