// worker/src/prices.ts
// Admin price management handler

import { Env, jsonResponse } from './index';

interface PriceItem {
  id: string;
  service: string;
  price: string;
  note: string;
  category: string;
  sort_order: number;
}

function getAdminCredentials(env: Env): { username: string; password: string } {
  return {
    username: env.ADMIN_USERNAME || 'admin',
    password: env.ADMIN_PASSWORD || '',
  };
}

export async function handleGetPrices(
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const result = await env.DB
      .prepare('SELECT * FROM prices ORDER BY sort_order ASC, id ASC')
      .all<PriceItem>();

    return jsonResponse({ prices: result.results || [] }, 200, corsHeaders);
  } catch (error) {
    console.error('Get prices error:', error);
    return jsonResponse({ error: 'Failed to fetch prices' }, 500, corsHeaders);
  }
}

export async function handleUpdatePrices(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  // Check auth
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders);
  }

  const base64 = authHeader.slice(6);
  const decoded = atob(base64);
  const [username, password] = decoded.split(':');

  const creds = getAdminCredentials(env);
  if (!creds.password || username !== creds.username || password !== creds.password) {
    return jsonResponse({ error: 'Invalid credentials' }, 401, corsHeaders);
  }

  // Parse request
  let body: { prices: PriceItem[] };
  try {
    body = await request.json() as { prices: PriceItem[] };
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400, corsHeaders);
  }

  if (!body.prices || !Array.isArray(body.prices)) {
    return jsonResponse({ error: 'Invalid prices data' }, 400, corsHeaders);
  }

  try {
    // Update each price
    for (const item of body.prices) {
      await env.DB
        .prepare(`
          INSERT INTO prices (id, service, price, note, category, sort_order)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            service = excluded.service,
            price = excluded.price,
            note = excluded.note,
            category = excluded.category,
            sort_order = excluded.sort_order
        `)
        .bind(item.id, item.service, item.price, item.note || '', item.category || '', item.sort_order || 0)
        .run();
    }

    return jsonResponse({ success: true, message: 'Цены обновлены' }, 200, corsHeaders);
  } catch (error) {
    console.error('Update prices error:', error);
    return jsonResponse({ error: 'Failed to update prices' }, 500, corsHeaders);
  }
}
