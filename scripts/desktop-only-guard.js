/**
 * Сайт только для ПК. Телефоны и планшеты с типичным mobile User-Agent блокируются.
 * Режим «Версия для ПК» в браузере подменяет UA на десктопный — доступ разрешён.
 */
(function () {
    if (typeof window === 'undefined' || window.__reminkoDesktopGuardRan) return;
    window.__reminkoDesktopGuardRan = true;

    function uaLooksLikeDesktopPC(userAgent) {
        var ua = userAgent || '';
        // Подмена под Windows / macOS / Linux x86_64 / Chrome OS (режим «сайт для ПК»)
        if (/Windows NT|Macintosh; Intel Mac OS X|X11; Linux x86_64|X11; CrOS|Win64; x64/i.test(ua)) {
            if (/Android|webOS|iPhone|iPad|iPod|Mobile Safari\/|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
                return false;
            }
            return true;
        }
        return false;
    }

    function isLikelySearchOrPreviewBot(userAgent) {
        var ua = userAgent || '';
        return /Googlebot|Google-InspectionTool|AdsBot-Google|Mediapartners-Google|bingbot|YandexBot|YandexImages|Slurp|DuckDuckBot|facebookexternalhit|Facebot|TelegramBot|vkShare|Twitterbot|LinkedInBot|Applebot|ia_archiver/i.test(
            ua
        );
    }

    function shouldBlockMobileBrowsing(userAgent) {
        var ua = userAgent || navigator.userAgent || '';
        if (!ua) return false;
        if (isLikelySearchOrPreviewBot(ua)) return false;
        if (uaLooksLikeDesktopPC(ua)) return false;
        if (/iPhone|iPod|Android.*Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true;
        if (/iPad/i.test(ua)) return true;
        if (/Android/i.test(ua)) return true;
        return false;
    }

    if (!shouldBlockMobileBrowsing()) return;

    function getPcHintBaseUrl() {
        var list = document.querySelectorAll('script[src*="desktop-only-guard"]');
        var el = list[list.length - 1];
        if (el && el.src) {
            var base = el.src.replace(/\/[^/]+$/, '/');
            return base + '../Fons/mobile-pc-hint/';
        }
        var path = (window.location && window.location.pathname) || '';
        if (
            path.indexOf('/catalog/') !== -1 ||
            path.indexOf('/anime/') !== -1 ||
            path.indexOf('/manga/') !== -1
        ) {
            return '../Fons/mobile-pc-hint/';
        }
        return 'Fons/mobile-pc-hint/';
    }

    /** Чьи скриншоты показывать: только Яндекс, только Chrome/Chromium, или оба (неопознанный браузер). */
    function detectMobileGuideFamily(userAgent) {
        var ua = userAgent || navigator.userAgent || '';
        if (/YaBrowser|Yandex/i.test(ua)) return 'yandex';
        if (
            /EdgA|EdgiOS|CriOS|Chrome\/|SamsungBrowser|OPR\/|Opera\/|Brave\/|Vivalidi/i.test(ua)
        ) {
            return 'chrome';
        }
        return 'both';
    }

    function mountWall() {
        if (document.getElementById('reminko-desktop-only-wall')) return;

        var hintBase = getPcHintBaseUrl();
        var guideFamily = detectMobileGuideFamily();

        var css =
            '#reminko-desktop-only-wall{position:fixed;inset:0;z-index:2147483647;' +
            'display:flex;align-items:flex-start;justify-content:center;padding:1rem 1rem 1.5rem;' +
            'box-sizing:border-box;background:#0a0a12;color:#e2e8f0;' +
            'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;' +
            'text-align:center;-webkit-text-size-adjust:100%;overflow-y:auto;-webkit-overflow-scrolling:touch;}' +
            '#reminko-desktop-only-wall *{box-sizing:border-box;}' +
            '#reminko-desktop-only-wall .reminko-dow-card{max-width:22rem;width:100%;' +
            'margin:0.75rem auto 1.25rem;padding:1.2rem 1rem;border-radius:1rem;' +
            'max-height:none;' +
            'background:linear-gradient(145deg,rgba(91,33,182,0.35),rgba(15,15,28,0.95));' +
            'border:1px solid rgba(167,139,250,0.35);box-shadow:0 12px 40px rgba(0,0,0,0.5);}' +
            '#reminko-desktop-only-wall h1{margin:0 0 0.65rem;font-size:1.05rem;font-weight:800;' +
            'line-height:1.35;background:linear-gradient(90deg,#c084fc,#e879f9);' +
            '-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}' +
            '#reminko-desktop-only-wall p{margin:0 0 0.75rem;font-size:0.82rem;line-height:1.5;' +
            'color:#cbd5e1;opacity:0.95;text-align:left;}' +
            '#reminko-desktop-only-wall .reminko-dow-hint{font-size:0.78rem;color:#94a3b8;' +
            'padding:0.65rem;border-radius:0.65rem;background:rgba(0,0,0,0.25);' +
            'border:1px solid rgba(255,255,255,0.06);text-align:left;}' +
            '#reminko-desktop-only-wall .reminko-dow-guides{margin-top:1rem;padding-top:1rem;' +
            'border-top:1px solid rgba(167,139,250,0.25);text-align:left;}' +
            '#reminko-desktop-only-wall .reminko-dow-guide-title{margin:0 0 0.55rem;font-size:0.86rem;font-weight:800;' +
            'color:#e9d5ff;text-align:center;line-height:1.35;}' +
            '#reminko-desktop-only-wall .reminko-dow-guide-note{margin:-0.15rem 0 0.75rem;font-size:0.72rem;' +
            'color:#a5b4c6;text-align:center;line-height:1.4;}' +
            '#reminko-desktop-only-wall .reminko-dow-panel{max-width:17.5rem;margin:0 auto 0.9rem;padding:0.55rem 0.5rem 0.65rem;' +
            'background:rgba(0,0,0,0.38);border:1px solid rgba(167,139,250,0.22);border-radius:0.75rem;' +
            'box-shadow:inset 0 1px 0 rgba(255,255,255,0.04);}' +
            '#reminko-desktop-only-wall .reminko-dow-panel:last-child{margin-bottom:0;}' +
            '#reminko-desktop-only-wall .reminko-dow-browser-name{margin:0 0 0.5rem;font-size:0.78rem;font-weight:800;' +
            'color:#ddd6fe;text-align:center;letter-spacing:0.02em;}' +
            '#reminko-desktop-only-wall .reminko-dow-guide-block{margin-bottom:0;}' +
            '#reminko-desktop-only-wall figure.reminko-dow-fig{margin:0 0 0.65rem;}' +
            '#reminko-desktop-only-wall figure.reminko-dow-fig:last-child{margin-bottom:0;}' +
            '#reminko-desktop-only-wall .reminko-dow-fig-inner{display:flex;justify-content:center;align-items:center;' +
            'min-height:4.25rem;max-height:14rem;border-radius:0.55rem;border:1px solid rgba(255,255,255,0.07);' +
            'background:rgba(0,0,0,0.28);overflow:hidden;padding:0.25rem;}' +
            '#reminko-desktop-only-wall .reminko-dow-fig img{display:block;max-width:100%;width:auto;height:auto;' +
            'max-height:13.25rem;object-fit:contain;object-position:center;border-radius:0.35rem;}' +
            '#reminko-desktop-only-wall .reminko-dow-cap{margin-top:0.38rem;font-size:0.7rem;line-height:1.45;' +
            'color:#a8b8cc;text-align:center;}';

        var st = document.createElement('style');
        st.textContent = css;
        (document.head || document.documentElement).appendChild(st);

        function chromeBlock() {
            return (
                '<div class="reminko-dow-panel">' +
                '<p class="reminko-dow-browser-name">Google Chrome</p>' +
                '<figure class="reminko-dow-fig">' +
                '<div class="reminko-dow-fig-inner"><img src="' +
                hintBase +
                'chrome-hint-1.png" alt="Chrome: три точки справа вверху"></div>' +
                '<figcaption class="reminko-dow-cap">Шаг 1 — меню (три точки) справа вверху</figcaption>' +
                '</figure>' +
                '<figure class="reminko-dow-fig">' +
                '<div class="reminko-dow-fig-inner"><img src="' +
                hintBase +
                'chrome-hint-2.png" alt="Chrome: «Версия для ПК»"></div>' +
                '<figcaption class="reminko-dow-cap">Шаг 2 — «Версия для ПК», затем обновите страницу</figcaption>' +
                '</figure>' +
                '</div>'
            );
        }

        function yandexBlock() {
            return (
                '<div class="reminko-dow-panel">' +
                '<p class="reminko-dow-browser-name">Яндекс Браузер</p>' +
                '<figure class="reminko-dow-fig">' +
                '<div class="reminko-dow-fig-inner"><img src="' +
                hintBase +
                'yandex-hint-1.png" alt="Яндекс: меню у адресной строки"></div>' +
                '<figcaption class="reminko-dow-cap">Шаг 1 — меню у панели адреса</figcaption>' +
                '</figure>' +
                '<figure class="reminko-dow-fig">' +
                '<div class="reminko-dow-fig-inner"><img src="' +
                hintBase +
                'yandex-hint-2.png" alt="Яндекс: «Открыть версию для ПК»"></div>' +
                '<figcaption class="reminko-dow-cap">Шаг 2 — «Открыть версию для ПК»</figcaption>' +
                '</figure>' +
                '</div>'
            );
        }

        var guideTitle;
        var guideNote = '';
        var guidesHtml = '';
        if (guideFamily === 'yandex') {
            guideTitle = 'Подсказка для Яндекс Браузера';
            guidesHtml = yandexBlock();
        } else if (guideFamily === 'chrome') {
            guideTitle = 'Подсказка для Google Chrome';
            guidesHtml = chromeBlock();
        } else {
            guideTitle = 'Подсказки для браузера';
            guideNote =
                '<p class="reminko-dow-guide-note">Браузер не распознан — ниже оба варианта. Выберите свой.</p>';
            guidesHtml = chromeBlock() + yandexBlock();
        }

        var wall = document.createElement('div');
        wall.id = 'reminko-desktop-only-wall';
        wall.setAttribute('role', 'alertdialog');
        wall.setAttribute('aria-modal', 'true');
        wall.setAttribute('aria-labelledby', 'reminko-dow-title');
        wall.innerHTML =
            '<div class="reminko-dow-card">' +
            '<h1 id="reminko-dow-title">Сайт только для ПК</h1>' +
            '<p>Сейчас Re-Minko рассчитан на компьютер: с телефона и других мобильных устройств зайти в эту веб-версию нельзя.</p>' +
            '<p>В будущем планируются <strong>мобильное приложение</strong> для смартфонов и <strong>приложение для телевизоров</strong> (Smart&nbsp;TV).</p>' +
            '<p class="reminko-dow-hint">Если нужно открыть сайт в браузере телефона уже сейчас: в меню включите ' +
            '<strong>«Версия для ПК»</strong> / <strong>«Открыть версию для ПК»</strong> и обновите страницу.</p>' +
            '<div class="reminko-dow-guides">' +
            '<p class="reminko-dow-guide-title">' +
            guideTitle +
            '</p>' +
            guideNote +
            guidesHtml +
            '</div>' +
            '</div>';

        (document.body || document.documentElement).appendChild(wall);
        if (document.body) {
            document.body.style.overflow = 'hidden';
        }
    }

    if (document.body) mountWall();
    else document.addEventListener('DOMContentLoaded', mountWall);
})();
