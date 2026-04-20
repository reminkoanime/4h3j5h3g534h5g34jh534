// Локальная конфигурация (не коммитить в репозиторий)
window.APP_CONFIG = window.APP_CONFIG || {};
window.APP_CONFIG.supabase = {
    url: 'https://ipsawgtsicxwkkkipchp.supabase.co',
    // Публичный ключ (sb_publishable_… или legacy anon JWT). Не кладите сюда sb_secret_ — только для сервера.
    anonKey: 'sb_publishable_dcESewUuxxhwdhag8VqsDg_NklGox9v'
};

// Kodik: только официальный API (kodik-api.com). Токен — в личном кабинете Kodik.
window.APP_CONFIG.kodik = window.APP_CONFIG.kodik || {};
window.APP_CONFIG.kodik.apiToken = 'd03730f858a682af5489974fbc940437';
