// worker/src/index.ts
// Main router for Cloudflare Worker

import { handleChat } from './chat';
import { handlePublisher } from './publisher';
import { handlePlanner } from './planner';
import { handleCallback } from './callback';

export interface Env {
  DB: D1Database;
  GROQ_API_KEY: string;
  GITHUB_TOKEN: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
  SITE_BASE_URL: string;
  CHAT_AUTH_TOKEN: string;
  TURNSTILE_SECRET_KEY: string;
  INDEXNOW_KEY: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'https://svkautoplus.ru',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Health check
      if (path === '/api/health' && method === 'GET') {
        return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
      }

      // AI Chat endpoint
      if (path === '/api/consult/chat' && method === 'POST') {
        return handleChat(request, env, corsHeaders);
      }

      // Callback form endpoint
      if (path === '/api/callback' && method === 'POST') {
        return handleCallback(request, env, corsHeaders);
      }

      // Manual trigger for publisher (protected)
      if (path === '/api/run-now' && method === 'POST') {
        return handleRunNow(request, env, ctx);
      }

      // Manual trigger for planner (protected)
      if (path === '/api/plan-now' && method === 'POST') {
        return handlePlanNow(request, env, ctx);
      }

      // 404 for unknown routes
      return jsonResponse({ error: 'Not found' }, 404);

    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse({ error: 'Internal server error' }, 500);
    }
  },

  // Scheduled handler for cron triggers
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const now = new Date();
    
    // Convert to Moscow time
    const moscowTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
    const dayOfWeek = moscowTime.getDay();
    
    // Check if it's Monday (1), Wednesday (3), or Friday (5)
    const isPublishingDay = [1, 3, 5].includes(dayOfWeek);
    
    if (isPublishingDay) {
      console.log('Running publisher for date:', moscowTime.toISOString());
      ctx.waitUntil(handlePublisher(env));
    }
    
    // Run planner on Sundays if needed (or check threshold)
    if (dayOfWeek === 0) {
      console.log('Running planner check');
      ctx.waitUntil(handlePlanner(env));
    }
  },
};

// Handle manual publisher trigger
async function handleRunNow(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  const expectedToken = `Bearer ${env.CHAT_AUTH_TOKEN}`;
  
  if (authHeader !== expectedToken) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }
  
  ctx.waitUntil(handlePublisher(env));
  return jsonResponse({ message: 'Publisher triggered' });
}

// Handle manual planner trigger
async function handlePlanNow(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  const expectedToken = `Bearer ${env.CHAT_AUTH_TOKEN}`;
  
  if (authHeader !== expectedToken) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }
  
  ctx.waitUntil(handlePlanner(env));
  return jsonResponse({ message: 'Planner triggered' });
}

// Helper for JSON responses
export function jsonResponse(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}
