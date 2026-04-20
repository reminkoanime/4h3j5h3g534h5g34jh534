// Каталог манги - полнофункциональный

let currentPage = 1;
const itemsPerPage = 24;
let allResults = [];

// Обновление текста кнопки фильтра
function updateFilterButtonText(btnId, values) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    
    if (!Array.isArray(values)) values = values ? [values] : [];
    
    const valueEl = btn.querySelector('.filter-chip-value');
    const defaultText = 'Все';
    const displayText = values.length === 0 ? defaultText : values.length === 1 ? values[0] : `Выбрано: ${values.length}`;
    
    if (valueEl) {
        valueEl.textContent = displayText;
    } else {
        const svg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>';
        btn.innerHTML = (values.length === 0 ? (btnId.includes('Genre') ? 'Выберите жанр' : btnId.includes('Type') ? 'Выберите тип' : 'Выберите статус') : displayText) + ' ' + svg;
    }
}

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
    loadGenres(); // Загружаем жанры сначала
    // loadFilters, initFilterEvents и applyFilters вызываются внутри loadGenres
    
    // Восстанавливаем позицию прокрутки при возврате из просмотра
    const scrollPosition = sessionStorage.getItem('scrollPosition');
    if (scrollPosition) {
        setTimeout(() => {
            window.scrollTo({ top: parseInt(scrollPosition), behavior: 'auto' });
            sessionStorage.removeItem('scrollPosition');
        }, 100);
    }
});

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

// Применение фильтров
function applyFilters(smoothScroll = true) {
    const filters = getFilters();
    
    // Показываем индикатор загрузки
    showLoadingIndicator();
    
    // Используем setTimeout для предотвращения прыжков страницы
    setTimeout(() => {
        // Получаем все результаты с применением фильтров
        allResults = filterManga(filters);
        
        // Сортируем результаты
        const sortSelect = document.getElementById('sortSelect');
        const sortBy = sortSelect ? sortSelect.value : 'rating-desc';
        allResults = sortManga(allResults, sortBy);
        
        // Обновляем URL
        filters.sort = sortBy;
        updateFiltersInUrl(filters);
        
        // Отображаем результаты
        currentPage = 1;
        displayResults(allResults);
        updatePagination(allResults.length);
        
        // Скрываем индикатор загрузки
        hideLoadingIndicator();
        
        // Прокручиваем вверх если нужно
        if (smoothScroll) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, 100);
}

// Получить текущие фильтры
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

// Отображение результатов
function displayResults(results) {
    const container = document.getElementById('catalogResults');
    if (!container) return;
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageResults = results.slice(startIndex, endIndex);
    
    if (pageResults.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                <p style="font-size: 1.2rem; color: var(--text-secondary);">Манга не найдена</p>
                <p style="color: var(--text-secondary); margin-top: 0.5rem;">Попробуйте изменить фильтры</p>
            </div>
        `;
        return;
    }
    
    if (typeof appendCardsInBatches === 'function') {
        appendCardsInBatches(container, pageResults, (manga) => createMangaCard(manga), { batchSize: 3, batchDelayMs: 400, staggerMs: 80 });
    } else {
        container.innerHTML = '';
        pageResults.forEach(manga => container.appendChild(createMangaCard(manga)));
    }
    
    // Обновляем информацию о результатах
    const resultsInfo = document.getElementById('resultsInfo');
    if (resultsInfo) {
        resultsInfo.textContent = `Найдено: ${results.length} манги`;
    }
}

// Создание карточки манги
function createMangaCard(manga) {
    const card = document.createElement('div');
    card.className = 'anime-card';
    card.dataset.id = manga.id;
    
    const gradient = generateGradient(manga.id);
    
    card.innerHTML = `
        <div class="anime-poster" style="background: ${gradient};">
            <div class="anime-year">${manga.year}</div>
            ${manga.status ? `<div class="anime-status">${manga.status}</div>` : ''}
        </div>
        <div class="anime-info">
            <h3 class="anime-title">${manga.title}</h3>
            <div class="anime-meta">
                <div class="anime-rating">⭐ ${manga.rating || 0}</div>
                ${manga.totalChapters ? `<div class="anime-episodes">Глав: ${manga.totalChapters}</div>` : ''}
            </div>
            ${manga.author ? `<div class="anime-studio">Автор: ${manga.author}</div>` : ''}
            ${manga.genres ? `<div class="anime-genres">${manga.genres.slice(0, 2).join(', ')}</div>` : ''}
        </div>
    `;
    
    card.onclick = () => openMangaPage(manga.id);
    
    // Загружаем обложку из API (сначала английское название для лучшего поиска)
    if (typeof loadAnimePosterLazy === 'function') {
        card.dataset.contentType = 'manga';
        const searchTitles = manga.titleAlt ? [manga.titleAlt, manga.title] : manga.title;
        loadAnimePosterLazy(card, searchTitles, gradient);
    }
    
    return card;
}

// Открытие страницы манги
function openMangaPage(mangaId) {
    // Сохраняем текущую позицию прокрутки и URL
    sessionStorage.setItem('scrollPosition', window.scrollY.toString());
    sessionStorage.setItem('previousUrl', window.location.href);
    sessionStorage.setItem('viewMangaId', mangaId.toString());
    
    // Переход на страницу просмотра
    window.location.href = '../manga/view.html';
}

// Глобальная функция для открытия страницы манги
window.openMangaPage = openMangaPage;

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
    const searchInput = document.getElementById('catalogSearch');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => applyFilters(false), 500);
        });
    }
    
    const applyBtn = document.getElementById('applyFilters');
    if (applyBtn) applyBtn.addEventListener('click', () => applyFilters(true));
    
    const resetBtn = document.getElementById('resetFilters');
    if (resetBtn) resetBtn.addEventListener('click', resetFilters);
    
    // Слайдеры года
    const yearFromRange = document.getElementById('filterYearFromRange');
    const yearFromSpan = document.getElementById('filterYearFrom');
    if (yearFromRange && yearFromSpan) {
        yearFromRange.addEventListener('input', (e) => {
            const v = parseInt(e.target.value);
            yearFromSpan.textContent = v;
            const yearToRange = document.getElementById('filterYearToRange');
            if (yearToRange && v > parseInt(yearToRange.value)) {
                yearToRange.value = v;
                document.getElementById('filterYearTo').textContent = v;
            }
        });
    }
    const yearToRange = document.getElementById('filterYearToRange');
    const yearToSpan = document.getElementById('filterYearTo');
    if (yearToRange && yearToSpan) {
        yearToRange.addEventListener('input', (e) => {
            const v = parseInt(e.target.value);
            yearToSpan.textContent = v;
            const yearFromRange = document.getElementById('filterYearFromRange');
            if (yearFromRange && v < parseInt(yearFromRange.value)) {
                yearFromRange.value = v;
                document.getElementById('filterYearFrom').textContent = v;
            }
        });
    }
    
    // Панели типа, жанра, статуса
    ['filterTypeBtn', 'filterGenreBtn', 'filterStatusBtn'].forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const panelId = btn.dataset.target;
                const panel = document.getElementById(panelId);
                const isActive = panel?.classList.contains('active');
                document.querySelectorAll('.filter-select-panel').forEach(p => p.classList.remove('active'));
                document.querySelectorAll('.filter-select-btn').forEach(b => b.classList.remove('active'));
                if (!isActive && panel) {
                    panel.classList.add('active');
                    btn.classList.add('active');
                }
            });
        }
    });
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.filter-chip-wrap') && !e.target.closest('.filter-multi-select')) {
            document.querySelectorAll('.filter-select-panel').forEach(p => p.classList.remove('active'));
            document.querySelectorAll('.filter-select-btn').forEach(b => b.classList.remove('active'));
        }
    });
    
    ['filterTypePanel', 'filterGenrePanel', 'filterStatusPanel'].forEach(panelId => {
        const panel = document.getElementById(panelId);
        if (panel) {
            panel.addEventListener('change', (e) => {
                if (e.target.type === 'checkbox') {
                    const btnId = panelId.replace('Panel', 'Btn');
                    const checked = panel.querySelectorAll('input[type="checkbox"]:checked');
                    updateFilterButtonText(btnId, Array.from(checked).map(cb => cb.value));
                }
            });
        }
    });
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
        yearFromRange.value = yearFromRange.min || '1970';
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

// Загрузка жанров в фильтры
function loadGenres() {
    const panel = document.getElementById('filterGenrePanel');
    if (!panel) return;
    
    const container = panel.querySelector('.filter-dropdown-inner, .filter-genres-grid') || panel;
    const genres = getAllMangaGenres();
    container.innerHTML = genres.map(genre => `
        <label class="filter-option filter-checkbox-item">
            <input type="checkbox" value="${genre}" id="genre_${genre.replace(/\s+/g, '_')}">
            <span>${genre}</span>
        </label>
    `).join('');
    
    // После загрузки жанров применяем фильтры из URL и инициализируем события
    loadFilters();
    initFilterEvents();
    applyFilters();
}

