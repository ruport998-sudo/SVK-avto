# СВК Авто — премиальный сайт автосервиса

## Описание

Современный, быстрый и SEO-оптимизированный сайт для автосервиса «СВК Авто». Включает статический сайт на Jekyll (GitHub Pages) и Cloudflare Worker для AI-консультанта и автоматического блога.

## Структура проекта

```
svkauto-website/
├── _config.yml              # Конфигурация Jekyll
├── _layouts/                # HTML-шаблоны
│   ├── default.html         # Базовый шаблон
│   ├── page.html            # Шаблон страницы
│   ├── post.html            # Шаблон статьи блога
│   └── service.html         # Шаблон услуги
├── _includes/               # Включаемые компоненты
│   ├── header.html          # Шапка сайта
│   ├── footer.html          # Подвал
│   ├── seo.html             # SEO-метатеги
│   ├── schema.html          # Структурированные данные
│   └── chat-widget.html     # AI-консультант
├── _services/               # Коллекция услуг
├── _locations/              # Коллекция локаций
├── _posts/                  # Статьи блога (генерируются AI)
├── assets/                  # Статика
│   ├── css/main.css         # Основные стили
│   └── js/main.js           # Скрипты
├── pages/                   # Статические страницы
├── worker/                  # Cloudflare Worker
│   ├── wrangler.toml        # Конфигурация
│   ├── schema.sql           # Схема базы данных
│   ├── topics.sql           # Начальные темы
│   └── src/                 # Исходный код
│       ├── index.ts         # Главный роутер
│       ├── chat.ts          # AI-консультант
│       ├── publisher.ts     # Публикация статей
│       ├── planner.ts       # Планировщик тем
│       └── callback.ts      # Обработка заявок
├── robots.txt               # Настройки для роботов
├── sitemap.xml              # Карта сайта
├── llms.txt                 # Данные для LLM-агентов
├── CNAME                    # Кастомный домен
└── README.md                # Этот файл
```

## Начало работы

### 1. Настройка GitHub Pages

1. Создайте репозиторий на GitHub
2. Загрузите файлы сайта в репозиторий
3. В настройках репозитория включите GitHub Pages:
   - Settings → Pages → Source → Deploy from a branch
   - Branch: main → / (root)

### 2. Настройка DNS

Добавьте записи DNS для домена `svkautoplus.ru`:

**A-записи для apex:**
```
svkautoplus.ru.  A  185.199.108.153
svkautoplus.ru.  A  185.199.109.153
svkautoplus.ru.  A  185.199.110.153
svkautoplus.ru.  A  185.199.111.153
```

**CNAME для www:**
```
www.svkautoplus.ru.  CNAME  ваш-username.github.io.
```

**Важно:** Не используйте wildcard DNS (`*.domain`) — GitHub не рекомендует.

### 3. HTTPS

Включите HTTPS в настройках Pages:
- Settings → Pages → Enforce HTTPS ✅

### 4. Настройка Cloudflare Worker

#### 4.1 Создание базы данных D1

```bash
cd worker

# Создать базу данных
wrangler d1 create svkauto-db

# Сохраните database_id из вывода и добавьте в wrangler.toml
```

#### 4.2 Применение схемы

```bash
# Выполнить миграцию
wrangler d1 execute svkauto-db --file=schema.sql

# Загрузить начальные темы
wrangler d1 execute svkauto-db --file=topics.sql
```

#### 4.3 Добавление секретов

```bash
# Обязательные секреты
wrangler secret put GROQ_API_KEY         # API ключ Groq
wrangler secret put GITHUB_TOKEN         # GitHub token (fine-grained, contents:write)
wrangler secret put CHAT_AUTH_TOKEN      # Токен для /run-now и /plan-now
wrangler secret put TURNSTILE_SECRET_KEY # Secret key Cloudflare Turnstile
wrangler secret put INDEXNOW_KEY         # Ключ для IndexNow
```

#### 4.4 Настройка Turnstile

1. В Cloudflare Dashboard → Turnstile → Add widget
2. Sitekey: добавьте в JavaScript чата (chat-widget.html)
3. Secret key: добавьте через `wrangler secret put`

#### 4.5 Деплой Worker

```bash
wrangler deploy
```

### 5. Настройка Bulk Redirects (Cloudflare)

В Cloudflare Dashboard для домена:
- Rules → Bulk Redirects → Create a new Bulk Redirect List

| Источник | Назначение | Код |
|----------|-----------|-----|
| `svkautoplus.ru/about-us.html` | `https://www.svkautoplus.ru/` | 301 |
| `svkautoplus.ru/svk-uslugi.html` | `https://www.svkautoplus.ru/services/` | 301 |
| `svkautoplus.ru/tseny.html` | `https://www.svkautoplus.ru/prices/` | 301 |
| `svkautoplus.ru/stoimost-to.html` | `https://www.svkautoplus.ru/prices/` | 301 |
| `svkautoplus.ru/service-action.html` | `https://www.svkautoplus.ru/promo/` | 301 |
| `svkautoplus.ru/contact-us.html` | `https://www.svkautoplus.ru/contacts/` | 301 |
| `svkautoplus.ru/about-us/pravila-okazaniya-uslug.html` | `https://www.svkautoplus.ru/rules/` | 301 |
| `svkautoplus.ru/about-us/diskontnie-programmi.html` | `https://www.svkautoplus.ru/prices/` | 301 |

## Тестирование

### Проверка статуса сервиса

```bash
curl https://svkauto-worker.your-account.workers.dev/api/health
```

### Ручной запуск публикации статьи

```bash
curl -X POST https://svkauto-worker.your-account.workers.dev/api/run-now \
  -H "Authorization: Bearer YOUR_CHAT_AUTH_TOKEN"
```

### Ручной запуск планировщика

```bash
curl -X POST https://svkauto-worker.your-account.workers.dev/api/plan-now \
  -H "Authorization: Bearer YOUR_CHAT_AUTH_TOKEN"
```

### Локальное тестирование cron

```bash
wrangler dev --test-scheduled
# Затем в другом терминале:
curl "http://localhost:8787/__scheduled?cron=5+6+*+*+*"
```

### Проверка чата

```bash
curl -X POST https://svkauto-worker.your-account.workers.dev/api/consult/chat \
  -H "Content-Type: application/json" \
  -H "Origin: https://svkautoplus.ru" \
  -d '{
    "message": "Сколько стоит ТО?",
    "turnstileToken": "test-token",
    "location": "center"
  }'
```

## Lighthouse цели

- Performance: ≥ 85
- Accessibility: ≥ 90
- SEO: 100
- Best Practices: ≥ 90

## Проверка горизонтального скролла

```bash
# Chrome DevTools → Device Toolbar → 360px viewport
# Проверить: body { overflow-x: hidden } работает
# Не должно быть горизонтального скролла на всех разрешениях
```

## Технологии

- **Jekyll** — статический генератор сайтов
- **Cloudflare Workers** — edge computing
- **Cloudflare D1** — edge database
- **Cloudflare Turnstile** — защита от ботов
- **Groq API** — AI генерация статей и ответов
- **GitHub Pages** — хостинг сайта
- **GitHub API** — автоматическая публикация статей

## Безопасность

- Никаких ключей/токенов в коде репозитория
- Все секреты хранятся в Cloudflare Secrets
- Turnstile защита перед чатом
- Rate limiting на API
- Квота 5 вопросов на посетителя
- Геофильтр для Москвы

## Поддержка

При возникновении проблем:
1. Проверьте логи в Cloudflare Dashboard
2. Проверьте секреты через `wrangler secret list`
3. Проверьте подключение к D1 через `wrangler d1 execute`

## Лицензия

© 2024–2025 ООО «СВК Авто Плюс». Все права защищены.
