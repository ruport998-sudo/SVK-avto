// worker/src/seed-prices.ts
// Seed script to populate initial prices into D1 database
// Run: wrangler d1 execute svkauto-db --file=seed-prices.sql

export const SEED_PRICES = [
  // Main services (category: main)
  { id: 'to-small', service: 'Плановое ТО (до 4,5 л масла)', price: '5 000 ₽', note: 'Масло и фильтр включены', category: 'main', sort_order: 1 },
  { id: 'to-large', service: 'Плановое ТО (более 4,5 л масла)', price: '7 000 ₽', note: 'Масло и фильтр включены', category: 'main', sort_order: 2 },
  { id: 'diagnostics-suspension', service: 'Диагностика ходовой части', price: '680 ₽', note: '', category: 'main', sort_order: 3 },
  { id: 'diagnostics-brakes', service: 'Диагностика тормозной системы', price: '680 ₽', note: '', category: 'main', sort_order: 4 },
  { id: 'diagnostics-computer', service: 'Компьютерная диагностика ДВС/ABS/SRS', price: '1 020 ₽', note: '', category: 'main', sort_order: 5 },
  { id: 'oil-change', service: 'Замена масла + масляный фильтр', price: '680 ₽', note: 'Без промывки, без масла', category: 'main', sort_order: 6 },
  { id: 'ac-service', service: 'Диагностика и заправка кондиционера', price: '1 900 ₽', note: '', category: 'main', sort_order: 7 },
  { id: 'engine-flush', service: 'Промывка двигателя', price: '~1 200 ₽', note: 'С материалами', category: 'main', sort_order: 8 },
  { id: 'cleaning', service: 'Химчистка салона', price: 'от 7 000 ₽', note: '', category: 'main', sort_order: 9 },
  { id: 'toning', service: 'Тонировка', price: 'от 5 000 ₽', note: '', category: 'main', sort_order: 10 },

  // TO category
  { id: 'to-small-detail', service: 'ТО (до 4,5 л масла)', price: '5 000 ₽', note: 'масло и фильтр включены', category: 'to', sort_order: 1 },
  { id: 'to-large-detail', service: 'ТО (более 4,5 л масла)', price: '7 000 ₽', note: 'масло и фильтр включены', category: 'to', sort_order: 2 },
  { id: 'oil-change-only', service: 'Замена масла без расходников', price: '680 ₽', note: '', category: 'to', sort_order: 3 },

  // Diagnostics category
  { id: 'diag-suspension', service: 'Диагностика ходовой части', price: '680 ₽', note: '', category: 'diagnostics', sort_order: 1 },
  { id: 'diag-brakes', service: 'Диагностика тормозной системы', price: '680 ₽', note: '', category: 'diagnostics', sort_order: 2 },
  { id: 'diag-computer', service: 'Компьютерная диагностика ДВС/ABS/SRS', price: '1 020 ₽', note: '', category: 'diagnostics', sort_order: 3 },
  { id: 'diag-complex', service: 'Комплексная диагностика + мойка', price: '1 500 ₽', note: '', category: 'diagnostics', sort_order: 4 },

  // Suspension category
  { id: 'suspension-diagnostics', service: 'Диагностика ходовой части', price: '680 ₽', note: '', category: 'suspension', sort_order: 1 },

  // Brakes category
  { id: 'brakes-diagnostics', service: 'Диагностика тормозной системы', price: '680 ₽', note: '', category: 'brakes', sort_order: 1 },

  // AC category
  { id: 'ac-diagnostics-refill', service: 'Диагностика и заправка кондиционера', price: '1 900 ₽', note: '', category: 'ac', sort_order: 1 },

  // Polishing category
  { id: 'polishing-cleaning', service: 'Химчистка салона', price: 'от 7 000 ₽', note: '', category: 'polishing', sort_order: 1 },
  { id: 'polishing-winter-complex', service: 'Комплекс «После зимних дорог»', price: '2 500 ₽', note: 'защитная полировка + полировка фар + уборка салона', category: 'polishing', sort_order: 2 },
];

// Generate SQL for seeding
export function generateSeedSQL(): string {
  let sql = '-- Seed prices data\n';
  sql += 'INSERT OR REPLACE INTO prices (id, service, price, note, category, sort_order) VALUES\n';
  
  const values = SEED_PRICES.map(p => {
    const note = p.note ? `'${p.note.replace(/'/g, "''")}'` : "''";
    return `  ('${p.id}', '${p.service.replace(/'/g, "''")}', '${p.price}', ${note}, '${p.category}', ${p.sort_order})`;
  });
  
  sql += values.join(',\n') + ';\n';
  return sql;
}

// If run directly
if (import.meta.main) {
  console.log(generateSeedSQL());
}
