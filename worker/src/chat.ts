// worker/src/chat.ts
// AI Consultant chat handler

import { Env, jsonResponse } from './index';

interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
}

interface ChatRequest {
  message: string;
  turnstileToken: string;
  location?: string;
  history?: ChatMessage[];
}

// Rate limiting map (in-memory, per-instance)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export async function handleChat(
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
  let body: ChatRequest;
  try {
    body = await request.json() as ChatRequest;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400, corsHeaders);
  }

  const { message, turnstileToken, location, history } = body;

  if (!message || !turnstileToken) {
    return jsonResponse({ error: 'Missing required fields' }, 400, corsHeaders);
  }

  // Get client IP for rate limiting
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';

  // Check rate limit (10 requests per minute)
  const rateLimit = checkRateLimit(clientIP);
  if (rateLimit.exceeded) {
    return jsonResponse({ error: 'Rate limit exceeded' }, 429, corsHeaders);
  }

  // Validate Turnstile token
  const turnstileValid = await validateTurnstile(turnstileToken, env.TURNSTILE_SECRET_KEY);
  if (!turnstileValid) {
    return jsonResponse({ error: 'Invalid Turnstile token' }, 403, corsHeaders);
  }

  // Get or create visitor ID
  const visitorId = await getOrCreateVisitorId(clientIP, env.DB);

  // Check quota (5 questions per day)
  const quota = await checkQuota(visitorId, env.DB);
  if (quota.exceeded) {
    return jsonResponse({
      response: 'Лимит вопросов исчерпан. Позвоните нам: +7 (495) 722‑36‑27 или оставьте заявку — перезвоним.',
      quotaRemaining: 0,
    }, 200, corsHeaders);
  }

  // Geo check - Moscow only (soft filter)
  const city = request.cf?.city;
  const region = request.cf?.region;
  const isMoscow = city === 'Moscow' || (region && region.includes('Moscow'));

  if (!isMoscow && location === 'other') {
    return jsonResponse({
      response: 'Мы специализируемся на обслуживании клиентов в центре и на северо-западе Москвы. Ближайшие к вам сервисы можно найти на картах. Если вы готовы приехать к нам — с удовольствием поможем!',
      quotaRemaining: quota.remaining,
    }, 200, corsHeaders);
  }

  // Determine intent
  const intent = determineIntent(message);

  // Generate response based on intent
  const response = await generateResponse(intent, message, history || [], env);

  // Increment quota
  await incrementQuota(visitorId, env.DB);

  return jsonResponse({
    response,
    quotaRemaining: quota.remaining - 1,
  }, 200, corsHeaders);
}

// Validate Turnstile token
async function validateTurnstile(token: string, secret: string): Promise<boolean> {
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret,
        response: token,
      }),
    });

    const data = await response.json() as { success: boolean };
    return data.success;
  } catch (error) {
    console.error('Turnstile validation error:', error);
    return false;
  }
}

// Check rate limit
function checkRateLimit(ip: string): { exceeded: boolean } {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 10;

  const entry = rateLimitMap.get(ip);
  
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return { exceeded: false };
  }

  if (entry.count >= maxRequests) {
    return { exceeded: true };
  }

  entry.count++;
  return { exceeded: false };
}

// Get or create visitor ID
async function getOrCreateVisitorId(ip: string, db: D1Database): Promise<string> {
  // Simple hash of IP for visitor ID
  const encoder = new TextEncoder();
  const data = encoder.encode(ip);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

// Check daily quota
async function checkQuota(visitorId: string, db: D1Database): Promise<{ exceeded: boolean; remaining: number }> {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    const result = await db
      .prepare('SELECT used_count FROM chat_quota WHERE visitor_id = ? AND window_start = ?')
      .bind(visitorId, today)
      .first<{ used_count: number }>();

    const used = result?.used_count || 0;
    const maxQuota = 5;

    return {
      exceeded: used >= maxQuota,
      remaining: Math.max(0, maxQuota - used),
    };
  } catch (error) {
    console.error('Quota check error:', error);
    return { exceeded: false, remaining: 5 };
  }
}

// Increment quota
async function incrementQuota(visitorId: string, db: D1Database): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    await db
      .prepare(`
        INSERT INTO chat_quota (visitor_id, window_start, used_count)
        VALUES (?, ?, 1)
        ON CONFLICT(visitor_id, window_start) DO UPDATE SET
        used_count = used_count + 1
      `)
      .bind(visitorId, today)
      .run();
  } catch (error) {
    console.error('Quota increment error:', error);
  }
}

// Determine intent from message
function determineIntent(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  // Intent keywords
  const intents: Record<string, string[]> = {
    booking: ['запись', 'записаться', 'приехать', 'метро', 'адрес', 'как добраться', 'телефон', 'часы работы'],
    to: ['то', 'техобслуживание', 'масло', 'фильтр', 'регламент', 'через сколько менять'],
    symptoms: ['стучит', 'скрипит', 'горит лампа', 'ошибка', 'не заводится', 'вибрация', 'тянет'],
    prices: ['сколько стоит', 'цена', 'прайс', 'дорого'],
    guarantee: ['гарантия', 'что если', 'возврат', 'претензия', 'условия', 'хранение'],
  };

  for (const [intent, keywords] of Object.entries(intents)) {
    if (keywords.some(kw => lowerMessage.includes(kw))) {
      return intent;
    }
  }

  return 'general';
}

// Generate response using Groq
async function generateResponse(
  intent: string,
  message: string,
  history: ChatMessage[],
  env: Env
): Promise<string> {
  // System prompt
  const systemPrompt = `Ты — онлайн-консультант автосервиса СВК Авто.
Отвечай кратко, по-русски, дружелюбно и профессионально.
Никогда не придумывай цены, адреса, сроки, гарантии.
Если не уверен — предлагай позвонить по номеру +7 (495) 722‑36‑27 или +7 (495) 722‑36‑15.
Никогда не давай советы по самостоятельному ремонту узлов безопасности (тормоза, рулевое, ходовая).
Не называй конкурентов.

ФАКТЫ О КОМПАНИИ:
- Название: СВК Авто, ООО «СВК Авто Плюс»
- Адреса: ул. Поклонная, д. 11, стр. 1 (м. Парк Победы) и Кутузовский пр-т, д. 88
- Телефоны: +7 (495) 722‑36‑27 и +7 (495) 722‑36‑15
- Режим: ежедневно 09:00–20:00
- ТО за 5 000 ₽ (до 4,5 л масла), 7 000 ₽ (более 4,5 л)
- Гарантия на работы до 6 месяцев`;

  // Intent-specific prompts
  const intentPrompts: Record<string, string> = {
    booking: 'Пользователь спрашивает о записи, адресе или телефоне. Дай контакты и предложи записаться.',
    to: 'Пользователь спрашивает о ТО. Расскажи про ТО за 5 000 ₽ и что в него входит.',
    symptoms: 'Пользователь описывает симптомы. Не ставь диагноз, предложи приехать на диагностику (680 ₽).',
    prices: 'Пользователь спрашивает о ценах. Дай ориентировочные цены из прайса, уточни что точная цена после диагностики.',
    guarantee: 'Пользователь спрашивает о гарантии. Приведи сроки гарантии по видам работ.',
  };

  const userPrompt = intentPrompts[intent] 
    ? `${intentPrompts[intent]}\n\nСообщение пользователя: ${message}`
    : message;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          ...history.slice(-4).map(m => ({ 
            role: m.sender === 'user' ? 'user' : 'assistant', 
            content: m.text 
          })),
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    return data.choices[0]?.message?.content || 'Извините, произошла ошибка. Пожалуйста, позвоните нам: +7 (495) 722‑36‑27';
  } catch (error) {
    console.error('Groq error:', error);
    return 'Извините, произошла ошибка. Пожалуйста, позвоните нам: +7 (495) 722‑36‑27';
  }
}
