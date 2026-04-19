import { createClient } from '@libsql/client/web';

function getClient(env) {
  return createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });
}

async function initDb(client) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS expenditures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      place TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderRows(rows) {
  if (!rows.length) {
    return '<tr><td colspan="3" class="empty">No expenditures yet.</td></tr>';
  }
  return rows
    .map(
      (r) => `<tr>
      <td>${escapeHtml(r.date)}</td>
      <td>${escapeHtml(r.place)}</td>
      <td class="amount">$${parseFloat(r.amount).toFixed(2)}</td>
    </tr>`
    )
    .join('');
}

export async function onRequestGet(context) {
  const client = getClient(context.env);
  await initDb(client);

  const result = await client.execute(
    'SELECT place, amount, date FROM expenditures ORDER BY date DESC, created_at DESC LIMIT 50'
  );

  return new Response(renderRows(result.rows), {
    headers: { 'Content-Type': 'text/html' },
  });
}

export async function onRequestPost(context) {
  const client = getClient(context.env);
  await initDb(client);

  const formData = await context.request.formData();
  const place = formData.get('place')?.trim();
  const amount = parseFloat(formData.get('amount'));
  const date = formData.get('date')?.trim();

  if (!place || isNaN(amount) || amount <= 0 || !date) {
    return new Response('<tr><td colspan="3" class="error">Invalid input — all fields are required.</td></tr>', {
      status: 422,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  await client.execute({
    sql: 'INSERT INTO expenditures (place, amount, date) VALUES (?, ?, ?)',
    args: [place, amount, date],
  });

  const result = await client.execute(
    'SELECT place, amount, date FROM expenditures ORDER BY date DESC, created_at DESC LIMIT 50'
  );

  return new Response(renderRows(result.rows), {
    headers: { 'Content-Type': 'text/html' },
  });
}
