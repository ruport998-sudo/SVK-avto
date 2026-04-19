// worker/src/publisher.ts
// AI Blog Publisher - generates and publishes articles

import { Env } from './index';

interface CalendarSlot {
  pub_date: string;
  topic_id: string;
  category: string;
  system: string;
  angle: string;
  title_draft: string;
  keywords: string;
  image_prompt: string;
  status: string;
  post_slug: string | null;
  commit_sha: string | null;
  updated_at: string;
}

interface GeneratedArticle {
  title: string;
  h1: string;
  description: string;
  slug: string;
  outline: string[];
  faq: Array<{ q: string; a: string }>;
  tags: string[];
  content: string;
}

export async function handlePublisher(env: Env): Promise<void> {
  // Get Moscow date
  const now = new Date();
  const moscowTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
  const today = moscowTime.toISOString().split('T')[0];

  console.log('Publisher running for date:', today);

  // Check if today is a publishing day (Mon, Wed, Fri)
  const dayOfWeek = moscowTime.getDay();
  if (![1, 3, 5].includes(dayOfWeek)) {
    console.log('Not a publishing day, skipping');
    return;
  }

  // Get today's slot
  const slot = await getTodaySlot(today, env.DB);
  if (!slot) {
    console.log('No slot found for today');
    return;
  }

  // Check if already published
  if (slot.status === 'published') {
    console.log('Already published for today');
    return;
  }

  // Check if stuck (started > 20 min ago)
  if (slot.status === 'started') {
    const updatedAt = new Date(slot.updated_at);
    const twentyMinAgo = new Date(now.getTime() - 20 * 60 * 1000);
    if (updatedAt > twentyMinAgo) {
      console.log('Job in progress, skipping');
      return;
    }
    // Reset stuck job
    await updateSlotStatus(today, 'failed', env.DB);
  }

  // Mark as started
  await updateSlotStatus(today, 'started', env.DB);

  try {
    // Step 1: Generate article with Groq
    console.log('Generating article...');
    const article = await generateArticle(slot, env);

    // Step 2: Generate image with Workers AI
    console.log('Generating image...');
    const imageData = await generateImage(article.image_prompt, env);

    // Step 3: Publish to GitHub
    console.log('Publishing to GitHub...');
    const commitSha = await publishToGitHub(article, imageData, today, env);

    // Step 4: Update slot as published
    await updateSlotPublished(today, article.slug, commitSha, env.DB);

    // Step 5: Notify IndexNow
    await notifyIndexNow(article.slug, env);

    console.log('Article published successfully:', article.slug);

  } catch (error) {
    console.error('Publisher error:', error);
    await updateSlotStatus(today, 'failed', env.DB);
    throw error;
  }
}

// Get today's slot from database
async function getTodaySlot(today: string, db: D1Database): Promise<CalendarSlot | null> {
  const result = await db
    .prepare('SELECT * FROM calendar_slots WHERE pub_date = ?')
    .bind(today)
    .first<CalendarSlot>();
  
  return result;
}

// Update slot status
async function updateSlotStatus(date: string, status: string, db: D1Database): Promise<void> {
  await db
    .prepare('UPDATE calendar_slots SET status = ?, updated_at = ? WHERE pub_date = ?')
    .bind(status, new Date().toISOString(), date)
    .run();
}

// Update slot as published
async function updateSlotPublished(
  date: string, 
  slug: string, 
  commitSha: string, 
  db: D1Database
): Promise<void> {
  await db
    .prepare('UPDATE calendar_slots SET status = ?, post_slug = ?, commit_sha = ?, updated_at = ? WHERE pub_date = ?')
    .bind('published', slug, commitSha, new Date().toISOString(), date)
    .run();
}

// Generate article with Groq
async function generateArticle(slot: CalendarSlot, env: Env): Promise<GeneratedArticle & { image_prompt: string }> {
  const prompt = `Сгенерируй статью для блога автосервиса на тему: ${slot.category} - ${slot.system}.
Угол: ${slot.angle}.

Сгенерируй СТРОГИЙ JSON с полями:
- title (заголовок для SEO, до 60 символов)
- h1 (заголовок H1)
- description (meta description, до 155 символов)
- slug (URL-friendly, на латинице)
- outline (массив из 4-6 секций)
- faq (массив из 3-5 пар вопрос-ответ)
- tags (массив тегов)
- image_prompt (промпт для генерации изображения на английском)

Тема: ${slot.title_draft}
Ключевые слова: ${slot.keywords}

Требования:
- Статья должна быть полезной для владельцев японских и корейских автомобилей
- Не давай советов по самостоятельному ремонту узлов безопасности
- Не придумывай цены, сроки, гарантии
- Указывай, что точная диагностика нужна в сервисе
- JSON должен быть валидным`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices[0]?.message?.content || '';
  
  // Extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }

  const parsed = JSON.parse(jsonMatch[0]) as GeneratedArticle & { image_prompt: string };

  // Generate full content
  const fullContent = await generateFullContent(parsed, env);

  return {
    ...parsed,
    content: fullContent,
  };
}

// Generate full article content
async function generateFullContent(article: GeneratedArticle, env: Env): Promise<string> {
  const prompt = `Напиши полный текст статьи на основе плана.

Заголовок: ${article.h1}
Описание: ${article.description}
План: ${article.outline.join(', ')}

Требования:
- Используй markdown форматирование
- Добавь H2 для каждой секции
- Включи FAQ в конце с использованием <details><summary>
- Не давай советов по самостоятельному ремонту узлов безопасности
- Указывай, что точная диагностика нужна в сервисе
- Длина: 800-1200 слов`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2500,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  return data.choices[0]?.message?.content || '';
}

// Generate image with Workers AI
async function generateImage(prompt: string, env: Env): Promise<Uint8Array> {
  const enhancedPrompt = `${prompt}, automotive service, professional studio lighting, shallow depth of field, clean white or light grey background, premium quality, no text, no watermark, no labels, photorealistic`;

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/ai/run/@cf/stabilityai/stable-diffusion-xl-base-1.0`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.GROQ_API_KEY}`, // Using same key for simplicity
      },
      body: JSON.stringify({
        prompt: enhancedPrompt,
        width: 1200,
        height: 630,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Image generation error: ${response.status}`);
  }

  const data = await response.json() as { image: string };
  
  // Convert base64 to Uint8Array
  const base64 = data.image;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

// Publish to GitHub
async function publishToGitHub(
  article: GeneratedArticle & { image_prompt: string; content: string },
  imageData: Uint8Array,
  date: string,
  env: Env
): Promise<string> {
  const year = date.split('-')[0];
  const month = date.split('-')[1];
  
  // File paths
  const postPath = `_posts/${date}-${article.slug}.md`;
  const imagePath = `assets/preview/${year}/${month}/${article.slug}.png`;

  // Create post content
  const postContent = `---
layout: post
title: "${article.title}"
description: "${article.description}"
date: ${date}
category: "${article.tags[0] || 'Общее'}"
tags: [${article.tags.map(t => `"${t}"`).join(', ')}]
image: /${imagePath}
---

# ${article.h1}

${article.content}
`;

  // Get current commit SHA
  const refResponse = await fetch(
    `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/git/refs/heads/${env.GITHUB_BRANCH}`,
    {
      headers: {
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    }
  );

  if (!refResponse.ok) {
    throw new Error(`GitHub ref error: ${refResponse.status}`);
  }

  const refData = await refResponse.json() as { object: { sha: string } };
  const baseSha = refData.object.sha;

  // Create blobs
  const postBlob = await createBlob(postContent, env);
  const imageBlob = await createBlob(imageData, true, env);

  // Create tree
  const treeResponse = await fetch(
    `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/git/trees`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base_tree: baseSha,
        tree: [
          {
            path: postPath,
            mode: '100644',
            type: 'blob',
            sha: postBlob,
          },
          {
            path: imagePath,
            mode: '100644',
            type: 'blob',
            sha: imageBlob,
          },
        ],
      }),
    }
  );

  if (!treeResponse.ok) {
    throw new Error(`GitHub tree error: ${treeResponse.status}`);
  }

  const treeData = await treeResponse.json() as { sha: string };

  // Create commit
  const commitResponse = await fetch(
    `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/git/commits`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Add blog post: ${article.title}`,
        tree: treeData.sha,
        parents: [baseSha],
      }),
    }
  );

  if (!commitResponse.ok) {
    throw new Error(`GitHub commit error: ${commitResponse.status}`);
  }

  const commitData = await commitResponse.json() as { sha: string };

  // Update ref
  const updateResponse = await fetch(
    `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/git/refs/heads/${env.GITHUB_BRANCH}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sha: commitData.sha,
      }),
    }
  );

  if (!updateResponse.ok) {
    throw new Error(`GitHub update error: ${updateResponse.status}`);
  }

  return commitData.sha;
}

// Create GitHub blob
async function createBlob(
  content: string | Uint8Array, 
  isBinary = false, 
  env: Env
): Promise<string> {
  let body: string;
  
  if (isBinary && content instanceof Uint8Array) {
    // Convert to base64
    const base64 = btoa(String.fromCharCode(...content));
    body = JSON.stringify({
      content: base64,
      encoding: 'base64',
    });
  } else {
    body = JSON.stringify({
      content: content as string,
      encoding: 'utf-8',
    });
  }

  const response = await fetch(
    `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/git/blobs`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body,
    }
  );

  if (!response.ok) {
    throw new Error(`GitHub blob error: ${response.status}`);
  }

  const data = await response.json() as { sha: string };
  return data.sha;
}

// Notify IndexNow
async function notifyIndexNow(slug: string, env: Env): Promise<void> {
  const url = `${env.SITE_BASE_URL}/blog/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${String(new Date().getDate()).padStart(2, '0')}/${slug}/`;
  
  try {
    await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: 'svkautoplus.ru',
        key: env.INDEXNOW_KEY,
        urlList: [url, `${env.SITE_BASE_URL}/sitemap.xml`],
      }),
    });
  } catch (error) {
    console.error('IndexNow error:', error);
    // Non-critical, don't throw
  }
}
