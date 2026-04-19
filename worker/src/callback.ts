// worker/src/callback.ts
// Callback form handler

import { Env, jsonResponse } from './index';

interface CallbackRequest {
  name: string;
  phone: string;
  time: string;
}

export async function handleCallback(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  // Check origin
  const origin = request.headers.get('Origin');
  if (origin !== 'https://svkautoplus.ru') {
    return jsonResponse({ error: 'Forbidden' }, 403, corsHeaders);
  }

  // Parse request
  let body: CallbackRequest;
  try {
    body = await request.json() as CallbackRequest;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400, corsHeaders);
  }

  const { name, phone, time } = body;

  // Validate required fields
  if (!name || !phone) {
    return jsonResponse({ error: 'Missing required fields' }, 400, corsHeaders);
  }

  // Validate phone format (basic)
  const phoneRegex = /^\+7\s\(\d{3}\)\s\d{3}-\d{2}-\d{2}$/;
  if (!phoneRegex.test(phone)) {
    return jsonResponse({ error: 'Invalid phone format' }, 400, corsHeaders);
  }

  // Store in database
  try {
    await env.DB
      .prepare(`
        INSERT INTO callbacks (name, phone, preferred_time, created_at, status)
        VALUES (?, ?, ?, ?, ?)
      `)
      .bind(
        name,
        phone,
        time || 'day',
        new Date().toISOString(),
        'new'
      )
      .run();

    // TODO: Send notification to admin (email, Telegram, etc.)
    // For now, just log
    console.log('New callback request:', { name, phone, time });

    return jsonResponse({ 
      success: true, 
      message: 'Заявка принята. Перезвоним в течение 30 минут.' 
    }, 200, corsHeaders);

  } catch (error) {
    console.error('Callback storage error:', error);
    return jsonResponse({ error: 'Failed to save request' }, 500, corsHeaders);
  }
}
