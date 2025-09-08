import { migrate, db } from './index.js';

migrate()
  .then(() => db.end())
  .catch((err) => {
    console.error(err);
    db.end().finally(() => process.exit(1));
  });
