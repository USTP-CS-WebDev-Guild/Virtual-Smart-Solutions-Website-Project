import type { PGlite } from '@electric-sql/pglite';

// Test-only transport adapter. The SQL functions and records are real embedded
// PostgreSQL; provider networking and token validation are isolated here.
export function postgresTransport(database: PGlite) {
  const functions: Record<string, Array<[string, string]>> = {
    consume_rate_limit: [
      ['p_bucket_key', 'text'],
      ['p_window_start', 'bigint'],
      ['p_now', 'bigint'],
      ['p_limit', 'integer'],
    ],
    submit_inquiry: [
      ['p_payload', 'jsonb'],
      ['p_now', 'bigint'],
    ],
    submit_privacy_request: [
      ['p_payload', 'jsonb'],
      ['p_now', 'bigint'],
    ],
    get_dashboard_counts: [],
    get_realtime_setup: [],
    probe_realtime: [],
    publish_site_content: [
      ['p_expected_revision', 'integer'],
      ['p_content', 'jsonb'],
      ['p_actor_email', 'text'],
      ['p_now', 'bigint'],
    ],
    add_inquiry_note: [
      ['p_id', 'uuid'],
      ['p_inquiry_id', 'uuid'],
      ['p_body', 'text'],
      ['p_actor_email', 'text'],
      ['p_now', 'bigint'],
    ],
    change_client_status: [
      ['p_client_id', 'uuid'],
      ['p_status', 'text'],
      ['p_actor_email', 'text'],
      ['p_now', 'bigint'],
    ],
    complete_privacy_request: [
      ['p_request_id', 'uuid'],
      ['p_actor_email', 'text'],
      ['p_action', 'text'],
      ['p_note', 'text'],
      ['p_now', 'bigint'],
    ],
    get_notification_health: [['p_now', 'bigint']],
    change_inquiry_status: [
      ['p_inquiry_id', 'uuid'],
      ['p_status', 'text'],
      ['p_actor_email', 'text'],
      ['p_now', 'bigint'],
    ],
    convert_inquiry: [
      ['p_inquiry_id', 'uuid'],
      ['p_actor_email', 'text'],
      ['p_now', 'bigint'],
    ],
    claim_outbox_batch: [
      ['p_now', 'bigint'],
      ['p_limit', 'integer'],
    ],
    anonymize_expired_data: [
      ['p_now', 'bigint'],
      ['p_retention_ms', 'bigint'],
    ],
  };
  const identifier = (value: string) => {
    if (!/^[a-z_]+$/.test(value)) throw new Error('invalid_test_identifier');
    return '"' + value + '"';
  };
  return {
    auth: {
      getUser: async (token: string) =>
        token === 'synthetic-owner-token'
          ? { data: { user: { id: '10000000-0000-4000-8000-000000000001', email: 'owner@example.test', email_confirmed_at: '2026-01-01T00:00:00Z' } }, error: null }
          : { data: { user: null }, error: new Error('invalid_token') },
    },
    async rpc(name: string, values: Record<string, unknown> = {}) {
      const args = functions[name];
      if (!args) throw new Error('unsupported_test_rpc');
      const parameters = args.map(([key, type]) =>
        type === 'jsonb' ? JSON.stringify(values[key]) : values[key],
      );
      const placeholders = args.map(([, type], i) => `$${i + 1}::${type}`).join(',');
      if (name === 'claim_outbox_batch') {
        const result = await database.query(
          `select * from public.${identifier(name)}(${placeholders})`,
          parameters,
        );
        return { data: result.rows, error: null };
      }
      const result = await database.query<{ value: unknown }>(
        `select public.${identifier(name)}(${placeholders}) as value`,
        parameters,
      );
      return { data: result.rows[0].value, error: null };
    },
    from(table: string) {
      let columns = '*';
      let order = '';
      let limit: number | undefined;
      let single = false;
      let update: Record<string, unknown> | undefined;
      let cursor: { time: number; id: string } | null = null;
      const where: Array<[string, unknown[]]> = [];
      const query = {
        select(value: string) {
          columns = value === '*' ? '*' : value.split(',').map(identifier).join(',');
          return query;
        },
        eq(key: string, value: unknown) {
          where.push([identifier(key), [value]]);
          return query;
        },
        in(key: string, values: unknown[]) {
          where.push([identifier(key), values]);
          return query;
        },
        or(value: string) {
          const match =
            /^created_at\.lt\.(\d+),and\(created_at\.eq\.\1,id\.lt\.([0-9a-f-]{36})\)$/i.exec(
              value,
            );
          if (!match) throw new Error('unsupported_test_filter');
          cursor = { time: Number(match[1]), id: match[2]! };
          return query;
        },
        order(key: string, options: { ascending: boolean }) {
          order +=
            (order ? ',' : ' order by ') +
            `${identifier(key)} ${options.ascending ? 'asc' : 'desc'}`;
          return query;
        },
        limit(value: number) {
          limit = value;
          return query;
        },
        maybeSingle() {
          single = true;
          return query;
        },
        update(value: Record<string, unknown>) {
          update = value;
          return query;
        },
        then(resolve: (value: any) => unknown, reject?: (reason: unknown) => unknown) {
          const parameters: unknown[] = [];
          const bind = (value: unknown) => {
            parameters.push(value);
            return `$${parameters.length}`;
          };
          const assignments = Object.entries(update || {})
            .map(([key, value]) => `${identifier(key)}=${bind(value)}`)
            .join(',');
          const filters = where.map(([key, values]) => `${key} in (${values.map(bind).join(',')})`);
          if (cursor)
            filters.push(
              `(created_at<${bind(cursor.time)} or (created_at=${bind(cursor.time)} and id<${bind(cursor.id)}::uuid))`,
            );
          const filter = filters.length ? ' where ' + filters.join(' and ') : '';
          const boundLimit = limit === undefined ? '' : ' limit ' + bind(limit);
          const sql = update
            ? `update public.${identifier(table)} set ${assignments}${filter} returning ${columns}`
            : `select ${columns} from public.${identifier(table)}${filter}${order}${boundLimit}`;
          return database
            .query(sql, parameters)
            .then((result) => ({
              data: single ? result.rows[0] || null : result.rows,
              error: null,
            }))
            .then(resolve, reject);
        },
      };
      return query;
    },
  };
}
