// worker/src/index.ts
// Main router for Cloudflare Worker

import { handleChat } from './chat';
import { handlePublisher } from './publisher';
import { handlePlanner } from './planner';
import { handleCallback } from './callback';
import { handleGetPrices, handleUpdatePrices } from './prices';

export interface Env {
  DB: D1Database;
  GROQ_API_KEY: string;
  GITHUB_TOKEN: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
  SITE_BASE_URL: string;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
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

      // Prices API - public GET
      if (path === '/api/prices' && method === 'GET') {
        return handleGetPrices(env, corsHeaders);
      }

      // Prices API - admin POST (update)
      if (path === '/api/prices' && method === 'POST') {
        return handleUpdatePrices(request, env, corsHeaders);
      }

      // Admin panel page
      if (path === '/admin/prices/' || path === '/admin/prices') {
        return serveAdminPage(corsHeaders);
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

// Serve admin panel HTML page
function serveAdminPage(corsHeaders: Record<string, string>): Response {
  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Админ-панель — СВК Авто</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      background: #f5f5f5;
      color: #222;
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    .subtitle { color: #666; margin-bottom: 24px; }
    .login-form {
      max-width: 400px; margin: 80px auto; background: #fff;
      padding: 32px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    }
    .login-form h2 { margin-bottom: 20px; }
    .login-form input {
      width: 100%; padding: 10px 14px; margin-bottom: 12px;
      border: 1px solid #ddd; border-radius: 8px; font-size: 15px;
    }
    .login-form button {
      width: 100%; padding: 12px; background: #0d4d99; color: #fff;
      border: none; border-radius: 8px; font-size: 16px; cursor: pointer;
    }
    .login-form button:hover { background: #0a3d7a; }
    .login-error { color: #d32f2f; margin-top: 8px; font-size: 14px; display: none; }
    .admin-panel { display: none; }
    .admin-panel.show { display: block; }
    .login-form.hide { display: none; }
    .toolbar {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 20px; flex-wrap: wrap; gap: 12px;
    }
    .toolbar button {
      padding: 10px 20px; border: none; border-radius: 8px;
      font-size: 14px; cursor: pointer;
    }
    .btn-save { background: #0d4d99; color: #fff; }
    .btn-save:hover { background: #0a3d7a; }
    .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-reset { background: #e0e0e0; color: #333; }
    .btn-reset:hover { background: #ccc; }
    .btn-logout { background: #d32f2f; color: #fff; }
    .btn-logout:hover { background: #b71c1c; }
    .save-status {
      padding: 8px 16px; border-radius: 8px; font-size: 14px;
      display: none; margin-bottom: 16px;
    }
    .save-status.success { display: block; background: #e8f5e9; color: #2e7d32; }
    .save-status.error { display: block; background: #ffebee; color: #c62828; }
    .save-status.loading { display: block; background: #e3f2fd; color: #1565c0; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
    th { background: #f8f9fa; text-align: left; padding: 12px 16px; font-size: 13px; color: #666; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #eee; }
    td { padding: 10px 16px; border-bottom: 1px solid #f0f0f0; vertical-align: middle; }
    tr:hover td { background: #fafafa; }
    td input, td textarea {
      width: 100%; padding: 8px 10px; border: 1px solid #ddd;
      border-radius: 6px; font-size: 14px; transition: border-color 0.2s;
    }
    td input:focus, td textarea:focus { outline: none; border-color: #0d4d99; }
    td textarea { resize: vertical; min-height: 36px; }
    .category-badge {
      display: inline-block; padding: 2px 8px; border-radius: 4px;
      font-size: 11px; font-weight: 600; text-transform: uppercase;
    }
    .category-main { background: #e3f2fd; color: #1565c0; }
    .category-to { background: #e8f5e9; color: #2e7d32; }
    .category-diagnostics { background: #fff3e0; color: #e65100; }
    .category-engine { background: #fce4ec; color: #c62828; }
    .category-suspension { background: #f3e5f5; color: #6a1b9a; }
    .category-brakes { background: #e0f2f1; color: #00695c; }
    .category-transmission { background: #fbe9e7; color: #bf360c; }
    .category-ac { background: #e1f5fe; color: #0277bd; }
    .category-body { background: #fff8e1; color: #f57f17; }
    .category-tires { background: #e8eaf6; color: #283593; }
    .category-polishing { background: #fce4ec; color: #880e4f; }
    .category-extras { background: #f1f8e9; color: #558b2f; }
    .category-wheel-alignment { background: #ede7f6; color: #4527a0; }
    .loading-overlay {
      display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(255,255,255,0.8); z-index: 1000;
      justify-content: center; align-items: center; font-size: 18px;
    }
    .loading-overlay.show { display: flex; }
    .loading-spinner {
      width: 40px; height: 40px; border: 4px solid #e0e0e0;
      border-top-color: #0d4d99; border-radius: 50%; animation: spin 0.8s linear infinite;
      margin-right: 12px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .unsaved-indicator {
      display: none; font-size: 13px; color: #e65100; margin-left: 8px;
    }
    .unsaved-indicator.show { display: inline; }
    @media (max-width: 768px) {
      table { font-size: 13px; }
      th, td { padding: 8px 10px; }
      .toolbar { flex-direction: column; align-items: stretch; }
      .toolbar button { width: 100%; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Login Form -->
    <div class="login-form" id="loginForm">
      <h2>Вход в админ-панель</h2>
      <input type="text" id="loginUser" placeholder="Логин" autocomplete="username">
      <input type="password" id="loginPass" placeholder="Пароль" autocomplete="current-password">
      <button onclick="login()">Войти</button>
      <div class="login-error" id="loginError">Неверный логин или пароль</div>
    </div>

    <!-- Admin Panel -->
    <div class="admin-panel" id="adminPanel">
      <h1>Админ-панель — Управление ценами</h1>
      <p class="subtitle">Редактируйте цены на услуги. Изменения сохраняются в базу данных и сразу отображаются на сайте.</p>

      <div class="save-status" id="saveStatus"></div>

      <div class="toolbar">
        <div>
          <button class="btn-save" id="saveBtn" onclick="savePrices()">💾 Сохранить все изменения</button>
          <span class="unsaved-indicator" id="unsavedIndicator">✏️ Есть несохранённые изменения</span>
        </div>
        <div>
          <button class="btn-reset" onclick="loadPrices()">↻ Сбросить</button>
          <button class="btn-logout" onclick="logout()">🚪 Выйти</button>
        </div>
      </div>

      <div id="tableContainer">
        <div style="text-align:center;padding:40px;color:#999;">Загрузка...</div>
      </div>
    </div>

    <!-- Loading Overlay -->
    <div class="loading-overlay" id="loadingOverlay">
      <div class="loading-spinner"></div>
      <span>Сохранение...</span>
    </div>
  </div>

  <script>
    let pricesData = [];
    let originalPricesData = [];
    let hasUnsavedChanges = false;
    let authToken = '';

    // Check if already logged in (session storage)
    const savedAuth = sessionStorage.getItem('svk_admin_auth');
    if (savedAuth) {
      authToken = savedAuth;
      document.getElementById('loginForm').classList.add('hide');
      document.getElementById('adminPanel').classList.add('show');
      loadPrices();
    }

    function login() {
      const user = document.getElementById('loginUser').value;
      const pass = document.getElementById('loginPass').value;
      const token = btoa(user + ':' + pass);
      
      // Test the credentials by fetching prices
      fetch('/api/prices', {
        headers: { 'Authorization': 'Basic ' + token }
      }).then(r => {
        if (r.ok) {
          authToken = token;
          sessionStorage.setItem('svk_admin_auth', token);
          document.getElementById('loginForm').classList.add('hide');
          document.getElementById('adminPanel').classList.add('show');
          document.getElementById('loginError').style.display = 'none';
          loadPrices();
        } else {
          document.getElementById('loginError').style.display = 'block';
        }
      }).catch(() => {
        document.getElementById('loginError').style.display = 'block';
      });
    }

    function logout() {
      sessionStorage.removeItem('svk_admin_auth');
      authToken = '';
      document.getElementById('loginForm').classList.remove('hide');
      document.getElementById('adminPanel').classList.remove('show');
      document.getElementById('loginUser').value = '';
      document.getElementById('loginPass').value = '';
    }

    function loadPrices() {
      const container = document.getElementById('tableContainer');
      container.innerHTML = '<div style="text-align:center;padding:40px;color:#999;">Загрузка...</div>';
      
      fetch('/api/prices')
        .then(r => r.json())
        .then(data => {
          pricesData = data.prices || [];
          originalPricesData = JSON.parse(JSON.stringify(pricesData));
          hasUnsavedChanges = false;
          updateUnsavedIndicator();
          renderTable();
        })
        .catch(err => {
          container.innerHTML = '<div style="text-align:center;padding:40px;color:#d32f2f;">Ошибка загрузки: ' + err.message + '</div>';
        });
    }

    function renderTable() {
      const container = document.getElementById('tableContainer');
      
      if (pricesData.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:#999;">Нет данных о ценах</div>';
        return;
      }

      // Group by category
      const categories = {};
      pricesData.forEach(item => {
        const cat = item.category || 'main';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(item);
      });

      let html = '<table><thead><tr><th style="width:40%">Услуга</th><th style="width:20%">Цена</th><th style="width:40%">Примечание</th></tr></thead><tbody>';

      const categoryNames = {
        'main': 'Основные услуги',
        'to': 'Техническое обслуживание',
        'diagnostics': 'Диагностика',
        'engine': 'Ремонт двигателя',
        'suspension': 'Ходовая часть',
        'brakes': 'Тормозная система',
        'transmission': 'АКПП и МКПП',
        'ac': 'Кондиционер',
        'body': 'Кузовной ремонт',
        'tires': 'Шиномонтаж',
        'polishing': 'Полировка и химчистка',
        'extras': 'Доп. оборудование',
        'wheel-alignment': 'Сход-развал'
      };

      Object.keys(categories).forEach(cat => {
        const catName = categoryNames[cat] || cat;
        html += '<tr style="background:#f8f9fa;"><td colspan="3" style="font-weight:700;font-size:15px;padding:14px 16px;"><span class="category-badge category-' + cat + '">' + catName + '</span></td></tr>';
        
        categories[cat].forEach(item => {
          html += '<tr data-id="' + item.id + '">';
          html += '<td><input type="text" value="' + escapeHtml(item.service) + '" onchange="updateField(\'' + item.id + '\',\'service\',this.value)"></td>';
          html += '<td><input type="text" value="' + escapeHtml(item.price) + '" onchange="updateField(\'' + item.id + '\',\'price\',this.value)"></td>';
          html += '<td><textarea rows="1" onchange="updateField(\'' + item.id + '\',\'note\',this.value)">' + escapeHtml(item.note || '') + '</textarea></td>';
          html += '</tr>';
        });
      });

      html += '</tbody></table>';
      container.innerHTML = html;
    }

    function updateField(id, field, value) {
      const item = pricesData.find(p => p.id === id);
      if (item) {
        item[field] = value;
        checkUnsavedChanges();
      }
    }

    function checkUnsavedChanges() {
      hasUnsavedChanges = JSON.stringify(pricesData) !== JSON.stringify(originalPricesData);
      updateUnsavedIndicator();
    }

    function updateUnsavedIndicator() {
      const indicator = document.getElementById('unsavedIndicator');
      if (hasUnsavedChanges) {
        indicator.classList.add('show');
      } else {
        indicator.classList.remove('show');
      }
    }

    function savePrices() {
      const overlay = document.getElementById('loadingOverlay');
      const status = document.getElementById('saveStatus');
      const saveBtn = document.getElementById('saveBtn');
      
      overlay.classList.add('show');
      status.className = 'save-status loading';
      status.textContent = 'Сохранение...';
      saveBtn.disabled = true;

      fetch('/api/prices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + authToken
        },
        body: JSON.stringify({ prices: pricesData })
      })
      .then(r => r.json())
      .then(data => {
        overlay.classList.remove('show');
        saveBtn.disabled = false;
        
        if (data.success) {
          status.className = 'save-status success';
          status.textContent = '✅ Цены успешно сохранены!';
          originalPricesData = JSON.parse(JSON.stringify(pricesData));
          hasUnsavedChanges = false;
          updateUnsavedIndicator();
          setTimeout(() => { status.className = 'save-status'; }, 3000);
        } else {
          status.className = 'save-status error';
          status.textContent = '❌ Ошибка: ' + (data.error || 'Неизвестная ошибка');
        }
      })
      .catch(err => {
        overlay.classList.remove('show');
        saveBtn.disabled = false;
        status.className = 'save-status error';
        status.textContent = '❌ Ошибка сети: ' + err.message;
      });
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Keyboard shortcut: Ctrl+S to save
    document.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (document.getElementById('adminPanel').classList.contains('show')) {
          savePrices();
        }
      }
    });
  </script>
</body>
</html>`;
  
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...corsHeaders,
    },
  });
}
