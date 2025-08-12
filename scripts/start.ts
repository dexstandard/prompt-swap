import cron from 'node-cron';
import buildServer from '../src/server.js';
import { env } from '../src/util/env.js';
import { migrate } from '../src/db/index.js';
import rebalance from '../src/jobs/rebalance.js';

async function main() {
  migrate();
  const app = await buildServer();

  cron.schedule(env.CRON, () => rebalance(app.log));

  try {
    await app.listen({ port: 3000 });
    app.log.info('server started');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
