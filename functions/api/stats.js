import { createClient } from '@libsql/client';

function getClient(env) {
  return createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });
}

export async function onRequestGet(context) {
  const client = getClient(context.env);

  const [byMonth, byPlace] = await Promise.all([
    client.execute(`
      SELECT strftime('%Y-%m', date) AS month, ROUND(SUM(amount), 2) AS total
      FROM expenditures
      GROUP BY month
      ORDER BY month ASC
      LIMIT 12
    `),
    client.execute(`
      SELECT place, ROUND(SUM(amount), 2) AS total
      FROM expenditures
      GROUP BY place
      ORDER BY total DESC
      LIMIT 10
    `),
  ]);

  return new Response(
    JSON.stringify({
      byMonth: byMonth.rows.map((r) => ({ month: r.month, total: r.total })),
      byPlace: byPlace.rows.map((r) => ({ place: r.place, total: r.total })),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}
