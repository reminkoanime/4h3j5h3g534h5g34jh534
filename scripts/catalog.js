// Каталог аниме - полнофункциональный

let currentPage = 1;
const itemsPerPage = 24;
let allResults = [];

// Переход на страницу
function goToPage(page) {
    currentPage = page;
    displayResults(allResults);
    updatePagination(allResults.length);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Глобальная функция для пагинации (доступна из HTML)
window.goToPage = goToPage;

document.addEventListener('DOMContentLoaded', () => {
    const urlFilter = new URLSearchParams(window.location.search).get('filter');
    if (urlFilter === 'season' || urlFilter === 'upcoming') {
        const u = document.getElementById('catalogUserAddAnimeWrap');
        if (u) u.style.display = 'none';
        loadJikanCatalogPage(urlFilter);
        return;
    }
    loadGenres();
});

function catalogUserEscapeHtml(t) {
    if (t == null) return '';
    const d = document.createElement('div');
    d.textContent = String(t);
    return d.innerHTML;
}

function catalogUserDisplayTitle(j) {
    if (!j) return '—';
    return (
        (j.title_english && String(j.title_english).trim()) ||
        (j.title && String(j.title).trim()) ||
        `MAL #${j.mal_id || '?'}`
    );
}

let _catalogUserAddBusy = false;

/**
 * Поиск Jikan для блока «добавить в каталог».
 * Обработчики вешаем на document (делегирование): после apply-navigation разметка main пересоздаётся через innerHTML, прямые addEventListener с кнопки слетают.
 */
async function runCatalogUserAddSearch() {
    const input = document.getElementById('catalogUserAddSearch');
    const btn = document.getElementById('catalogUserAddSearchBtn');
    const box = document.getElementById('catalogUserAddResults');
    const status = document.getElementById('catalogUserAddStatus');
    if (!input || !btn || !box) return;

    const setStatus = (text, kind) => {
        if (!status) return;
        status.textContent = text || '';
        status.classList.remove('is-error', 'is-ok');
        if (kind === 'err') status.classList.add('is-error');
        if (kind === 'ok') status.classList.add('is-ok');
    };

    const q = input.value.trim();
    if (!q) {
        setStatus('Введите название на английском.', 'err');
        return;
    }
    if (typeof window.jikanSearchAnimeMany !== 'function') {
        setStatus('Поиск Jikan недоступен. Проверьте загрузку scripts/jikan-api.js.', 'err');
        return;
    }
    if (_catalogUserAddBusy) return;
    _catalogUserAddBusy = true;
    btn.disabled = true;
    setStatus('Запрос к Jikan…', '');
    box.innerHTML = '';
    try {
        let jList = await window.jikanSearchAnimeMany(q, 12);
        jList = jList || [];
        const adultOk =
            typeof window.isAdultContentEnabled === 'function' && window.isAdultContentEnabled();
        if (!adultOk && typeof window.jikanItemHasRestrictedGenre === 'function') {
            jList = jList.filter((j) => !window.jikanItemHasRestrictedGenre(j));
        }
        if (!jList.length) {
            setStatus('Ничего не найдено. Уточните английское название или подождите (лимит API).', 'err');
            return;
        }
        setStatus(`Найдено: ${jList.length}. Выберите тайтл и нажмите «В каталог».`, '');
        for (const j of jList) {
            if (!j || !j.mal_id) continue;
            const row = document.createElement('div');
            row.className = 'catalog-user-add-row-item';
            row.setAttribute('role', 'listitem');
            const poster = j.images?.jpg?.small_image_url || j.images?.jpg?.image_url || '';
            const title = catalogUserDisplayTitle(j);
            const year = j.year != null ? j.year : '—';
            const typ = j.type || '';
            row.innerHTML = `
                    <img src="${catalogUserEscapeHtml(poster)}" alt="" width="44" height="62" loading="lazy" referrerpolicy="no-referrer">
                    <div class="catalog-user-add-row-title">
                        ${catalogUserEscapeHtml(title)}
                        <div class="catalog-user-add-row-meta">${catalogUserEscapeHtml(typ)} · ${catalogUserEscapeHtml(
                String(year)
            )} · MAL ${j.mal_id}</div>
                    </div>
                    <button type="button" class="catalog-user-add-row-action" data-mal="${j.mal_id}">В каталог</button>`;
            const img = row.querySelector('img');
            if (img && !poster) img.style.visibility = 'hidden';
            if (img)
                img.addEventListener('error', () => {
                    img.style.visibility = 'hidden';
                });
            row.querySelector('button').addEventListener('click', async (ev) => {
                const b = ev.currentTarget;
                b.disabled = true;
                try {
                    let full = j;
                    if (typeof window.jikanFetchAnimeFullByMalId === 'function') {
                        const fd = await window.jikanFetchAnimeFullByMalId(j.mal_id);
                        if (fd) full = fd;
                    }
                    if (!full || !full.mal_id) {
                        setStatus('Не удалось загрузить карточку с MyAnimeList.', 'err');
                        b.disabled = false;
                        return;
                    }
                    if (typeof window.userAddAnimeToSiteCatalog !== 'function') {
                        setStatus('Функция каталога не загружена.', 'err');
                        b.disabled = false;
                        return;
                    }
                    const res = await window.userAddAnimeToSiteCatalog(full);
                    if (res.success) {
                        setStatus(res.message || 'Готово. Обновите фильтры или список.', 'ok');
                        if (typeof showSuccess === 'function') showSuccess(res.message || 'Добавлено');
                        b.textContent = 'Готово';
                    } else {
                        setStatus(res.message || 'Ошибка', 'err');
                        if (typeof showError === 'function') showError(res.message || 'Ошибка');
                        b.disabled = false;
                    }
                } catch (e) {
                    setStatus(e.message || 'Ошибка', 'err');
                    b.disabled = false;
                }
            });
            box.appendChild(row);
        }
    } catch (e) {
        setStatus('Ошибка или лимит Jikan — подождите минуту.', 'err');
    } finally {
        _catalogUserAddBusy = false;
        btn.disabled = false;
    }
}

(function bindCatalogUserAddDelegationOnce() {
    if (typeof document === 'undefined' || window.__reminkoCatalogUserAddDelegation) return;
    window.__reminkoCatalogUserAddDelegation = true;
    document.addEventListener(
        'click',
        (e) => {
            const btn = e.target && e.target.closest && e.target.closest('#catalogUserAddSearchBtn');
            if (!btn) return;
            e.preventDefault();
            void runCatalogUserAddSearch();
        },
        true
    );
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const t = e.target;
        if (!t || t.id !== 'catalogUserAddSearch') return;
        e.preventDefault();
        void runCatalogUserAddSearch();
    });
})();

async function loadJikanCatalogPage(mode) {
    const container = document.getElementById('catalogResults');
    const filtersArea = document.querySelector('.catalog-filters, .filters-container, .catalog-controls');
    const pagination = document.getElementById('catalogPagination') || document.querySelector('.pagination');
    const header = document.querySelector('.catalog-header h1, .catalog-title');

    if (filtersArea) filtersArea.style.display = 'none';
    if (pagination) pagination.style.display = 'none';
    if (header) {
        header.textContent = mode === 'season' ? 'Новинки сезона' : 'Скоро выходит';
    }
    if (container) container.innerHTML = '<div class="home-loading-placeholder" style="padding:2rem;text-align:center;">Загрузка из Jikan API...</div>';

    const JIKAN_BASE = 'https://api.jikan.moe/v4';
    const url = mode === 'season'
        ? `${JIKAN_BASE}/seasons/now?limit=25&order_by=score&sort=desc`
        : `${JIKAN_BASE}/seasons/upcoming?limit=25&order_by=members&sort=desc`;

    try {
        let page1 = await (await fetch(url)).json();
        let allAnime = page1.data || [];
        if (typeof filterJikanItemsRestricted === 'function') {
            allAnime = filterJikanItemsRestricted(allAnime);
        }

        if (container) {
            container.innerHTML = '';
            container.style.display = 'grid';
            container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(160px, 1fr))';
            container.style.gap = '1.2rem';

            allAnime.forEach(anime => {
                const card = _createJikanCatalogCard(anime);
                container.appendChild(card);
            });
        }
    } catch (e) {
        console.error('[Catalog] Jikan error:', e);
        if (container) container.innerHTML = '<div class="home-loading-placeholder">Не удалось загрузить данные. Попробуйте позже.</div>';
    }
}

function _createJikanCatalogCard(anime) {
    const card = document.createElement('div');
    card.className = 'jikan-card';
    card.style.cursor = 'pointer';

    const imgUrl = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || '';
    const score = anime.score ? anime.score.toFixed(1) : '—';
    const title = anime.title || anime.title_japanese || '—';
    const episodes = anime.episodes ? `${anime.episodes} эп.` : '';
    const status = anime.status === 'Currently Airing' ? 'В эфире' :
                   anime.status === 'Not yet aired' ? 'Анонс' :
                   anime.status === 'Finished Airing' ? 'Завершён' : '';
    const genres = (anime.genres || []).slice(0, 2).map(g => g.name).join(', ');

    card.innerHTML = `
        <div class="jikan-card-poster">
            <img src="${imgUrl}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none'">
            ${score !== '—' ? `<div class="jikan-card-score">${score}</div>` : ''}
            ${status ? `<div class="jikan-card-status">${status}</div>` : ''}
        </div>
        <div class="jikan-card-info">
            <div class="jikan-card-title" title="${title}">${title}</div>
            <div class="jikan-card-meta">
                ${episodes ? `<span>${episodes}</span>` : ''}
                ${genres ? `<span>${genres}</span>` : ''}
            </div>
        </div>
    `;

    const posterImg = card.querySelector('.jikan-card-poster img');
    if (posterImg) {
        posterImg.alt = title || 'Постер аниме';
    }

    card.addEventListener('click', () => {
        const virtualId = 10000000 + (anime.mal_id || 0);
        if (typeof openAnimePage === 'function') {
            openAnimePage(virtualId);
        } else {
            try {
                sessionStorage.setItem('jikanAnimeData', JSON.stringify(anime));
                sessionStorage.setItem('viewAnimeId', String(virtualId));
            } catch (_) {
                /* ignore */
            }
            window.location.href = `../anime/view.html?id=${virtualId}`;
        }
    });

    return card;
}

// Загрузка фильтров из URL
function loadFilters() {
    const params = getUrlParams();
    
    // Поиск
    const searchInput = document.getElementById('catalogSearch');
    if (searchInput && params.search) {
        searchInput.value = params.search;
    }
    
    // Жанры (чекбоксы)
    if (params.genre && Array.isArray(params.genre)) {
        params.genre.forEach(genre => {
            const checkbox = document.querySelector(`#filterGenrePanel input[value="${genre}"]`);
            if (checkbox) checkbox.checked = true;
        });
        updateFilterButtonText('filterGenreBtn', params.genre);
    }
    
    // Типы (чекбоксы)
    if (params.type && Array.isArray(params.type)) {
        params.type.forEach(type => {
            const checkbox = document.querySelector(`#filterTypePanel input[value="${type}"]`);
            if (checkbox) checkbox.checked = true;
        });
        updateFilterButtonText('filterTypeBtn', params.type);
    } else if (params.type) {
        const checkbox = document.querySelector(`#filterTypePanel input[value="${params.type}"]`);
        if (checkbox) checkbox.checked = true;
        updateFilterButtonText('filterTypeBtn', [params.type]);
    }
    
    // Статусы (чекбоксы)
    if (params.status && Array.isArray(params.status)) {
        params.status.forEach(status => {
            const checkbox = document.querySelector(`#filterStatusPanel input[value="${status}"]`);
            if (checkbox) checkbox.checked = true;
        });
        updateFilterButtonText('filterStatusBtn', params.status);
    } else if (params.status) {
        const checkbox = document.querySelector(`#filterStatusPanel input[value="${params.status}"]`);
        if (checkbox) checkbox.checked = true;
        updateFilterButtonText('filterStatusBtn', [params.status]);
    }
    
    // Год ОТ
    const yearFromRange = document.getElementById('filterYearFromRange');
    const yearFromSpan = document.getElementById('filterYearFrom');
    if (yearFromRange && params.yearFrom) {
        yearFromRange.value = params.yearFrom;
        if (yearFromSpan) yearFromSpan.textContent = params.yearFrom;
    }
    
    // Год ДО
    const yearToRange = document.getElementById('filterYearToRange');
    const yearToSpan = document.getElementById('filterYearTo');
    if (yearToRange && params.yearTo) {
        yearToRange.value = params.yearTo;
        if (yearToSpan) yearToSpan.textContent = params.yearTo;
    }
    
    // Сортировка
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect && params.sort) {
        sortSelect.value = params.sort;
    }
}

// Обновление текста кнопки фильтра
function updateFilterButtonText(btnId, values) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    
    const valueEl = btn.querySelector('.filter-chip-value');
    const defaultText = btnId.includes('Genre') ? 'Все' : btnId.includes('Type') ? 'Все' : 'Все';
    const displayText = values.length === 0 ? defaultText : values.length === 1 ? values[0] : `Выбрано: ${values.length}`;
    
    if (valueEl) {
        valueEl.textContent = displayText;
    } else {
        const svg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>';
        btn.innerHTML = (values.length === 0 ? (btnId.includes('Genre') ? 'Выберите жанр' : btnId.includes('Type') ? 'Выберите тип' : 'Выберите статус') : displayText) + ' ' + svg;
    }
}

/** ID тайтлов, которые всегда в начале списка каталога (сохраняется порядок) */
const CATALOG_PINNED_FIRST_IDS = [451];

function applyCatalogPinnedFirst(list) {
    if (!list || !list.length || !CATALOG_PINNED_FIRST_IDS.length) return list;
    const order = new Map(CATALOG_PINNED_FIRST_IDS.map((id, i) => [id, i]));
    const head = [];
    const tail = [];
    for (const a of list) {
        const id = parseInt(a.id, 10);
        if (order.has(id)) head.push(a);
        else tail.push(a);
    }
    head.sort(
        (a, b) =>
            order.get(parseInt(a.id, 10)) - order.get(parseInt(b.id, 10))
    );
    return head.concat(tail);
}

// Применение фильтров
let isApplyingFilters = false; // Флаг для предотвращения множественных вызовов
function applyFilters(smoothScroll = true) {
    // Предотвращаем множественные одновременные вызовы
    if (isApplyingFilters) {
        console.log('[Catalog] Фильтры уже применяются, пропускаем вызов');
        return;
    }
    
    isApplyingFilters = true;
    const filters = getFilters();
    
    // Показываем индикатор загрузки
    showLoadingIndicator();
    
    // Используем setTimeout для предотвращения прыжков страницы
    setTimeout(() => {
        try {
            // Фильтрация
            let results = filterAnime(filters);
            
            // Сортировка
            results = sortAnime(results, filters.sort || 'rating-desc');
            results = applyCatalogPinnedFirst(results);

            // Дополнительная проверка на дубликаты по ID
            const seenIds = new Map();
            const uniqueResults = [];
            for (const anime of results) {
                const id = parseInt(anime.id);
                if (!seenIds.has(id)) {
                    seenIds.set(id, true);
                    uniqueResults.push(anime);
                }
            }
            
            allResults = uniqueResults;
            currentPage = 1;
            
            displayResults(uniqueResults);
            updatePagination(uniqueResults.length);
            updateFiltersInUrl(filters);
            
            // Плавная прокрутка вверх при изменении фильтров
            if (smoothScroll) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } catch (error) {
            console.error('[Catalog] Ошибка применения фильтров:', error);
        } finally {
            // Скрываем индикатор загрузки
            hideLoadingIndicator();
            isApplyingFilters = false;
        }
    }, 100);
}

// Получение значений фильтров из формы
function getFilters() {
    const searchInput = document.getElementById('catalogSearch');
    const sortSelect = document.getElementById('sortSelect');
    
    // Получаем жанры из чекбоксов (можно несколько)
    const genreCheckboxes = document.querySelectorAll('#filterGenrePanel input[type="checkbox"]:checked');
    const genre = Array.from(genreCheckboxes).map(cb => cb.value);
    
    // Получаем типы из чекбоксов
    const typeCheckboxes = document.querySelectorAll('#filterTypePanel input[type="checkbox"]:checked');
    const type = Array.from(typeCheckboxes).map(cb => cb.value);
    
    // Получаем статусы из чекбоксов
    const statusCheckboxes = document.querySelectorAll('#filterStatusPanel input[type="checkbox"]:checked');
    const status = Array.from(statusCheckboxes).map(cb => cb.value);
    
    // Получаем год ОТ и ДО
    const yearFromRange = document.getElementById('filterYearFromRange');
    const yearToRange = document.getElementById('filterYearToRange');
    const yearFrom = yearFromRange ? parseInt(yearFromRange.value) : null;
    const yearTo = yearToRange ? parseInt(yearToRange.value) : null;
    
    return {
        search: searchInput ? searchInput.value.trim() : '',
        genre: genre,
        type: type,
        status: status,
        yearFrom: yearFrom,
        yearTo: yearTo,
        ratingMin: null, // Убрали рейтинг
        sort: sortSelect ? sortSelect.value : 'rating-desc'
    };
}

const CATALOG_SHIKI_PREFETCH = 14;

function applyCatalogShikiToCard(anime, sh) {
    if (!anime || anime.mal_id == null) return;
    if (typeof patchJikanVirtualShiki === 'function') patchJikanVirtualShiki(anime.mal_id, sh);
    if (typeof patchSiteCatalogJikanShiki === 'function') patchSiteCatalogJikanShiki(anime.mal_id, sh);
    const id = String(anime.id);
    const card = document.querySelector(`#catalogResults .anime-card[data-id="${id}"]`);
    if (!card) return;
    const h = card.querySelector('.anime-title');
    if (sh && sh.russian && h) {
        h.textContent = sh.russian;
        h.setAttribute('title', sh.russian);
    }
}

function scheduleCatalogShikimoriForPage(container, pageItems) {
    if (!window.shikimoriApi || typeof window.shikimoriApi.enqueueFetchShikimoriByMalId !== 'function') {
        return;
    }
    const jikanKeyed = [];
    const seenMal = new Set();
    for (const a of pageItems) {
        if (!a || a.isJikanVirtual !== true || !a.mal_id || !a._jikanRaw) continue;
        if (seenMal.has(a.mal_id)) continue;
        seenMal.add(a.mal_id);
        jikanKeyed.push(a);
    }
    if (jikanKeyed.length === 0) return;

    const prefetch = jikanKeyed.slice(0, CATALOG_SHIKI_PREFETCH);
    prefetch.forEach((anime) => {
        const t = anime.titleAlt || anime.title || '';
        window.shikimoriApi.enqueueFetchShikimoriByMalId(anime.mal_id, t).then((sh) => {
            applyCatalogShikiToCard(anime, sh);
        });
    });

    const rest = jikanKeyed.slice(CATALOG_SHIKI_PREFETCH);
    if (rest.length === 0) return;

    const loaded = new Set(prefetch.map((x) => x.mal_id));
    if (typeof IntersectionObserver === 'undefined') {
        rest.forEach((anime) => {
            const t = anime.titleAlt || anime.title || '';
            window.shikimoriApi.enqueueFetchShikimoriByMalId(anime.mal_id, t).then((sh) => {
                applyCatalogShikiToCard(anime, sh);
            });
        });
        return;
    }

    const io = new IntersectionObserver(
        (entries) => {
            entries.forEach((ent) => {
                if (!ent.isIntersecting) return;
                const cardEl = ent.target;
                const mid = parseInt(cardEl.dataset.malId, 10);
                io.unobserve(cardEl);
                if (!mid || loaded.has(mid)) return;
                loaded.add(mid);
                const anime = jikanKeyed.find((x) => x.mal_id === mid);
                if (!anime) return;
                const t = anime.titleAlt || anime.title || '';
                window.shikimoriApi.enqueueFetchShikimoriByMalId(anime.mal_id, t).then((sh) => {
                    applyCatalogShikiToCard(anime, sh);
                });
            });
        },
        { root: null, rootMargin: '140px', threshold: 0.02 }
    );

    container.querySelectorAll('.anime-card[data-mal-id]').forEach((c) => {
        const mid = parseInt(c.dataset.malId, 10);
        if (mid && !loaded.has(mid)) io.observe(c);
    });
}

// Отображение результатов
function displayResults(results) {
    const container = document.getElementById('catalogResults');
    if (!container) {
        return;
    }

    container.innerHTML = '';

    try {
        // Удаляем дубликаты по ID перед отображением (дополнительная защита)
        const seenIds = new Map();
        const uniqueResults = [];
        for (const anime of results) {
            const id = parseInt(anime.id);
            if (!seenIds.has(id)) {
                seenIds.set(id, true);
                uniqueResults.push(anime);
            }
        }
        
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const pageResults = uniqueResults.slice(start, end);
        
        if (pageResults.length === 0) {
            container.innerHTML = `
                <div class="page-placeholder">
                    <h2>Ничего не найдено</h2>
                    <p>Попробуйте изменить параметры поиска или фильтры.</p>
                </div>
            `;
            const resultsInfoEmpty = document.getElementById('resultsInfo');
            if (resultsInfoEmpty) {
                resultsInfoEmpty.textContent = `Найдено: ${uniqueResults.length} аниме (страница ${currentPage} из ${Math.max(1, Math.ceil(uniqueResults.length / itemsPerPage))})`;
            }
            return;
        }
        
        // Удаляем дубликаты по ID еще раз на уровне страницы (на всякий случай)
        const pageSeenIds = new Set();
        const uniquePageResults = [];
        for (const anime of pageResults) {
            const id = parseInt(anime.id);
            if (!pageSeenIds.has(id)) {
                pageSeenIds.add(id);
                uniquePageResults.push(anime);
            }
        }
        
        const items = uniquePageResults.map(anime => {
            if (typeof initAnimeStats === 'function') return initAnimeStats(anime);
            return anime;
        });
        
        // Финальная проверка на дубликаты перед отображением
        const finalSeenIds = new Set();
        const finalUniqueItems = [];
        for (const item of items) {
            const id = parseInt(item.id);
            if (!finalSeenIds.has(id)) {
                finalSeenIds.add(id);
                finalUniqueItems.push(item);
            }
        }
        
        finalUniqueItems.forEach((anime) => container.appendChild(createAnimeCard(anime)));
        scheduleCatalogShikimoriForPage(container, finalUniqueItems);

        const resultsInfo = document.getElementById('resultsInfo');
        if (resultsInfo) {
            const totalPages = Math.max(1, Math.ceil(uniqueResults.length / itemsPerPage));
            resultsInfo.textContent = `Найдено: ${uniqueResults.length} аниме (страница ${currentPage} из ${totalPages})`;
        }
    } catch (error) {
        console.error('[Catalog] Ошибка отображения результатов:', error);
    }
}

// Обновление пагинации
function updatePagination(totalItems) {
    const pagination = document.getElementById('pagination');
    if (!pagination) return;
    
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    let html = '';
    
    // Кнопка "Назад"
    html += `<button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})">← Назад</button>`;
    
    // Номера страниц
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            html += `<span class="pagination-dots">...</span>`;
        }
    }
    
    // Кнопка "Вперёд"
    html += `<button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})">Вперёд →</button>`;
    
    pagination.innerHTML = html;
}

// Показать индикатор загрузки
function showLoadingIndicator() {
    const container = document.getElementById('catalogResults');
    if (container) {
        container.style.opacity = '0.5';
        container.style.pointerEvents = 'none';
    }
}

// Скрыть индикатор загрузки
function hideLoadingIndicator() {
    const container = document.getElementById('catalogResults');
    if (container) {
        container.style.opacity = '1';
        container.style.pointerEvents = 'auto';
    }
}

// Инициализация событий фильтров
function initFilterEvents() {
    // Кнопка "ПОИСК"
    const applyBtn = document.getElementById('applyFilters');
    if (applyBtn) {
        applyBtn.addEventListener('click', () => applyFilters(true));
    }
    
    // Кнопка сброса
    const resetBtn = document.getElementById('resetFilters');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetFilters);
    }
    
    // Слайдер года ОТ
    const yearFromRange = document.getElementById('filterYearFromRange');
    const yearFromSpan = document.getElementById('filterYearFrom');
    if (yearFromRange && yearFromSpan) {
        yearFromRange.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            yearFromSpan.textContent = value;
            // Проверяем, чтобы ОТ не был больше ДО
            const yearToRange = document.getElementById('filterYearToRange');
            if (yearToRange && value > parseInt(yearToRange.value)) {
                yearToRange.value = value;
                document.getElementById('filterYearTo').textContent = value;
            }
        });
    }
    
    // Слайдер года ДО
    const yearToRange = document.getElementById('filterYearToRange');
    const yearToSpan = document.getElementById('filterYearTo');
    if (yearToRange && yearToSpan) {
        yearToRange.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            yearToSpan.textContent = value;
            // Проверяем, чтобы ДО не был меньше ОТ
            const yearFromRange = document.getElementById('filterYearFromRange');
            if (yearFromRange && value < parseInt(yearFromRange.value)) {
                yearFromRange.value = value;
                document.getElementById('filterYearFrom').textContent = value;
            }
        });
    }
    
    // Кнопки открытия панелей фильтров
    ['filterTypeBtn', 'filterGenreBtn', 'filterStatusBtn'].forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const panelId = btn.dataset.target;
                const panel = document.getElementById(panelId);
                const isActive = panel.classList.contains('active');
                
                // Закрываем все панели
                document.querySelectorAll('.filter-select-panel').forEach(p => p.classList.remove('active'));
                document.querySelectorAll('.filter-select-btn').forEach(b => b.classList.remove('active'));
                
                // Открываем нужную панель
                if (!isActive) {
                    panel.classList.add('active');
                    btn.classList.add('active');
                }
            });
        }
    });
    
    // Закрытие панелей при клике вне
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.filter-chip-wrap') && !e.target.closest('.filter-multi-select')) {
            document.querySelectorAll('.filter-select-panel').forEach(p => p.classList.remove('active'));
            document.querySelectorAll('.filter-select-btn').forEach(b => b.classList.remove('active'));
        }
    });
    
    // Обновление текста кнопок при изменении чекбоксов
    ['filterTypePanel', 'filterGenrePanel', 'filterStatusPanel'].forEach(panelId => {
        const panel = document.getElementById(panelId);
        if (panel) {
            panel.addEventListener('change', (e) => {
                if (e.target.type === 'checkbox') {
                    const btnId = panelId.replace('Panel', 'Btn');
                    const checked = panel.querySelectorAll('input[type="checkbox"]:checked');
                    const values = Array.from(checked).map(cb => cb.value);
                    updateFilterButtonText(btnId, values);
                }
            });
        }
    });
    
    // Поиск - автоприменение при вводе
    const searchInput = document.getElementById('catalogSearch');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => applyFilters(false), 500);
        });
    }
}

// Сброс фильтров
function resetFilters(e) {
    if (e) e.preventDefault();
    
    // Очищаем все поля формы
    const searchInput = document.getElementById('catalogSearch');
    if (searchInput) searchInput.value = '';
    
    // Сброс чекбоксов типов
    document.querySelectorAll('#filterTypePanel input[type="checkbox"]').forEach(cb => cb.checked = false);
    updateFilterButtonText('filterTypeBtn', []);
    
    // Сброс чекбоксов жанров
    document.querySelectorAll('#filterGenrePanel input[type="checkbox"]').forEach(cb => cb.checked = false);
    updateFilterButtonText('filterGenreBtn', []);
    
    // Сброс чекбоксов статусов
    document.querySelectorAll('#filterStatusPanel input[type="checkbox"]').forEach(cb => cb.checked = false);
    updateFilterButtonText('filterStatusBtn', []);
    
    // Сброс слайдера года ОТ
    const yearFromRange = document.getElementById('filterYearFromRange');
    const yearFromSpan = document.getElementById('filterYearFrom');
    if (yearFromRange) {
        yearFromRange.value = yearFromRange.min || '1990';
        if (yearFromSpan) yearFromSpan.textContent = yearFromRange.value;
    }
    
    // Сброс слайдера года ДО
    const yearToRange = document.getElementById('filterYearToRange');
    const yearToSpan = document.getElementById('filterYearTo');
    if (yearToRange) {
        yearToRange.value = yearToRange.max || '2026';
        if (yearToSpan) yearToSpan.textContent = yearToRange.value;
    }
    
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) sortSelect.value = 'rating-desc';
    
    // Очистка URL
    const url = new URL(window.location);
    url.search = '';
    window.history.pushState({}, '', url);
    
    // Применяем пустые фильтры
    applyFilters();
}

// Обновление фильтров в URL
function updateFiltersInUrl(filters) {
    const params = {};
    if (filters.search) params.search = filters.search;
    if (filters.genre.length > 0) params.genre = filters.genre;
    if (filters.type.length > 0) params.type = filters.type;
    if (filters.status.length > 0) params.status = filters.status;
    if (filters.yearFrom) params.yearFrom = filters.yearFrom;
    if (filters.yearTo) params.yearTo = filters.yearTo;
    if (filters.sort) params.sort = filters.sort;
    
    setUrlParams(params);
}

function escGenreAttr(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
}

function bindGenreAdultPanelOnce() {
    const panel = document.getElementById('filterGenrePanel');
    if (!panel || panel.dataset.adultGenreBound === '1') return;
    panel.dataset.adultGenreBound = '1';
    panel.addEventListener('click', (e) => {
        const row = e.target.closest('.genre-adult-locked');
        if (!row) return;
        if (typeof isAdultContentEnabled === 'function' && isAdultContentEnabled()) return;
        e.preventDefault();
        e.stopPropagation();
        if (typeof openAdultUnlockModal === 'function') openAdultUnlockModal();
    });
}

// Загрузка жанров в фильтры
function loadGenres() {
    const panel = document.getElementById('filterGenrePanel');
    if (!panel) return;

    const container = panel.querySelector('.filter-dropdown-inner, .filter-genres-grid') || panel;
    const adultLabels =
        (typeof window.reminkoAdultGenreLabels !== 'undefined' && window.reminkoAdultGenreLabels) || [
            'Хентай',
            'Эротика'
        ];
    const genres = getAllGenres().filter((g) => !adultLabels.includes(g));
    const unlocked = typeof isAdultContentEnabled === 'function' && isAdultContentEnabled();

    const normalHtml = genres
        .map((genre) => {
            const v = escGenreAttr(genre);
            return `
        <label class="filter-option filter-checkbox-item">
            <input type="checkbox" value="${v}" id="genre_${genre.replace(/\s+/g, '_')}">
            <span>${genre}</span>
        </label>`;
        })
        .join('');

    const adultHtml = adultLabels
        .map((genre) => {
            const v = escGenreAttr(genre);
            const id = `genre_${genre.replace(/\s+/g, '_')}`;
            if (unlocked) {
                return `
        <label class="filter-option filter-checkbox-item genre-adult-row" data-adult-genre="1">
            <input type="checkbox" value="${v}" id="${id}">
            <span>${genre}</span>
        </label>`;
            }
            return `
        <label class="filter-option filter-checkbox-item genre-adult-row genre-adult-locked" data-adult-genre="1">
            <input type="checkbox" value="${v}" id="${id}" disabled aria-disabled="true">
            <span>${genre}</span>
            <span class="genre-adult-lock" title="Включите отображение жанров 18+ в настройках профиля">🔒</span>
        </label>`;
        })
        .join('');

    container.innerHTML = normalHtml + adultHtml;

    bindGenreAdultPanelOnce();

    // После загрузки жанров применяем фильтры из URL и инициализируем события
    loadFilters();
    initFilterEvents();
    // Применяем фильтры после загрузки (с небольшой задержкой, чтобы все элементы были готовы)
    setTimeout(() => {
        applyFilters(false);
    }, 100);
}

window.addEventListener('reminko-adult-changed', () => {
    if (document.getElementById('filterGenrePanel') && typeof loadGenres === 'function') {
        loadGenres();
    }
});

window.addEventListener('reminko-site-catalog-jikan-loaded', () => {
    if (document.getElementById('catalogResults') && typeof applyFilters === 'function') {
        applyFilters(false);
    }
});
