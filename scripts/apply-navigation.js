// Универсальный скрипт для применения навигации ко всем страницам
// Добавляется в конец body перед закрывающим тегом

(function injectLive2dWidgetEverywhere() {
    if (typeof window === 'undefined' || window.__reminkoLive2dInjected) return;
    window.__reminkoLive2dInjected = true;
    try {
        var cur = document.currentScript;
        if (!cur || !cur.src) {
            var list = document.querySelectorAll('script[src*="apply-navigation"]');
            cur = list[list.length - 1];
        }
        if (!cur || !cur.src) return;
        var base = cur.src.replace(/[^/]+$/, '');
        var s = document.createElement('script');
        s.src = base + 'live2d-widget-init.js';
        s.async = true;
        (document.head || document.documentElement).appendChild(s);
    } catch (e) {
        console.warn('[Live2D] inject:', e);
    }
})();

(function injectSupportMinkoChatScript() {
    if (typeof window === 'undefined' || window.__reminkoSupportChatInjected) return;
    window.__reminkoSupportChatInjected = true;
    try {
        var cur = document.currentScript;
        if (!cur || !cur.src) {
            var list = document.querySelectorAll('script[src*="apply-navigation"]');
            cur = list[list.length - 1];
        }
        if (!cur || !cur.src) return;
        var base = cur.src.replace(/[^/]+$/, '');
        var s = document.createElement('script');
        s.src = base + 'support-minko-chat.js';
        (document.body || document.documentElement).appendChild(s);
    } catch (e) {
        console.warn('[Support Minko] inject:', e);
    }
})();

(function() {
    'use strict';
    
    // Проверяем, нужно ли применять навигацию
    const path = window.location.pathname;
    const skipPages = ['reset-password.html', 'payment-success.html', 'cancel-success.html'];
    const shouldSkip = skipPages.some(page => path.includes(page));
    
    if (shouldSkip) {
        const fireSkip = () => {
            document.body.classList.add('reminko-ui-ready');
            try {
                window.dispatchEvent(new CustomEvent('reminko:navigation-applied'));
            } catch (e) {
                /* ignore */
            }
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fireSkip, { once: true });
        } else {
            fireSkip();
        }
        return;
    }
    
    // Оптимизация: применяем навигацию сразу, если DOM уже загружен
    // или используем requestIdleCallback для неблокирующей загрузки
    async function initNavigation() {
        if (!window.navigationManager) {
            setTimeout(initNavigation, 50);
            return;
        }
        try {
            if (typeof window.reminkoEnsureMaintenanceGate === 'function') {
                await window.reminkoEnsureMaintenanceGate();
            }
        } catch (e) {
            console.warn('[Maintenance gate]', e);
        }
        if (window.__reminkoMaintenancePageReplaced) {
            try {
                window.dispatchEvent(new CustomEvent('reminko:navigation-applied'));
            } catch (err) {
                /* ignore */
            }
            return;
        }
        window.navigationManager.applyNavigation();
    }
    
    // Если DOM уже загружен - применяем сразу
    if (document.readyState !== 'loading') {
        // Используем requestIdleCallback для неблокирующей загрузки
        if (window.requestIdleCallback) {
            requestIdleCallback(initNavigation, { timeout: 100 });
        } else {
            // Fallback для старых браузеров
            setTimeout(initNavigation, 0);
        }
    } else {
        // Ждем загрузки DOM, но с приоритетом
        document.addEventListener('DOMContentLoaded', initNavigation, { once: true });
    }
})();
