// Главная страница - Re-Minko

const JIKAN_HOME_BASE = 'https://api.jikan.moe/v4';
const JIKAN_HOME_CACHE_KEY = 'home_jikan_cache_v3';
const JIKAN_HOME_CACHE_TTL = 45 * 60 * 1000; // 45 мин — чаще подтягиваем сезон/анонсы

function initHomeBetaBanner() {
    const el = document.getElementById('homeBetaUpdated');
    if (!el) return;
    const tick = () => {
        el.textContent =
            'Метка времени: ' +
            new Date().toLocaleString('ru-RU', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            }) +
            ' — правки выкатываются регулярно.';
    };
    tick();
    setInterval(tick, 60 * 1000);
}

function getHomeCache() {
    try {
        const raw = sessionStorage.getItem(JIKAN_HOME_CACHE_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (Date.now() - data.ts > JIKAN_HOME_CACHE_TTL) {
            sessionStorage.removeItem(JIKAN_HOME_CACHE_KEY);
            return null;
        }
        return data;
    } catch { return null; }
}

function setHomeCache(key, value) {
    try {
        const existing = getHomeCache() || { ts: Date.now() };
        existing[key] = value;
        existing.ts = Date.now();
        sessionStorage.setItem(JIKAN_HOME_CACHE_KEY, JSON.stringify(existing));
    } catch { /* ignore */ }
}

async function jikanHomeFetch(url, attempt = 0) {
    const res = await fetch(url);
    if (res.status === 429 && attempt < 8) {
        const ra = parseInt(res.headers.get('Retry-After') || '', 10);
        const delayMs = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 3200 + attempt * 1800;
        await new Promise((r) => setTimeout(r, delayMs));
        return jikanHomeFetch(url, attempt + 1);
    }
    if (!res.ok) throw new Error(res.status === 429 ? 'Jikan rate limit' : `Jikan ${res.status}`);
    return res.json();
}

document.addEventListener('DOMContentLoaded', () => {
    function initHome() {
        if (typeof animeDatabase === 'undefined' || !animeDatabase.all) {
            setTimeout(initHome, 50);
            return;
        }

        if (typeof initPosterObserver === 'function') {
            initPosterObserver();
        }

        initHomeBetaBanner();

        updateHeroStats();
        loadFriendsWatching();

        loadSeasonAnime();
        setTimeout(() => loadUpcomingAnime(), 2800);
    }

    initHome();
});

function updateHeroStats() {
    const animeCountEl = document.getElementById('statAnimeCount');
    const mangaCountEl = document.getElementById('statMangaCount');

    if (animeCountEl && typeof animeDatabase !== 'undefined') {
        const anime = Array.isArray(animeDatabase.all) ? animeDatabase.all : [];
        const uniqueAnimeCount = new Set(anime.map(a => parseInt(a.id)).filter(Number.isFinite)).size;
        animeCountEl.textContent = uniqueAnimeCount || '0';
    }
    if (mangaCountEl && typeof mangaDatabase !== 'undefined') {
        mangaCountEl.textContent = mangaDatabase.all ? mangaDatabase.all.length : '0';
    }

    const seasonBadge = document.querySelector('.badge-season');
    if (seasonBadge) {
        const now = new Date();
        const month = now.getMonth();
        const year = now.getFullYear();
        const seasons = { 0: 'Зима', 1: 'Зима', 2: 'Весна', 3: 'Весна', 4: 'Весна', 5: 'Лето', 6: 'Лето', 7: 'Лето', 8: 'Осень', 9: 'Осень', 10: 'Осень', 11: 'Зима' };
        seasonBadge.textContent = seasons[month] + ' ' + year;
    }
}

// ==================== Jikan API секции ====================

const HOME_CAROUSEL_INTERVAL_MS = 3000;
/** Порог «сдвинули ленту»; меньше — ложные срабатывания на тапе/тачскролле */
const HOME_CAROUSEL_DRAG_PX = 22;
const HOME_CAROUSEL_PAUSE_MS = 5000;
const HOME_CAROUSEL_TAP_MAX_MS = 380;

if (typeof window !== 'undefined' && !window.__homeCarouselEls) {
    window.__homeCarouselEls = new Set();
}

function dedupeMal(list) {
    const m = new Map();
    for (const x of list) {
        if (x && x.mal_id && !m.has(x.mal_id)) m.set(x.mal_id, x);
    }
    return [...m.values()];
}

async function jikanFetchPaged(pathWithLeadingSlash, maxItems) {
    const all = [];
    let page = 1;
    const cap = maxItems || 50;
    while (all.length < cap && page <= 4) {
        const sep = pathWithLeadingSlash.includes('?') ? '&' : '?';
        const url = `${JIKAN_HOME_BASE}${pathWithLeadingSlash}${sep}page=${page}`;
        const data = await jikanHomeFetch(url);
        const chunk = data.data || [];
        all.push(...chunk);
        if (!data.pagination?.has_next_page || chunk.length === 0) break;
        page++;
        if (all.length < cap) await new Promise((r) => setTimeout(r, 650));
    }
    return dedupeMal(all).slice(0, cap);
}

function registerCarouselEl(container) {
    if (typeof window === 'undefined' || !window.__homeCarouselEls) return;
    window.__homeCarouselEls.add(container);
    ensureHomeCarouselMaster();
}

function unregisterCarouselEl(container) {
    if (typeof window === 'undefined' || !window.__homeCarouselEls) return;
    window.__homeCarouselEls.delete(container);
}

function ensureHomeCarouselMaster() {
    if (typeof window === 'undefined' || window.__homeCarouselMasterStarted) return;
    window.__homeCarouselMasterStarted = true;
    let lastTick = 0;
    function frame(now) {
        if (!document.hidden && now - lastTick >= HOME_CAROUSEL_INTERVAL_MS) {
            lastTick = now;
            window.__homeCarouselEls.forEach((el) => {
                if (typeof el._homeCarouselAdvance === 'function') el._homeCarouselAdvance();
            });
        }
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

function teardownHomeHorizontalScroll(container) {
    if (!container || typeof container._homeHorizontalTeardown !== 'function') return;
    container._homeHorizontalTeardown();
    container._homeHorizontalTeardown = null;
}

function getHomeScrollStep(container) {
    const card = container.querySelector('.jikan-card');
    if (!card) return 176;
    const style = window.getComputedStyle(container);
    const gap = parseFloat(style.gap || style.columnGap) || 16;
    return card.getBoundingClientRect().width + gap;
}

/** Бесконечная горизонтальная лента (тройной набор), автопрокрутка; пауза 5 с только после ручного горизонтального жеста */
function enhanceHomeHorizontalScroll(container) {
    if (!container) return;
    teardownHomeHorizontalScroll(container);

    let pauseUntil = 0;
    const bumpPause = () => {
        pauseUntil = Date.now() + HOME_CAROUSEL_PAUSE_MS;
    };

    let drag = false;
    let dragged = false;
    let captureApplied = false;
    let startX = 0;
    let startScroll = 0;
    let activePointer = null;
    let pointerDownAt = 0;
    let maxAbsDx = 0;

    function getSetW() {
        const w = container._infiniteSetWidth;
        return w && w > 0 ? w : Math.max(1, (container.scrollWidth || 0) / 3);
    }

    function normalizeLoop() {
        const W = getSetW();
        if (W <= 1) return;
        const sl = container.scrollLeft;
        if (sl < 48) container.scrollLeft = sl + W;
        else if (sl > W * 2 - 48) container.scrollLeft = sl - W;
    }

    function onPointerDown(e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (e.target.closest('.jikan-card-go-btn')) return;
        delete container.dataset.suppressJikanClick;
        drag = true;
        dragged = false;
        captureApplied = false;
        pointerDownAt = Date.now();
        maxAbsDx = 0;
        startX = e.clientX;
        startScroll = container.scrollLeft;
        activePointer = e.pointerId;
        container.classList.add('is-dragging');
    }

    function onPointerMove(e) {
        if (!drag || e.pointerId !== activePointer) return;
        const dx = e.clientX - startX;
        maxAbsDx = Math.max(maxAbsDx, Math.abs(dx));
        if (!captureApplied && Math.abs(dx) > HOME_CAROUSEL_DRAG_PX) {
            captureApplied = true;
            try {
                container.setPointerCapture(e.pointerId);
            } catch (_) { /* ignore */ }
        }
        if (Math.abs(dx) > HOME_CAROUSEL_DRAG_PX) {
            dragged = true;
            bumpPause();
        }
        container.scrollLeft = startScroll - dx;
    }

    function onPointerEnd(e) {
        if (!drag || e.pointerId !== activePointer) return;
        drag = false;
        container.classList.remove('is-dragging');
        if (captureApplied) {
            try {
                container.releasePointerCapture(e.pointerId);
            } catch (_) { /* ignore */ }
        }
        captureApplied = false;
        activePointer = null;
        const tapLike =
            Date.now() - pointerDownAt < HOME_CAROUSEL_TAP_MAX_MS &&
            maxAbsDx <= HOME_CAROUSEL_DRAG_PX;
        if (tapLike) dragged = false;
        if (dragged) {
            container.dataset.suppressJikanClick = '1';
        }
    }

    function onScroll() {
        normalizeLoop();
    }

    function onWheel(e) {
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 2) bumpPause();
    }

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerEnd);
    container.addEventListener('pointercancel', onPointerEnd);
    container.addEventListener('scroll', onScroll, { passive: true });
    container.addEventListener('wheel', onWheel, { passive: true });

    container.addEventListener(
        'click',
        (e) => {
            if (container.dataset.suppressJikanClick !== '1') return;
            // После свайпа ленты глотаем «фантомный» клик по постеру, но не блокируем явное нажатие «Перейти»
            if (e.target.closest('.jikan-card-go-btn')) {
                delete container.dataset.suppressJikanClick;
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            delete container.dataset.suppressJikanClick;
        },
        true
    );

    container._homeCarouselAdvance = () => {
        if (document.hidden) return;
        if (Date.now() < pauseUntil) return;
        const W = getSetW();
        if (W <= 1) return;
        const step = getHomeScrollStep(container);
        const maxLeft = W * 3 - container.clientWidth - 1;
        if (maxLeft <= 0) return;
        container.scrollLeft = Math.min(container.scrollLeft + step, maxLeft);
        normalizeLoop();
    };

    registerCarouselEl(container);

    container._homeHorizontalTeardown = () => {
        unregisterCarouselEl(container);
        delete container._homeCarouselAdvance;
        container.removeEventListener('pointerdown', onPointerDown);
        container.removeEventListener('pointermove', onPointerMove);
        container.removeEventListener('pointerup', onPointerEnd);
        container.removeEventListener('pointercancel', onPointerEnd);
        container.removeEventListener('scroll', onScroll);
        container.removeEventListener('wheel', onWheel);
        delete container.dataset.suppressJikanClick;
    };
}

function initialEpLine(anime) {
    if (typeof window !== 'undefined' && window.shikimoriApi && window.shikimoriApi.formatAiredTotal) {
        const t = window.shikimoriApi.formatAiredTotal(anime, null);
        if (t) return t;
    }
    const ep = anime.episodes;
    if (ep != null && ep > 0) return `? / ${ep} эп.`;
    return '';
}

function createJikanCard(anime) {
    const card = document.createElement('div');
    card.className = 'jikan-card';
    card.dataset.malId = String(anime.mal_id);

    const imgUrl = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || '';
    const score = anime.score ? anime.score.toFixed(1) : '—';
    const titleEn = anime.title_english || anime.title || anime.title_japanese || '—';
    const epLine = initialEpLine(anime);
    const status =
        anime.status === 'Currently Airing'
            ? 'В эфире'
            : anime.status === 'Not yet aired'
              ? 'Анонс'
              : anime.status === 'Finished Airing'
                ? 'Завершён'
                : '';
    const genres = (anime.genres || []).slice(0, 2).map((g) => g.name).join(', ');

    card.innerHTML = `
        <div class="jikan-card-poster">
            <img src="${imgUrl}" alt="" decoding="async" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none'">
            <div class="jikan-card-poster-hover" aria-hidden="true">
                <button type="button" class="jikan-card-go-btn">Перейти</button>
            </div>
            ${score !== '—' ? `<div class="jikan-card-score">${score}</div>` : ''}
            ${status ? `<div class="jikan-card-status">${status}</div>` : ''}
        </div>
        <div class="jikan-card-info">
            <div class="jikan-card-title"></div>
            <div class="jikan-card-meta">
                ${epLine ? `<span class="jikan-card-ep">${epLine}</span>` : ''}
                ${genres ? `<span>${genres}</span>` : ''}
            </div>
        </div>
    `;

    const titleEl = card.querySelector('.jikan-card-title');
    if (titleEl) {
        titleEl.textContent = titleEn;
        titleEl.setAttribute('title', titleEn);
    }
    const posterImg = card.querySelector('.jikan-card-poster img');
    if (posterImg) {
        posterImg.alt = titleEn || 'Постер аниме';
    }

    const goJikan = () => {
        const virtualId = 10000000 + (anime.mal_id || 0);
        try {
            sessionStorage.setItem('jikanAnimeData', JSON.stringify(anime));
        } catch (_) {
            /* ignore */
        }
        if (typeof openAnimePage === 'function') {
            openAnimePage(virtualId);
        } else {
            try {
                sessionStorage.setItem('previousUrl', window.location.href);
                sessionStorage.setItem('viewAnimeId', String(virtualId));
            } catch (_) {
                /* ignore */
            }
            window.location.href = `anime/view.html?id=${virtualId}`;
        }
    };

    card.addEventListener('click', goJikan);
    card.querySelector('.jikan-card-go-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        goJikan();
    });

    return card;
}

const HOME_SHIKI_PREFETCH = 10;

function applyShikiPatchToCards(container, anime, sh) {
    if (typeof patchJikanVirtualShiki === 'function') patchJikanVirtualShiki(anime.mal_id, sh);
    const epText =
        sh && window.shikimoriApi && window.shikimoriApi.formatAiredTotal
            ? window.shikimoriApi.formatAiredTotal(anime, sh)
            : '';
    container.querySelectorAll(`[data-mal-id="${anime.mal_id}"]`).forEach((c) => {
        const t = c.querySelector('.jikan-card-title');
        const ep = c.querySelector('.jikan-card-ep');
        if (sh && sh.russian && t) {
            t.textContent = sh.russian;
            t.setAttribute('title', sh.russian);
        }
        if (ep && epText) ep.textContent = epText;
    });
}

function scheduleShikiForAnime(container, anime) {
    if (!window.shikimoriApi) return;
    const searchTitle = anime.title_english || anime.title || '';
    window.shikimoriApi.enqueueFetchShikimoriByMalId(anime.mal_id, searchTitle).then((sh) => {
        applyShikiPatchToCards(container, anime, sh);
    });
}

function applyShikimoriToStrip(container, originalList) {
    if (!window.shikimoriApi || typeof patchJikanVirtualShiki !== 'function') return;

    const unique = [];
    const seen = new Set();
    for (const anime of originalList) {
        if (!anime.mal_id || seen.has(anime.mal_id)) continue;
        seen.add(anime.mal_id);
        unique.push(anime);
    }

    const prefetch = unique.slice(0, HOME_SHIKI_PREFETCH);
    prefetch.forEach((anime) => scheduleShikiForAnime(container, anime));

    const rest = unique.slice(HOME_SHIKI_PREFETCH);
    if (rest.length === 0) return;

    const loaded = new Set(prefetch.map((a) => a.mal_id));
    if (typeof IntersectionObserver === 'undefined') {
        rest.forEach((anime) => scheduleShikiForAnime(container, anime));
        return;
    }

    const io = new IntersectionObserver(
        (entries) => {
            entries.forEach((ent) => {
                if (!ent.isIntersecting) return;
                const card = ent.target;
                const malId = parseInt(card.dataset.malId, 10);
                io.unobserve(card);
                if (!malId || loaded.has(malId)) return;
                loaded.add(malId);
                const anime = unique.find((a) => a.mal_id === malId);
                if (anime) scheduleShikiForAnime(container, anime);
            });
        },
        { root: container, rootMargin: '140px', threshold: 0.02 }
    );

    container.querySelectorAll('.jikan-card').forEach((card) => {
        const malId = parseInt(card.dataset.malId, 10);
        if (malId && !loaded.has(malId)) io.observe(card);
    });
}

function renderJikanCards(containerId, animeList) {
    const container = document.getElementById(containerId);
    if (!container) return;
    teardownHomeHorizontalScroll(container);
    container.innerHTML = '';

    if (!animeList || animeList.length === 0) {
        container.innerHTML = '<div class="home-loading-placeholder">Нет данных</div>';
        return;
    }

    if (typeof registerJikanHomeList === 'function') {
        registerJikanHomeList(animeList);
    }

    let displayList = animeList;
    if (typeof filterJikanItemsRestricted === 'function') {
        displayList = filterJikanItemsRestricted(animeList);
    }
    if (!displayList || displayList.length === 0) {
        container.innerHTML = '<div class="home-loading-placeholder">Нет данных</div>';
        return;
    }

    const tripled = [...displayList, ...displayList, ...displayList];
    tripled.forEach((anime) => {
        container.appendChild(createJikanCard(anime));
    });

    requestAnimationFrame(() => {
        const sw = container.scrollWidth || 0;
        const W = Math.max(1, sw / 3);
        container._infiniteSetWidth = W;
        container.scrollLeft = W;
        enhanceHomeHorizontalScroll(container);
        applyShikimoriToStrip(container, displayList);
    });
}

async function loadSeasonAnime() {
    const cache = getHomeCache();
    if (cache && cache.season) {
        renderJikanCards('seasonAnimeGrid', cache.season);
        return;
    }

    try {
        const list = await jikanFetchPaged('/seasons/now?limit=25&order_by=score&sort=desc', 48);
        setHomeCache('season', list);
        renderJikanCards('seasonAnimeGrid', list);
    } catch (e) {
        console.warn('[Home] Season load error:', e);
        const el = document.getElementById('seasonAnimeGrid');
        if (el) el.innerHTML = '<div class="home-loading-placeholder">Не удалось загрузить</div>';
    }
}

async function loadUpcomingAnime() {
    const cache = getHomeCache();
    if (cache && cache.upcoming) {
        renderJikanCards('upcomingAnimeGrid', cache.upcoming);
        return;
    }

    try {
        const u = await jikanFetchPaged('/seasons/upcoming?limit=25&order_by=members&sort=desc', 32);
        await new Promise((r) => setTimeout(r, 900));
        const t = await jikanFetchPaged('/top/anime?filter=upcoming&limit=25', 32);
        const list = dedupeMal([...u, ...t]);
        setHomeCache('upcoming', list);
        renderJikanCards('upcomingAnimeGrid', list);
    } catch (e) {
        console.warn('[Home] Upcoming load error:', e);
        const el = document.getElementById('upcomingAnimeGrid');
        if (el) el.innerHTML = '<div class="home-loading-placeholder">Не удалось загрузить</div>';
    }
}

// ==================== Локальные секции ====================

function loadTopRated() {
    const container = document.getElementById('topRatedGrid');
    if (!container) return;

    const all = animeDatabase.all;
    if (!all || all.length === 0) {
        container.innerHTML = '<div class="home-loading-placeholder">Каталог пуст</div>';
        return;
    }

    let sorted = all.slice().sort((a, b) => (b.rating || 0) - (a.rating || 0));
    if (typeof filterAdultAnimeList === 'function') {
        sorted = filterAdultAnimeList(sorted);
    }
    const top15 = sorted.slice(0, 15);

    container.innerHTML = '';
    top15.forEach(anime => {
        const card = document.createElement('div');
        card.className = 'anime-card';
        card.dataset.id = anime.id;

        const gradient = typeof generateGradient === 'function' ? generateGradient(anime.id) : 'linear-gradient(135deg, #6c5ce7, #a29bfe)';
        const a = typeof initAnimeStats === 'function' ? initAnimeStats(anime) : anime;

        card.innerHTML = `
            <div class="anime-poster" style="background: ${gradient};">
                <div class="anime-year">${a.year || ''}</div>
                ${a.status ? `<div class="anime-status">${a.status}</div>` : ''}
            </div>
            <div class="anime-info">
                <h3 class="anime-title">${a.title}</h3>
                <div class="anime-meta">
                    <div class="anime-rating">${a.rating || 0}</div>
                    ${a.episodes ? `<div class="anime-episodes">${a.episodes} эп.</div>` : ''}
                </div>
                ${a.studio ? `<div class="anime-studio">${a.studio}</div>` : ''}
                ${a.genres ? `<div class="anime-genres">${a.genres.slice(0, 2).join(', ')}</div>` : ''}
            </div>
        `;

        card.onclick = () => {
            if (typeof openAnimePage === 'function') {
                openAnimePage(a.id);
            } else {
                sessionStorage.setItem('viewAnimeId', String(a.id));
                window.location.href = `anime/view.html?id=${a.id}`;
            }
        };

        if (typeof loadAnimePosterLazy === 'function') {
            const titles = a.titleAlt ? [a.titleAlt, a.title] : a.title;
            loadAnimePosterLazy(card, titles, gradient);
        }

        container.appendChild(card);
    });
}

async function loadFriendsWatching() {
    const section = document.getElementById('friendsWatchingSection');
    const grid = document.getElementById('friendsWatchingGrid');
    if (!section || !grid || !supabaseClient) return;

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session?.user) return;
        const userId = session.user.id;

        if (typeof window.friendsService === 'undefined') return;

        const friends = await window.friendsService.getFriends(userId);
        if (!friends || friends.length === 0) return;

        const friendIds = friends
            .map(f => f.friend?.id || f.friendUserId || f.id)
            .filter(Boolean);
        const { data: profiles } = await supabaseClient
            .from('profiles')
            .select('id, username, avatar, current_activity')
            .in('id', friendIds);

        if (!profiles) return;

        const watchingAnimeIds = new Set();
        const cards = [];

        for (const p of profiles) {
            if (p.current_activity && p.current_activity.type === 'watching' && p.current_activity.animeId) {
                const aId = parseInt(p.current_activity.animeId);
                if (!watchingAnimeIds.has(aId)) {
                    watchingAnimeIds.add(aId);
                    const anime = typeof getAnimeById === 'function' ? getAnimeById(aId) : null;
                    if (anime) {
                        cards.push({ anime, friend: p, live: true });
                    }
                }
            }
        }

        if (cards.length === 0) return;

        section.style.display = 'block';
        grid.innerHTML = '';

        for (const info of cards) {
            const card = createAnimeCard(info.anime);
            const badge = document.createElement('div');
            badge.style.cssText = 'font-size:0.72rem;color:#22c55e;display:flex;align-items:center;gap:0.3rem;margin-bottom:0.3rem;';
            badge.innerHTML = `<img src="${info.friend.avatar || 'Fons/seitFon.jpg'}" style="width:18px;height:18px;border-radius:50%;object-fit:cover;"> ${info.friend.username || ''} смотрит`;
            const infoEl = card.querySelector('.anime-info');
            if (infoEl) infoEl.prepend(badge);
            grid.appendChild(card);
        }
    } catch (e) {
        console.warn('[Home] Friends watching error:', e);
    }
}
