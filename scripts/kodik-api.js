/**
 * Клиент Kodik API (https://kodik-api.com) — единственный способ запросов к Kodik в проекте.
 * Токен передаётся параметром token (GET query или POST form).
 *
 * Настройка: в config.local.js до подключения config.js:
 *   window.APP_CONFIG = window.APP_CONFIG || {};
 *   window.APP_CONFIG.kodik = window.APP_CONFIG.kodik || {};
 *   window.APP_CONFIG.kodik.apiToken = 'ваш_токен';
 *
 * Важно: запросы из браузера видны в DevTools — токен не секретен для посетителей.
 * Для публичного сайта надёжнее проксировать API на своём сервере.
 */
(function () {
    function kodikCfg() {
        return (typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG.kodik) || {};
    }

    function apiToken() {
        const t = kodikCfg().apiToken;
        if (!t || typeof t !== 'string' || !t.trim()) {
            throw new Error(
                '[Kodik API] Не задан kodik.apiToken. Добавьте токен в config.local.js (см. config.local.example.js).'
            );
        }
        return t.trim();
    }

    function baseUrl() {
        return (kodikCfg().apiOrigin || 'https://kodik-api.com').replace(/\/$/, '');
    }

    function normalizePath(path) {
        const p = String(path || '').trim();
        if (!p) return '/';
        return p.startsWith('/') ? p : `/${p}`;
    }

    /**
     * @param {string} path — например /search, /list
     * @param {Record<string, string|number|boolean|undefined|null>} params
     * @param {{ method?: 'GET'|'POST' }} opts
     * @returns {Promise<any>}
     */
    async function request(path, params, opts) {
        const token = apiToken();
        const merged = Object.assign({}, params || {}, { token });
        const method = ((opts && opts.method) || 'GET').toUpperCase();
        const url = new URL(baseUrl() + normalizePath(path));

        if (method === 'GET') {
            Object.keys(merged).forEach((key) => {
                const v = merged[key];
                if (v !== undefined && v !== null && v !== '') {
                    url.searchParams.set(key, String(v));
                }
            });
            const res = await fetch(url.toString(), {
                method: 'GET',
                credentials: 'omit'
            });
            return parseResponse(res);
        }

        const body = new URLSearchParams();
        Object.keys(merged).forEach((key) => {
            const v = merged[key];
            if (v !== undefined && v !== null && v !== '') {
                body.append(key, String(v));
            }
        });
        const res = await fetch(url.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
            credentials: 'omit'
        });
        return parseResponse(res);
    }

    async function parseResponse(res) {
        const text = await res.text();
        let data = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch (_) {
            const err = new Error(`[Kodik API] Ответ не JSON: ${text.slice(0, 160)}`);
            err.status = res.status;
            throw err;
        }
        if (!res.ok) {
            const err = new Error(
                (data && (data.error || data.message)) || `HTTP ${res.status}`
            );
            err.status = res.status;
            err.data = data;
            throw err;
        }
        return data;
    }

    function hasToken() {
        try {
            apiToken();
            return true;
        } catch (_) {
            return false;
        }
    }

    window.KodikApi = {
        request,
        hasToken,
        qualities: (p) => request('/qualities', p || {}),
        translations: (p) => request('/translations/v2', p || {}),
        countries: (p) => request('/countries', p || {}),
        genres: (p) => request('/genres', p || {}),
        years: (p) => request('/years', p || {}),
        list: (p) => request('/list', p || {}),
        search: (p) => request('/search', p || {})
    };
})();
