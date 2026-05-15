-- seed-prices.sql
-- Initial prices data for СВК Авто
-- Run: wrangler d1 execute svkauto-db --file=seed-prices.sql

INSERT OR REPLACE INTO prices (id, service, price, note, category, sort_order) VALUES
  -- Main services
  ('to-small', 'Плановое ТО (до 4,5 л масла)', '5 000 ₽', 'Масло и фильтр включены', 'main', 1),
  ('to-large', 'Плановое ТО (более 4,5 л масла)', '7 000 ₽', 'Масло и фильтр включены', 'main', 2),
  ('diagnostics-suspension', 'Диагностика ходовой части', '680 ₽', '', 'main', 3),
  ('diagnostics-brakes', 'Диагностика тормозной системы', '680 ₽', '', 'main', 4),
  ('diagnostics-computer', 'Компьютерная диагностика ДВС/ABS/SRS', '1 020 ₽', '', 'main', 5),
  ('oil-change', 'Замена масла + масляный фильтр', '680 ₽', 'Без промывки, без масла', 'main', 6),
  ('ac-service', 'Диагностика и заправка кондиционера', '1 900 ₽', '', 'main', 7),
  ('engine-flush', 'Промывка двигателя', '~1 200 ₽', 'С материалами', 'main', 8),
  ('cleaning', 'Химчистка салона', 'от 7 000 ₽', '', 'main', 9),
  ('toning', 'Тонировка', 'от 5 000 ₽', '', 'main', 10),

  -- TO category
  ('to-small-detail', 'ТО (до 4,5 л масла)', '5 000 ₽', 'масло и фильтр включены', 'to', 1),
  ('to-large-detail', 'ТО (более 4,5 л масла)', '7 000 ₽', 'масло и фильтр включены', 'to', 2),
  ('oil-change-only', 'Замена масла без расходников', '680 ₽', '', 'to', 3),

  -- Diagnostics category
  ('diag-suspension', 'Диагностика ходовой части', '680 ₽', '', 'diagnostics', 1),
  ('diag-brakes', 'Диагностика тормозной системы', '680 ₽', '', 'diagnostics', 2),
  ('diag-computer', 'Компьютерная диагностика ДВС/ABS/SRS', '1 020 ₽', '', 'diagnostics', 3),
  ('diag-complex', 'Комплексная диагностика + мойка', '1 500 ₽', '', 'diagnostics', 4),

  -- Suspension category
  ('suspension-diagnostics', 'Диагностика ходовой части', '680 ₽', '', 'suspension', 1),

  -- Brakes category
  ('brakes-diagnostics', 'Диагностика тормозной системы', '680 ₽', '', 'brakes', 1),

  -- AC category
  ('ac-diagnostics-refill', 'Диагностика и заправка кондиционера', '1 900 ₽', '', 'ac', 1),

  -- Polishing category
  ('polishing-cleaning', 'Химчистка салона', 'от 7 000 ₽', '', 'polishing', 1),
  ('polishing-winter-complex', 'Комплекс «После зимних дорог»', '2 500 ₽', 'защитная полировка + полировка фар + уборка салона', 'polishing', 2);
