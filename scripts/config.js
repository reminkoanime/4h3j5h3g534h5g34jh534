// Конфигурация приложения
// ВАЖНО: Не коммитьте этот файл с реальными секретами в публичный репозиторий!
// Используйте переменные окружения или отдельный файл config.local.js
// 
// Для локальной разработки создайте config.local.js в корне проекта:
// window.APP_CONFIG = { supabase: { url: '...', anonKey: '...' }, ... }

// Конфигурация по умолчанию (для разработки)
// Если есть window.APP_CONFIG от config.local.js, используем его значения
const APP_CONFIG = {
    /**
     * Публичный URL сайта без слэша в конце (для ссылок из JS). На проде задайте в config.local.js.
     * Должен совпадать с доменом в canonical (index.html) и sitemap.xml.
     */
    siteOrigin:
        typeof window.APP_CONFIG?.siteOrigin === 'string' && window.APP_CONFIG.siteOrigin.trim()
            ? window.APP_CONFIG.siteOrigin.trim().replace(/\/$/, '')
            : typeof window !== 'undefined' &&
                window.location?.origin &&
                !window.location.hostname.includes('localhost') &&
                !window.location.hostname.includes('127.0.0.1')
              ? window.location.origin
              : 'https://re-minko-anime.com',

    // Supabase настройки
    supabase: {
        url: window.APP_CONFIG?.supabase?.url || 'https://ipsawgtsicxwkkkipchp.supabase.co',
        // Публичный ключ: sb_publishable_… или legacy anon JWT. sb_secret_ / service_role — только на сервере.
        anonKey:
            window.APP_CONFIG?.supabase?.anonKey ||
            'sb_publishable_dcESewUuxxhwdhag8VqsDg_NklGox9v'
    },

    // Kodik: встраивание через Kodik API (kodik-api.com/search), не через kodik.info/find-player.
    kodik: {
        /** Основной плеер (ссылки из API ведут на kodikplayer.com) */
        playerOrigin:
            (window.APP_CONFIG?.kodik?.playerOrigin || 'https://kodikplayer.com').replace(
                /\/$/,
                ''
            ),
        /** Плеер для соцсетей */
        socialPlayerOrigin:
            (window.APP_CONFIG?.kodik?.socialPlayerOrigin || 'https://kodikonline.com').replace(
                /\/$/,
                ''
            ),
        /** API Kodik (домен запросов) */
        apiOrigin:
            (window.APP_CONFIG?.kodik?.apiOrigin || 'https://kodik-api.com').replace(/\/$/, ''),
        /**
         * Токен Kodik API — только через config.local.js (файл в .gitignore).
         * Не вставляйте токен в config.js в публичный репозиторий: его увидят все.
         */
        apiToken:
            typeof window.APP_CONFIG?.kodik?.apiToken === 'string'
                ? window.APP_CONFIG.kodik.apiToken.trim()
                : '',
        /**
         * Опционально: переопределение для scripts/kodik-change-domains.js
         * (fromDomains, toDomain, onDomReady)
         */
        domainReplace: window.APP_CONFIG?.kodik?.domainReplace,
        /**
         * Загрузка change-domains.min.js с kodik-add.com (подмена старых доменов в ссылках плеера).
         * По умолчанию выключено.
         */
        loadChangeDomainsScript:
            window.APP_CONFIG?.kodik?.loadChangeDomainsScript === true
    },
    
    /**
     * URL прокси чата Minko (тот же POST, что minko-ai.html). Для продакшена задайте в config.local.js.
     */
    minkoChatProxy:
        typeof window.APP_CONFIG?.minkoChatProxy === 'string' && window.APP_CONFIG.minkoChatProxy.trim()
            ? window.APP_CONFIG.minkoChatProxy.trim()
            : 'http://localhost:3334/chat',

    // Minko AI использует только Grok через локальный прокси

    // Настройки окружения
    environment: {
        isDev: window.location.hostname === 'localhost' || 
               window.location.hostname === '127.0.0.1' ||
               window.location.search.includes('debug=true'),
        isProduction: !window.location.hostname.includes('localhost') && 
                      !window.location.hostname.includes('127.0.0.1')
    },

    /**
     * Рекламные блоки Яндекса (РСЯ) для отдельных страниц.
     * ID блоков вида R-A-12345678-1 из кабинета РСЯ → Конструктор → Код блока.
     * Задаётся в config.local.js: window.APP_CONFIG.yandexRtb = { infoPageBlockIds: ['R-A-...'] };
     */
    yandexRtb: {
        infoPageBlockIds: Array.isArray(window.APP_CONFIG?.yandexRtb?.infoPageBlockIds)
            ? window.APP_CONFIG.yandexRtb.infoPageBlockIds.filter(
                  (id) => typeof id === 'string' && id.trim().length > 0
              )
            : []
    }
    
};

// Экспортируем конфигурацию
window.APP_CONFIG = APP_CONFIG;

// Для обратной совместимости
if (typeof SUPABASE_URL === 'undefined') {
    window.SUPABASE_URL = APP_CONFIG.supabase.url;
    window.SUPABASE_ANON_KEY = APP_CONFIG.supabase.anonKey;
}
