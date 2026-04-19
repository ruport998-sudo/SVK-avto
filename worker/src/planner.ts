// worker/src/planner.ts
// AI Blog Planner - generates editorial calendar

import { Env } from './index';

interface Topic {
  topic_id: string;
  category: string;
  system: string;
  angle: string;
  priority: number;
  cooldown_system_days: number;
  cooldown_system_angle_days: number;
  last_used_at: string | null;
  use_count: number;
}

export async function handlePlanner(env: Env): Promise<void> {
  console.log('Running planner...');

  // Check if we need to plan (less than 2 weeks of slots)
  const plannedCount = await getPlannedCount(env.DB);
  
  if (plannedCount >= 14) {
    console.log('Sufficient planned slots:', plannedCount);
    return;
  }

  // Get available topics
  const topics = await getAvailableTopics(env.DB);
  
  if (topics.length === 0) {
    console.log('No available topics');
    return;
  }

  // Generate slots for next 6 weeks
  const slots = await generateSlots(topics, 6, env);
  
  // Save slots to database
  for (const slot of slots) {
    await saveSlot(slot, env.DB);
  }

  console.log(`Planned ${slots.length} new slots`);
}

// Get count of planned slots
async function getPlannedCount(db: D1Database): Promise<number> {
  const result = await db
    .prepare('SELECT COUNT(*) as count FROM calendar_slots WHERE status = ?')
    .bind('planned')
    .first<{ count: number }>();
  
  return result?.count || 0;
}

// Get available topics (respecting cooldowns)
async function getAvailableTopics(db: D1Database): Promise<Topic[]> {
  const now = new Date().toISOString();
  
  const results = await db
    .prepare(`
      SELECT * FROM topics 
      WHERE last_used_at IS NULL 
      OR (
        julianday(?) - julianday(last_used_at) > cooldown_system_angle_days
      )
      ORDER BY priority DESC, use_count ASC, RANDOM()
      LIMIT 50
    `)
    .bind(now)
    .all<Topic>();
  
  return results.results || [];
}

// Generate calendar slots
async function generateSlots(
  topics: Topic[], 
  weeks: number, 
  env: Env
): Promise<Array<{
  pub_date: string;
  topic_id: string;
  category: string;
  system: string;
  angle: string;
  title_draft: string;
  keywords: string;
  image_prompt: string;
}>> {
  const slots = [];
  const now = new Date();
  
  // Get next 6 weeks of Mon/Wed/Fri dates
  const publishingDates = getPublishingDates(now, weeks);
  
  for (let i = 0; i < publishingDates.length && i < topics.length; i++) {
    const date = publishingDates[i];
    const topic = topics[i];
    
    // Generate title draft and keywords with Groq
    const generated = await generateTopicDetails(topic, env);
    
    slots.push({
      pub_date: date.toISOString().split('T')[0],
      topic_id: topic.topic_id,
      category: topic.category,
      system: topic.system,
      angle: topic.angle,
      title_draft: generated.title_draft,
      keywords: generated.keywords,
      image_prompt: generated.image_prompt,
    });
  }
  
  return slots;
}

// Get publishing dates (Mon/Wed/Fri)
function getPublishingDates(startDate: Date, weeks: number): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);
  
  // Move to next day
  current.setDate(current.getDate() + 1);
  
  const publishingDays = [1, 3, 5]; // Mon, Wed, Fri
  
  while (dates.length < weeks * 3) {
    const dayOfWeek = current.getDay();
    
    if (publishingDays.includes(dayOfWeek)) {
      dates.push(new Date(current));
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

// Generate topic details with Groq
async function generateTopicDetails(
  topic: Topic, 
  env: Env
): Promise<{ title_draft: string; keywords: string; image_prompt: string }> {
  const prompt = `Сгенерируй данные для статьи в блог автосервиса.

Категория: ${topic.category}
Система: ${topic.system}
Угол: ${topic.angle}

Сгенерируй JSON с полями:
- title_draft (черновик заголовка)
- keywords (ключевые слова через запятую)
- image_prompt (промпт для изображения на английском, без текста и водяных знаков)`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
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

    const content = data.choices[0]?.message?.content || '';
    
    // Extract JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        title_draft: parsed.title_draft || `${topic.category} - ${topic.system}`,
        keywords: parsed.keywords || topic.system,
        image_prompt: parsed.image_prompt || `automotive ${topic.system} repair, professional service`,
      };
    }
  } catch (error) {
    console.error('Topic generation error:', error);
  }

  // Fallback
  return {
    title_draft: `${topic.category}: ${topic.system}`,
    keywords: `${topic.system}, ${topic.category}, автосервис`,
    image_prompt: `automotive ${topic.system} service, professional garage`,
  };
}

// Save slot to database
async function saveSlot(
  slot: {
    pub_date: string;
    topic_id: string;
    category: string;
    system: string;
    angle: string;
    title_draft: string;
    keywords: string;
    image_prompt: string;
  },
  db: D1Database
): Promise<void> {
  try {
    await db
      .prepare(`
        INSERT OR REPLACE INTO calendar_slots 
        (pub_date, topic_id, category, system, angle, title_draft, keywords, image_prompt, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        slot.pub_date,
        slot.topic_id,
        slot.category,
        slot.system,
        slot.angle,
        slot.title_draft,
        slot.keywords,
        slot.image_prompt,
        'planned',
        new Date().toISOString(),
        new Date().toISOString()
      )
      .run();

    // Update topic last_used_at
    await db
      .prepare('UPDATE topics SET last_used_at = ?, use_count = use_count + 1 WHERE topic_id = ?')
      .bind(new Date().toISOString(), slot.topic_id)
      .run();
  } catch (error) {
    console.error('Save slot error:', error);
  }
}
