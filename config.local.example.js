// Пример локального файла конфигурации
// Скопируйте этот файл в config.local.js и заполните своими значениями
// config.local.js не должен попадать в репозиторий (добавьте в .gitignore)

// Этот файл загружается перед config.js и переопределяет значения по умолчанию.
// В HTML порядок обязателен: <script src="config.local.js"></script> затем <script src="scripts/config.js"></script>
window.APP_CONFIG = window.APP_CONFIG || {};

// Публичный HTTPS-адрес сайта (без слэша в конце). Совпадайте с canonical / sitemap / Search Console.
// window.APP_CONFIG.siteOrigin = 'https://re-minko-anime.com';
window.APP_CONFIG.supabase = {
    url: 'YOUR_SUPABASE_URL',
    // Публичный ключ из Dashboard → Settings → API: sb_publishable_… или legacy anon JWT (eyJ…).
    // Ключ sb_secret_ сюда не вставляйте — только для сервера / Edge Functions с осторожностью.
    anonKey: 'YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY'
};

// Minko AI использует Grok через локальный прокси
// URL POST для чата (minko-ai.html и виджет «Поддержка»). Для GitHub Pages укажите свой HTTPS-прокси.
// window.APP_CONFIG.minkoChatProxy = 'https://ваш-домен/api/minko-chat';

// Kodik: только API kodik-api.com (поиск → ссылка на плеер). Подключите config.local.js в HTML *перед* scripts/config.js
// window.APP_CONFIG.kodik = window.APP_CONFIG.kodik || {};
// window.APP_CONFIG.kodik.apiToken = 'ВАШ_ТОКЕН_ИЗ_ЛИЧНОГО_КАБИНЕТА_KODIK';
// window.APP_CONFIG.kodik.loadChangeDomainsScript = true; // только если осознанно нужен change-domains.min.js с kodik-add.com
// window.APP_CONFIG.kodik.playerOrigin = 'https://kodikplayer.com';
// window.APP_CONFIG.kodik.socialPlayerOrigin = 'https://kodikonline.com';
// window.APP_CONFIG.kodik.apiOrigin = 'https://kodik-api.com';
// Опционально — свои списки для kodik-change-domains.js (скрипт с kodik-add.com).
// Реклама Яндекса (РСЯ) на info.html — укажите ID блоков из кабинета
// window.APP_CONFIG.yandexRtb = window.APP_CONFIG.yandexRtb || {};
// window.APP_CONFIG.yandexRtb.infoPageBlockIds = ['R-A-XXXXXXXX-1'];

// window.APP_CONFIG.kodik.domainReplace = {
//     fromDomains: ['kodik.biz', 'kodik.cc'],
//     toDomain: 'kodikplayer.com',
//     onDomReady: true
// };
