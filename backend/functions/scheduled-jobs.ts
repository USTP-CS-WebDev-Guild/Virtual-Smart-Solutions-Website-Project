import type { Config } from '@netlify/functions';
import { createDatabase } from '../lib/database';
import { runMaintenance } from '../services/notifications';

export const config: Config = { schedule: '*/5 * * * *' };

export default async function scheduledJobs(): Promise<void> {
  const result = await runMaintenance(createDatabase());
  console.info(
    JSON.stringify({
      event: 'maintenance_complete',
      processed: result.email.processed,
      captured: result.email.captured,
    }),
  );
}
