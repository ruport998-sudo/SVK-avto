// assets/js/prices.js
// Dynamic price loading from Cloudflare Worker API (with local fallback)

(function() {
  'use strict';

  const API_URL = '/api/prices';
  const CACHE_KEY = 'svk_prices_cache';
  const ADMIN_DATA_KEY = 'svk_prices_admin_data';
  const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  // Default prices for local development (same as seed-prices.sql)
  const DEFAULT_PRICES = [
    { id: "to-1", service: "Замена масла в двигателе (до 5л масла)", price: "от 1 500 ₽", note: "Масло и фильтр оплачиваются отдельно", category: "to", sort_order: 1 },
    { id: "to-2", service: "Замена масла в двигателе (свыше 5л масла)", price: "от 2 000 ₽", note: "Масло и фильтр оплачиваются отдельно", category: "to", sort_order: 2 },
    { id: "to-3", service: "Замена масла в АКПП (частичная)", price: "от 2 500 ₽", note: "", category: "to", sort_order: 3 },
    { id: "to-4", service: "Замена масла в АКПП (аппаратная)", price: "от 4 500 ₽", note: "", category: "to", sort_order: 4 },
    { id: "to-5", service: "Замена масла в МКПП", price: "от 1 500 ₽", note: "", category: "to", sort_order: 5 },
    { id: "to-6", service: "Замена масла в редукторе / раздатке", price: "от 1 500 ₽", note: "", category: "to", sort_order: 6 },
    { id: "to-7", service: "Замена антифриза", price: "от 1 500 ₽", note: "", category: "to", sort_order: 7 },
    { id: "to-8", service: "Замена тормозной жидкости", price: "от 1 500 ₽", note: "", category: "to", sort_order: 8 },
    { id: "to-9", service: "Замена свечей зажигания (комплект)", price: "от 1 500 ₽", note: "", category: "to", sort_order: 9 },
    { id: "to-10", service: "Замена воздушного фильтра", price: "от 300 ₽", note: "", category: "to", sort_order: 10 },
    { id: "to-11", service: "Замена салонного фильтра", price: "от 500 ₽", note: "", category: "to", sort_order: 11 },
    { id: "to-12", service: "Замена топливного фильтра", price: "от 800 ₽", note: "", category: "to", sort_order: 12 },
    { id: "to-13", service: "Замена ремня ГРМ", price: "от 5 000 ₽", note: "", category: "to", sort_order: 13 },
    { id: "to-14", service: "Замена ремня генератора / навесного", price: "от 1 500 ₽", note: "", category: "to", sort_order: 14 },
    { id: "to-15", service: "Компьютерная диагностика двигателя", price: "1 500 ₽", note: "", category: "diagnostics", sort_order: 1 },
    { id: "to-16", service: "Диагностика ходовой части", price: "1 500 ₽", note: "", category: "diagnostics", sort_order: 2 },
    { id: "to-17", service: "Диагностика тормозной системы", price: "1 000 ₽", note: "", category: "diagnostics", sort_order: 3 },
    { id: "to-18", service: "Диагностика АКПП", price: "от 2 000 ₽", note: "", category: "diagnostics", sort_order: 4 },
    { id: "to-19", service: "Диагностика двигателя (механическая)", price: "от 2 000 ₽", note: "", category: "diagnostics", sort_order: 5 },
    { id: "to-20", service: "Диагностика кондиционера", price: "1 500 ₽", note: "", category: "diagnostics", sort_order: 6 },
    { id: "to-21", service: "Замена ГБЦ / прокладки ГБЦ", price: "от 15 000 ₽", note: "", category: "engine", sort_order: 1 },
    { id: "to-22", service: "Замена цепи ГРМ", price: "от 8 000 ₽", note: "", category: "engine", sort_order: 2 },
    { id: "to-23", service: "Замена помпы (водяного насоса)", price: "от 3 000 ₽", note: "", category: "engine", sort_order: 3 },
    { id: "to-24", service: "Замена термостата", price: "от 1 500 ₽", note: "", category: "engine", sort_order: 4 },
    { id: "to-25", service: "Замена радиатора охлаждения", price: "от 3 000 ₽", note: "", category: "engine", sort_order: 5 },
    { id: "to-26", service: "Замена впускного коллектора", price: "от 4 000 ₽", note: "", category: "engine", sort_order: 6 },
    { id: "to-27", service: "Замена выпускного коллектора", price: "от 4 000 ₽", note: "", category: "engine", sort_order: 7 },
    { id: "to-28", service: "Замена катализатора / пламегасителя", price: "от 5 000 ₽", note: "", category: "engine", sort_order: 8 },
    { id: "to-29", service: "Замена сайлентблоков (за 1 шт.)", price: "от 1 500 ₽", note: "", category: "suspension", sort_order: 1 },
    { id: "to-30", service: "Замена рычагов подвески (за 1 шт.)", price: "от 2 000 ₽", note: "", category: "suspension", sort_order: 2 },
    { id: "to-31", service: "Замена стоек стабилизатора (за 1 шт.)", price: "от 1 000 ₽", note: "", category: "suspension", sort_order: 3 },
    { id: "to-32", service: "Замена амортизаторов (за 1 шт.)", price: "от 2 500 ₽", note: "", category: "suspension", sort_order: 4 },
    { id: "to-33", service: "Замена пружин (за 1 шт.)", price: "от 2 000 ₽", note: "", category: "suspension", sort_order: 5 },
    { id: "to-34", service: "Замена шаровой опоры (за 1 шт.)", price: "от 1 500 ₽", note: "", category: "suspension", sort_order: 6 },
    { id: "to-35", service: "Замена рулевых наконечников (за 1 шт.)", price: "от 1 000 ₽", note: "", category: "suspension", sort_order: 7 },
    { id: "to-36", service: "Замена тормозных колодок (ось)", price: "от 1 500 ₽", note: "", category: "brakes", sort_order: 1 },
    { id: "to-37", service: "Замена тормозных дисков (ось)", price: "от 2 500 ₽", note: "", category: "brakes", sort_order: 2 },
    { id: "to-38", service: "Замена тормозных шлангов (за 1 шт.)", price: "от 1 000 ₽", note: "", category: "brakes", sort_order: 3 },
    { id: "to-39", service: "Замена главного тормозного цилиндра", price: "от 2 500 ₽", note: "", category: "brakes", sort_order: 4 },
    { id: "to-40", service: "Замена рабочего цилиндра сцепления", price: "от 2 000 ₽", note: "", category: "transmission", sort_order: 1 },
    { id: "to-41", service: "Замена главного цилиндра сцепления", price: "от 2 500 ₽", note: "", category: "transmission", sort_order: 2 },
    { id: "to-42", service: "Замена сцепления (комплект)", price: "от 8 000 ₽", note: "", category: "transmission", sort_order: 3 },
    { id: "to-43", service: "Замена привода (ШРУСа)", price: "от 3 000 ₽", note: "", category: "transmission", sort_order: 4 },
    { id: "to-44", service: "Замена пыльника ШРУСа", price: "от 1 500 ₽", note: "", category: "transmission", sort_order: 5 },
    { id: "to-45", service: "Заправка кондиционера (до 600г)", price: "2 500 ₽", note: "", category: "ac", sort_order: 1 },
    { id: "to-46", service: "Заправка кондиционера (свыше 600г)", price: "3 000 ₽", note: "", category: "ac", sort_order: 2 },
    { id: "to-47", service: "Замена компрессора кондиционера", price: "от 5 000 ₽", note: "", category: "ac", sort_order: 3 },
    { id: "to-48", service: "Замена радиатора кондиционера", price: "от 4 000 ₽", note: "", category: "ac", sort_order: 4 },
    { id: "to-49", service: "Покраска элемента (за 1 деталь)", price: "от 5 000 ₽", note: "", category: "body", sort_order: 1 },
    { id: "to-50", service: "Покраска элемента (с разбором)", price: "от 8 000 ₽", note: "", category: "body", sort_order: 2 },
    { id: "to-51", service: "Локальная покраска (пятно)", price: "от 3 000 ₽", note: "", category: "body", sort_order: 3 },
    { id: "to-52", service: "Рихтовка (за 1 деталь)", price: "от 2 000 ₽", note: "", category: "body", sort_order: 4 },
    { id: "to-53", service: "Шиномонтаж легковой (комплект)", price: "2 500 ₽", note: "На дисках R13-R16", category: "tires", sort_order: 1 },
    { id: "to-54", service: "Шиномонтаж внедорожник (комплект)", price: "3 500 ₽", note: "На дисках R17-R18", category: "tires", sort_order: 2 },
    { id: "to-55", service: "Балансировка (за 1 колесо)", price: "300 ₽", note: "", category: "tires", sort_order: 3 },
    { id: "to-56", service: "Ремонт прокола (шина)", price: "от 500 ₽", note: "", category: "tires", sort_order: 4 },
    { id: "to-57", service: "Полировка кузова (абразивная)", price: "от 8 000 ₽", note: "", category: "polishing", sort_order: 1 },
    { id: "to-58", service: "Полировка кузова (защитная)", price: "от 5 000 ₽", note: "", category: "polishing", sort_order: 2 },
    { id: "to-59", service: "Химчистка салона (легковая)", price: "от 5 000 ₽", note: "", category: "polishing", sort_order: 3 },
    { id: "to-60", service: "Химчистка салона (внедорожник)", price: "от 7 000 ₽", note: "", category: "polishing", sort_order: 4 },
    { id: "to-61", service: "Установка сигнализации", price: "от 5 000 ₽", note: "", category: "extras", sort_order: 1 },
    { id: "to-62", service: "Установка парктроников", price: "от 3 000 ₽", note: "", category: "extras", sort_order: 2 },
    { id: "to-63", service: "Установка камеры заднего вида", price: "от 3 000 ₽", note: "", category: "extras", sort_order: 3 },
    { id: "to-64", service: "Шумоизоляция (за 1 дверь)", price: "от 2 500 ₽", note: "", category: "extras", sort_order: 4 },
    { id: "to-65", service: "Сход-развал (3D, легковой)", price: "2 000 ₽", note: "", category: "wheel-alignment", sort_order: 1 },
    { id: "to-66", service: "Сход-развал (3D, внедорожник)", price: "2 500 ₽", note: "", category: "wheel-alignment", sort_order: 2 },
    { id: "main-1", service: "Выезд мастера для диагностики", price: "Бесплатно", note: "В пределах МКАД", category: "main", sort_order: 1 },
    { id: "main-2", service: "Эвакуация автомобиля", price: "Бесплатно", note: "При согласии на ремонт", category: "main", sort_order: 2 },
    { id: "main-3", service: "Предварительная запись", price: "Бесплатно", note: "По телефону или через сайт", category: "main", sort_order: 3 },
  ];

  // Category display names
  const CATEGORY_NAMES = {
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

  // Category icons
  const CATEGORY_ICONS = {
    'main': '🔧',
    'to': '🛠️',
    'diagnostics': '📊',
    'engine': '⚙️',
    'suspension': '🔩',
    'brakes': '🛑',
    'transmission': '⚡',
    'ac': '❄️',
    'body': '🚗',
    'tires': '🔘',
    'polishing': '✨',
    'extras': '➕',
    'wheel-alignment': '📐'
  };

  /**
   * Fetch prices from API with cache support and local fallback
   */
  async function fetchPrices() {
    // 1. Try admin data from localStorage first (saved via admin panel)
    try {
      const adminData = localStorage.getItem(ADMIN_DATA_KEY);
      if (adminData) {
        const parsed = JSON.parse(adminData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      // ignore
    }

    // 2. Try API cache
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          return data;
        }
      }
    } catch (e) {
      // Cache invalid, ignore
    }

    // 3. Fetch from API
    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      
      if (result.prices && Array.isArray(result.prices)) {
        // Update cache
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            data: result.prices,
            timestamp: Date.now()
          }));
        } catch (e) {
          // localStorage full or unavailable
        }
        return result.prices;
      }
      throw new Error('Invalid response format');
    } catch (error) {
      console.warn('API unavailable, using default prices:', error.message);
      // 4. Fallback to default prices for local development
      return DEFAULT_PRICES;
    }
  }


  /**
   * Render prices into a container element
   */
  function renderPrices(prices, container) {
    if (!prices || prices.length === 0) {
      container.innerHTML = '<p class="prices-error">Цены временно недоступны. Пожалуйста, позвоните нам для уточнения.</p>';
      return;
    }

    // Group by category
    const categories = {};
    prices.forEach(item => {
      const cat = item.category || 'main';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(item);
    });

    // Sort categories by first item's sort_order
    const sortedCategories = Object.keys(categories).sort((a, b) => {
      const aOrder = categories[a][0]?.sort_order || 0;
      const bOrder = categories[b][0]?.sort_order || 0;
      return aOrder - bOrder;
    });

    let html = '';

    sortedCategories.forEach(cat => {
      const catName = CATEGORY_NAMES[cat] || cat;
      const catIcon = CATEGORY_ICONS[cat] || '📋';
      
      html += `<div class="price-category">
        <h3 class="price-category-title">${catIcon} ${catName}</h3>
        <div class="price-table-wrapper">
          <table class="price-table">
            <thead>
              <tr>
                <th>Услуга</th>
                <th>Цена</th>
                <th>Примечание</th>
              </tr>
            </thead>
            <tbody>`;

      // Sort items within category
      const sortedItems = categories[cat].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      
      sortedItems.forEach(item => {
        const note = item.note ? `<span class="price-note">${escapeHtml(item.note)}</span>` : '';
        html += `<tr>
          <td class="price-service">${escapeHtml(item.service)}</td>
          <td class="price-value">${escapeHtml(item.price)}</td>
          <td class="price-note-cell">${note}</td>
        </tr>`;
      });

      html += `</tbody></table></div></div>`;
    });

    container.innerHTML = html;
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Render prices for a single service page (filtered by category)
   */
  function renderServicePrices(prices, container) {
    const category = container.getAttribute('data-category');
    if (!category) return;

    // Filter prices by category
    const filteredPrices = prices.filter(item => item.category === category);

    if (!filteredPrices || filteredPrices.length === 0) {
      container.innerHTML = '';
      return;
    }

    // Sort by sort_order
    const sortedItems = filteredPrices.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    let html = '<h2>Стоимость</h2>';
    html += '<div class="price-table-wrapper"><table class="price-table"><thead><tr><th>Услуга</th><th>Цена</th><th>Примечание</th></tr></thead><tbody>';

    sortedItems.forEach(item => {
      const note = item.note ? `<span class="price-note">${escapeHtml(item.note)}</span>` : '';
      html += `<tr>
        <td class="price-service">${escapeHtml(item.service)}</td>
        <td class="price-value">${escapeHtml(item.price)}</td>
        <td class="price-note-cell">${note}</td>
      </tr>`;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
  }

  /**
   * Initialize price loading on the page
   */
  async function initPrices() {
    const containers = document.querySelectorAll('[data-prices-container]');
    const serviceContainers = document.querySelectorAll('[data-service-prices]');

    if (containers.length === 0 && serviceContainers.length === 0) return;

    // Show loading state for main prices page
    containers.forEach(container => {
      container.innerHTML = '<div class="prices-loading"><div class="spinner"></div><span>Загрузка цен...</span></div>';
    });

    // Show loading state for service pages
    serviceContainers.forEach(container => {
      container.innerHTML = '<div class="prices-loading"><div class="spinner"></div><span>Загрузка цен...</span></div>';
    });

    const prices = await fetchPrices();

    containers.forEach(container => {
      if (prices) {
        renderPrices(prices, container);
      } else {
        container.innerHTML = '<p class="prices-error">Цены временно недоступны. Пожалуйста, позвоните нам для уточнения.</p>';
      }
    });

    serviceContainers.forEach(container => {
      if (prices) {
        renderServicePrices(prices, container);
      } else {
        container.innerHTML = '<p class="prices-error">Цены временно недоступны. Пожалуйста, позвоните нам для уточнения.</p>';
      }
    });
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPrices);
  } else {
    initPrices();
  }

  // Expose for manual refresh
  window.refreshPrices = async function() {
    // Clear cache
    localStorage.removeItem(CACHE_KEY);
    await initPrices();
  };

})();


