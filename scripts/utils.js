// Общие функции для работы с аниме

/**
 * Путь к статике сайта (аватары Fons/...) с корня домена.
 * Убирает 404 вида /catalog/Fons/... при относительных путях на вложенных страницах.
 */
function reminkoResolveAssetUrl(url) {
    if (url == null || url === '') return '/Fons/1 b.jpg';
    const s = String(url).trim();
    if (/^https?:\/\//i.test(s) || s.startsWith('data:') || s.startsWith('blob:')) return s;
    if (s.startsWith('/')) return s;
    return '/' + s.replace(/^\.\//, '').replace(/^\/+/, '');
}
window.reminkoResolveAssetUrl = reminkoResolveAssetUrl;

// Генерация градиента для постера
function generateGradient(id) {
    const hue1 = (id * 137.508) % 360; // Золотой угол для распределения цветов
    const hue2 = (hue1 + 60) % 360;
    return `linear-gradient(135deg, 
        hsl(${hue1}, 70%, 50%), 
        hsl(${hue2}, 70%, 60%))`;
}

// Создание карточки аниме
function createAnimeCard(anime, clickHandler) {
    const card = document.createElement('div');
    card.className = 'anime-card';
    card.dataset.id = anime.id;
    if (anime.mal_id != null && anime.mal_id !== '') {
        card.dataset.malId = String(anime.mal_id);
    }
    
    // Получаем статистику если функция доступна (виртуальные тайтлы с главной — без локальной статистики)
    let stats = anime;
    if (!anime.isJikanVirtual && typeof getAnimeStats === 'function') {
        const animeStats = getAnimeStats(anime.id);
        if (animeStats) {
            stats = { ...anime, ...animeStats };
        } else if (typeof initAnimeStats === 'function') {
            stats = initAnimeStats(anime);
        }
    }
    
    const gradient = generateGradient(anime.id);
    const posterUrl = stats.posterUrl || anime.posterUrl || null;
    const posterSafe = posterUrl ? String(posterUrl).replace(/'/g, "\\'") : '';

    // Постер: только url() — иначе градиент сверху перекрывал картинку
    const posterStyle = posterSafe
        ? `background-image:url('${posterSafe}');background-size:cover;background-position:center;`
        : `background:${gradient};`;
    
    card.innerHTML = `
        <div class="anime-poster" style="${posterStyle}">
            <div class="anime-poster-hover" aria-hidden="true">
                <button type="button" class="anime-poster-go-btn">Перейти</button>
            </div>
            <div class="anime-year">${stats.year}</div>
            ${stats.status ? `<div class="anime-status">${stats.status}</div>` : ''}
        </div>
        <div class="anime-info">
            <h3 class="anime-title">${stats.title}</h3>
            <div class="anime-meta">
                <div class="anime-rating">
                    ⭐ ${stats.rating || anime.rating || 0}
                    ${stats.ratingCount ? `<span class="rating-count">(${formatNumber(stats.ratingCount)})</span>` : ''}
                </div>
                ${stats.episodes ? `<div class="anime-episodes">${stats.episodes}</div>` : ''}
                ${stats.duration ? `<div class="anime-episodes">${stats.duration}</div>` : ''}
            </div>
            <div class="anime-stats">
                ${stats.views ? `<span class="stat-item">👁 ${formatNumber(stats.views)}</span>` : ''}
                ${stats.favoritesCount ? `<span class="stat-item">❤️ ${formatNumber(stats.favoritesCount)}</span>` : ''}
            </div>
            ${stats.genres ? `<div class="anime-genres">${stats.genres.slice(0, 2).join(', ')}</div>` : ''}
        </div>
    `;

    const navigateAnimeCard = () => {
        if (clickHandler) {
            clickHandler(anime);
            return;
        }
        if (anime.isJikanVirtual && anime._jikanRaw) {
            try {
                sessionStorage.setItem('jikanAnimeData', JSON.stringify(anime._jikanRaw));
            } catch (_) {
                /* ignore */
            }
        }
        if (typeof openAnimePage === 'function') {
            openAnimePage(anime.id);
        } else {
            sessionStorage.setItem('viewAnimeId', String(anime.id));
            sessionStorage.setItem('previousUrl', window.location.href);
            const path =
                window.location.pathname.includes('/catalog/') ||
                window.location.pathname.includes('/anime/') ||
                window.location.pathname.includes('/manga/')
                    ? '../anime/view.html'
                    : 'anime/view.html';
            window.location.href = `${path}?id=${encodeURIComponent(String(anime.id))}`;
        }
    };

    card.addEventListener('click', navigateAnimeCard);
    const goBtn = card.querySelector('.anime-poster-go-btn');
    if (goBtn) {
        goBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            navigateAnimeCard();
        });
    }

    // Загружаем постер из API с lazy loading, если его еще нет
    if (!posterUrl && !anime.isJikanVirtual && typeof getAnimePoster === 'function' && stats.title) {
        // Пробуем оба названия (сначала titleAlt для API, потом title)
        const searchTitles = stats.titleAlt ? [stats.titleAlt, stats.title] : stats.title;
        card.dataset.posterDisplayTitle = stats.title;
        loadAnimePosterLazy(card, searchTitles, gradient);
    }
    
    return card;
}

// Lazy loading для постеров аниме и других изображений
let posterObserver = null;
let imageObserver = null;

// Инициализация Intersection Observer для lazy loading постеров
function initPosterObserver() {
    if (posterObserver) return;
    
    // Создаем Observer только если он поддерживается
    if ('IntersectionObserver' in window) {
        posterObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const card = entry.target.closest('.anime-card, .manga-card');
                    if (card && card.dataset.posterNeedsLoad) {
                        let title = card.dataset.posterTitle;
                        // Парсим JSON если это массив
                        try {
                            title = JSON.parse(title);
                        } catch (e) {
                            // Не массив, оставляем как строку
                        }
                        const gradient = card.dataset.posterGradient || '';
                        
                        // Загружаем постер
                        loadAnimePosterAsync(card, title, gradient);
                        
                        // Удаляем из наблюдения
                        posterObserver.unobserve(entry.target);
                        delete card.dataset.posterNeedsLoad;
                    }
                }
            });
        }, {
            rootMargin: '600px'
        });
    }
}

// Инициализация Intersection Observer для обычных изображений
function initImageObserver() {
    if (imageObserver) return;
    
    if ('IntersectionObserver' in window) {
        imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    const src = img.dataset.src || img.dataset.lazySrc;
                    
                    if (src) {
                        // Создаем новый Image для предзагрузки
                        const imageLoader = new Image();
                        imageLoader.onload = () => {
                            img.src = src;
                            img.classList.add('lazy-loaded');
                            img.removeAttribute('data-src');
                            img.removeAttribute('data-lazy-src');
                        };
                        imageLoader.onerror = () => {
                            img.classList.add('lazy-error');
                        };
                        imageLoader.src = src;
                    }
                    
                    // Удаляем из наблюдения
                    imageObserver.unobserve(img);
                }
            });
        }, {
            rootMargin: '50px'
        });
    }
}

// Инициализация lazy loading для всех изображений на странице
function initLazyLoading() {
    initPosterObserver();
    initImageObserver();
    
    // Находим все изображения с data-src или data-lazy-src
    if (imageObserver) {
        document.querySelectorAll('img[data-src], img[data-lazy-src]').forEach(img => {
            imageObserver.observe(img);
        });
    }
    
    // Находим все изображения с loading="lazy" (нативная поддержка)
    document.querySelectorAll('img[loading="lazy"]').forEach(img => {
        // Браузер сам обработает, но можем добавить fallback
        if (!('loading' in HTMLImageElement.prototype)) {
            // Fallback для старых браузеров
            if (imageObserver) {
                imageObserver.observe(img);
            }
        }
    });
}

// Асинхронная загрузка постера для карточки с lazy loading
async function loadAnimePosterAsync(card, title, fallbackGradient) {
    if (!card || !title) return;
    
    const posterElement = card.querySelector('.anime-poster');
    if (!posterElement) return;
    
    try {
        let posterUrl = null;
        const contentType = card.dataset.contentType || 'anime';
        
        // Определяем названия для поиска (может быть массив или строка)
        const searchTitle = Array.isArray(title) ? title[0] : title;
        
        // Приоритет 1: Новый быстрый API (параллельные запросы к Kitsu, AniList, Jikan)
        if (typeof getPosterFast === 'function') {
            posterUrl = await getPosterFast(searchTitle, contentType);
        }
        // Приоритет 2: Старый Jikan API
        else if (typeof getAnimeDetails === 'function') {
            const searchTitles = Array.isArray(title) ? title : [title];
            
            for (const st of searchTitles) {
                if (!st) continue;
                try {
                    const details = contentType === 'manga' 
                        ? await getMangaDetails(st)
                        : await getAnimeDetails(st);
                    posterUrl = details?.poster || details?.cover || null;
                    if (posterUrl) break;
                } catch (e) {
                    continue;
                }
            }
        }
        // Приоритет 3: Заглушка
        else if (typeof getAnimePoster === 'function') {
            posterUrl = await getAnimePoster(title, {});
        }
        
        if (posterUrl && !posterUrl.startsWith('data:image/svg+xml')) {
            // Плавная смена градиента на изображение с предзагрузкой
            const img = new Image();
            
            img.onload = () => {
                posterElement.style.backgroundImage = `url('${posterUrl}')`;
                posterElement.style.backgroundSize = 'cover';
                posterElement.style.backgroundPosition = 'center';
                posterElement.classList.add('poster-loaded');
            };
            
            img.onerror = () => {
                posterElement.classList.add('poster-error');
            };
            
            img.src = posterUrl;
        } else {
            posterElement.classList.add('poster-placeholder');
        }
    } catch (error) {
        posterElement.classList.add('poster-error');
    }
}

// Загрузка постера с lazy loading (использует Intersection Observer)
function loadAnimePosterLazy(card, title, fallbackGradient) {
    const posterElement = card.querySelector('.anime-poster');
    if (!posterElement) return;
    
    // Инициализируем Observer если еще не создан
    initPosterObserver();
    
    // Сохраняем данные для загрузки
    card.dataset.posterNeedsLoad = 'true';
    card.dataset.posterTitle = Array.isArray(title) ? JSON.stringify(title) : title;
    card.dataset.posterGradient = fallbackGradient;
    if (!card.dataset.posterDisplayTitle) {
        card.dataset.posterDisplayTitle = Array.isArray(title) ? title[0] || title : title;
    }
    
    // Если Observer не поддерживается, загружаем сразу
    if (!posterObserver) {
        loadAnimePosterAsync(card, title, fallbackGradient);
        return;
    }
    
    // Начинаем наблюдение за элементом
    posterObserver.observe(posterElement);
}

// Открыть страницу аниме
function openAnimePage(animeId) {
    // Сохраняем ID в sessionStorage для передачи на страницу просмотра
    sessionStorage.setItem('viewAnimeId', animeId);
    // Сохраняем URL предыдущей страницы для кнопки "Назад"
    sessionStorage.setItem('previousUrl', window.location.href);
    // Сохраняем позицию прокрутки
    sessionStorage.setItem('scrollPosition', window.scrollY.toString());
    // Определяем правильный путь в зависимости от текущей страницы
    const isCatalog = window.location.pathname.includes('/catalog/') || window.location.pathname.includes('/anime/') || window.location.pathname.includes('/manga/');
    const base = isCatalog ? '../anime/view.html' : 'anime/view.html';
    const q = animeId != null && String(animeId).trim() !== '' ? `?id=${encodeURIComponent(String(animeId))}` : '';
    window.location.href = base + q;
}

// Получить параметры из URL
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        search: params.get('search') || '',
        genre: params.getAll('genre') || [],
        type: params.get('type') || '',
        status: params.get('status') || '',
        yearFrom: params.get('yearFrom') || '',
        yearTo: params.get('yearTo') || '',
        ratingMin: params.get('ratingMin') || '',
        sort: params.get('sort') || 'rating-desc'
    };
}

// Установить параметры URL
function setUrlParams(params) {
    const url = new URL(window.location);
    Object.keys(params).forEach(key => {
        if (params[key]) {
            if (Array.isArray(params[key])) {
                url.searchParams.delete(key);
                params[key].forEach(value => url.searchParams.append(key, value));
            } else {
                url.searchParams.set(key, params[key]);
            }
        } else {
            url.searchParams.delete(key);
        }
    });
    window.history.pushState({}, '', url);
}

// Форматирование числа
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/**
 * Показать карточки порциями с анимацией появления (по 3 за раз).
 * @param {HTMLElement} container - контейнер (сетка)
 * @param {Array} items - массив элементов (аниме/манга)
 * @param {Function} createCardFn - функция (item) => HTMLElement
 * @param {Object} options - { batchSize: 3, batchDelayMs: 450, staggerMs: 80 }
 */
// Глобальный флаг для предотвращения параллельных вызовов appendCardsInBatches
let isAppendingCards = false;

function appendCardsInBatches(container, items, createCardFn, options) {
    if (!container || !items || items.length === 0) return;
    
    // Предотвращаем параллельные вызовы
    if (isAppendingCards) {
        console.warn('[Utils] appendCardsInBatches уже выполняется, пропускаем вызов');
        return;
    }
    
    isAppendingCards = true;
    const opts = Object.assign({ batchSize: 3, batchDelayMs: 450, staggerMs: 80 }, options || {});
    
    // Очищаем контейнер перед добавлением
    container.innerHTML = '';
    
    // Удаляем дубликаты по ID перед добавлением (дополнительная защита)
    const seenIds = new Set();
    const uniqueItems = [];
    for (const item of items) {
        const id = item.id ? parseInt(item.id) : null;
        if (id && !seenIds.has(id)) {
            seenIds.add(id);
            uniqueItems.push(item);
        } else if (!id) {
            // Если нет ID, добавляем все равно (может быть новый элемент)
            uniqueItems.push(item);
        }
    }
    
    // Дополнительная проверка: удаляем дубликаты по dataset.id в уже существующих карточках
    const existingIds = new Set();
    if (container.children.length > 0) {
        Array.from(container.children).forEach(child => {
            const existingId = child.dataset.id ? parseInt(child.dataset.id) : null;
            if (existingId) existingIds.add(existingId);
        });
    }
    
    // Фильтруем элементы, которые уже есть в DOM
    const finalItems = uniqueItems.filter(item => {
        const id = item.id ? parseInt(item.id) : null;
        return !id || !existingIds.has(id);
    });

    (function runBatch(index) {
        if (index >= finalItems.length) {
            isAppendingCards = false;
            return;
        }
        const batch = finalItems.slice(index, index + opts.batchSize);
        const cards = batch.map(item => createCardFn(item));
        
        // Проверяем дубликаты перед добавлением в DOM
        const batchIds = new Set();
        cards.forEach(card => {
            const cardId = card.dataset.id ? parseInt(card.dataset.id) : null;
            if (cardId && !batchIds.has(cardId)) {
                batchIds.add(cardId);
                card.classList.add('card-enter');
                container.appendChild(card);
            }
        });
        
        cards.forEach((card, j) => {
            setTimeout(() => card.classList.add('card-enter-visible'), j * opts.staggerMs);
        });
        const nextIndex = index + opts.batchSize;
        const delay = opts.batchDelayMs + batch.length * opts.staggerMs;
        setTimeout(() => runBatch(nextIndex), delay);
    })(0);
}

// Открыть страницу манги (глобальная функция для использования в профиле)
function openMangaPage(mangaId) {
    sessionStorage.setItem('viewMangaId', mangaId.toString());
    sessionStorage.setItem('previousUrl', window.location.href);
    sessionStorage.setItem('scrollPosition', window.scrollY.toString());
    // Определяем правильный путь в зависимости от текущей страницы
    const isCatalog = window.location.pathname.includes('/catalog/') || window.location.pathname.includes('/manga/') || window.location.pathname.includes('/anime/');
    const path = isCatalog ? '../manga/view.html' : 'manga/view.html';
    window.location.href = path;
}

// Экспорт функций
window.openAnimePage = openAnimePage;
window.openMangaPage = openMangaPage;
window.initLazyLoading = initLazyLoading;
window.initImageObserver = initImageObserver;
window.initPosterObserver = initPosterObserver;
window.loadAnimePosterLazy = loadAnimePosterLazy;
window.loadAnimePosterAsync = loadAnimePosterAsync;
window.appendCardsInBatches = appendCardsInBatches;
window.createAnimeCard = createAnimeCard;
window.generateGradient = generateGradient;
window.formatNumber = formatNumber;

// Автоматическая инициализация lazy loading при загрузке DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLazyLoading);
} else {
    initLazyLoading();
}
