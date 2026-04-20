// Страница просмотра манги с MangaDex интеграцией

let viewMangaDexId = null;
let viewChaptersList = [];

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const idFromUrl = urlParams.get('id');

    let mangaId = null;
    if (idFromUrl != null && idFromUrl !== '' && String(idFromUrl).trim() !== '') {
        const parsed = parseInt(idFromUrl, 10);
        if (!Number.isNaN(parsed)) {
            mangaId = String(parsed);
            sessionStorage.setItem('viewMangaId', mangaId);
        }
    }
    if (!mangaId) {
        mangaId = sessionStorage.getItem('viewMangaId');
    }

    if (!mangaId) {
        document.getElementById('mangaContent').innerHTML = `
            <div class="page-placeholder">
                <h1>Манга не найдена</h1>
                <p>Не удалось загрузить информацию о манге.</p>
                <a href="../catalog/manga.html" class="btn btn-primary">Вернуться в каталог</a>
            </div>
        `;
        if (typeof hideLoading === 'function') hideLoading();
        return;
    }
    
    const manga = typeof getMangaById === 'function' ? getMangaById(mangaId) : null;
    if (!manga) {
        document.getElementById('mangaContent').innerHTML = `
            <div class="page-placeholder">
                <h1>Манга не найдена</h1>
                <p>Манга с ID ${mangaId} не существует в базе данных.</p>
                <a href="../catalog/manga.html" class="btn btn-primary">Вернуться в каталог</a>
            </div>
        `;
        if (typeof hideLoading === 'function') hideLoading();
        return;
    }
    
    try {
        await renderMangaDetail(manga);
    } catch (error) {
        console.error('[MangaView] Render error:', error);
    }
    
    if (typeof hideLoading === 'function') hideLoading();
});

async function renderMangaDetail(manga) {
    const gradient = typeof generateGradient === 'function' ? generateGradient(manga.id) : 'linear-gradient(135deg, #6c5ce7, #a29bfe)';
    const container = document.getElementById('mangaContent');
    const previousUrl = sessionStorage.getItem('previousUrl') || '../catalog/manga.html';
    
    const isFavorite = typeof isMangaInFavorites === 'function' ? isMangaInFavorites(manga.id) : false;
    const favoriteBtnText = isFavorite ? '❤️ В избранном' : '🤍 В избранное';

    // Загружаем данные из MangaDex
    let coverUrl = null;
    let mdDescription = null;
    let mdChaptersCount = null;
    
    // Пробуем poster-api сначала (быстрее)
    try {
        if (typeof getPosterFast === 'function') {
            const poster = await getPosterFast(manga.titleAlt || manga.title, 'manga');
            if (poster && !poster.startsWith('data:image')) {
                coverUrl = poster;
            }
        }
    } catch (e) {}
    
    // Пробуем MangaDex для обложки и данных
    if (typeof MangaDex !== 'undefined') {
        try {
            const searchTitle = manga.titleAlt || manga.title;
            const mdResult = await MangaDex.searchManga(searchTitle);
            if (mdResult) {
                viewMangaDexId = mdResult.mangadexId;
                if (!coverUrl && mdResult.coverUrl) {
                    coverUrl = mdResult.coverUrl;
                }
                if (mdResult.description && !manga.description) {
                    mdDescription = mdResult.description;
                }
            }
        } catch (e) {
            console.warn('[MangaView] MangaDex search error:', e);
        }
    }

    // Fallback: Jikan API
    let jikanAuthor = manga.author || null;
    let jikanScore = null;
    let jikanGenres = manga.genres || [];
    let jikanYear = manga.year || null;
    let jikanChapters = manga.totalChapters || null;

    try {
        if (typeof window.jikanGetMangaDetails === 'function') {
            const jd = await window.jikanGetMangaDetails(manga.titleAlt || manga.title);
            if (jd) {
                if (!coverUrl && jd.cover) coverUrl = jd.cover;
                if (jd.description && !mdDescription && !manga.description) mdDescription = jd.description;
                if (jd.genres && jd.genres.length > 0) jikanGenres = jd.genres;
                if (jd.year && !jikanYear) jikanYear = jd.year;
                if (jd.chapters && !jikanChapters) jikanChapters = jd.chapters;
                if (jd.author && !jikanAuthor) jikanAuthor = jd.author;
                jikanScore = jd.score || null;
            }
        }
    } catch (e) {}
    
    const description = manga.description || mdDescription || 'Описание отсутствует.';
    
    const coverStyle = coverUrl 
        ? `background-image: url('${coverUrl}'); background-size: cover; background-position: center;`
        : `background: ${gradient};`;
    
    container.innerHTML = `
        <a href="${previousUrl}" class="back-button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Назад
        </a>
        
        <div class="anime-detail">
            <div class="anime-detail-header">
                <div class="anime-detail-poster" style="${coverStyle}"></div>
                <div class="anime-detail-info">
                    <h1 class="anime-detail-title">${manga.title}</h1>
                    <div class="anime-detail-meta">
                        <div class="anime-detail-rating">⭐ ${jikanScore || manga.rating}</div>
                        <div class="anime-detail-year">${jikanYear || manga.year}</div>
                        <div class="anime-detail-status">${manga.status}</div>
                        <div class="anime-detail-type">${manga.type}</div>
                    </div>
                    ${jikanAuthor ? `<div class="anime-detail-studio">Автор: ${jikanAuthor}</div>` : ''}
                    ${jikanChapters ? `<div class="anime-detail-studio">Всего глав: ${jikanChapters}</div>` : ''}
                    
                    <div class="anime-detail-description">${description}</div>
                    
                    <div class="anime-detail-genres">
                        ${(jikanGenres.length > 0 ? jikanGenres : manga.genres).map(genre => `
                            <span class="genre-tag" onclick="window.location.href='../catalog/manga.html?genre=${encodeURIComponent(genre)}'">${genre}</span>
                        `).join('')}
                    </div>
                    
                    <div class="anime-detail-actions">
                        <button type="button" class="btn btn-primary" id="readMangaBtn" onclick="startReading(${manga.id})">
                            📖 Читать мангу
                        </button>
                        <button type="button" class="btn btn-secondary favorite-btn" id="favoriteBtn" onclick="handleMangaFavoriteClick(${manga.id})">
                            ${favoriteBtnText}
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="anime-detail-section" id="chaptersSection">
                <h3>Список глав</h3>
                <div class="chapters-loading" id="chaptersLoading">
                    <div class="loading-spinner-small"></div>
                    <span>Загрузка глав с MangaDex...</span>
                </div>
                <div class="episode-list" id="chapterList"></div>
            </div>
        </div>
    `;
    
    // Асинхронно загружаем главы из MangaDex
    loadMangaDexChapters(manga);
}

async function loadMangaDexChapters(manga) {
    const listEl = document.getElementById('chapterList');
    const loadingEl = document.getElementById('chaptersLoading');
    
    if (typeof MangaDex === 'undefined' || !viewMangaDexId) {
        // Fallback: показываем заглушку глав
        if (loadingEl) loadingEl.style.display = 'none';
        if (listEl) {
            const total = manga.totalChapters || 10;
            listEl.innerHTML = generateFallbackChapters(manga, total);
        }
        return;
    }
    
    try {
        viewChaptersList = await MangaDex.getChapters(viewMangaDexId);
        
        if (loadingEl) loadingEl.style.display = 'none';
        
        if (viewChaptersList.length === 0) {
            listEl.innerHTML = '<div class="no-chapters">Главы не найдены на MangaDex. Попробуйте позже.</div>';
            return;
        }
        
        // Сохраняем для ридера
        try {
            sessionStorage.setItem('readerChaptersList', JSON.stringify(viewChaptersList));
        } catch (e) {}
        
        listEl.innerHTML = viewChaptersList.map((ch, i) => {
            const chNum = ch.chapter || (i + 1).toString();
            const chTitle = ch.title ? ` — ${ch.title}` : '';
            const langBadge = ch.language === 'ru' ? '<span class="ch-lang-badge ru">RU</span>' : '<span class="ch-lang-badge en">EN</span>';
            
            return `
                <div class="episode-card" onclick="openChapter('${ch.id}', '${chNum}', ${manga.id})" title="Глава ${chNum}${chTitle}">
                    <span class="ch-number">Глава ${chNum}</span>
                    ${chTitle ? `<span class="ch-title">${ch.title}</span>` : ''}
                    ${langBadge}
                </div>
            `;
        }).join('');
        
    } catch (e) {
        console.error('[MangaView] Chapters error:', e);
        if (loadingEl) loadingEl.style.display = 'none';
        listEl.innerHTML = '<div class="no-chapters">Ошибка загрузки глав. Попробуйте позже.</div>';
    }
}

function generateFallbackChapters(manga, total) {
    const display = Math.min(total, 50);
    let html = '';
    for (let i = 1; i <= display; i++) {
        html += `<div class="episode-card" onclick="startReading(${manga.id}, '${i}')">Глава ${i}</div>`;
    }
    if (total > 50) {
        html += `<div class="episode-card" style="opacity: 0.5;">+${total - 50} глав</div>`;
    }
    return html;
}

function openChapter(chapterId, chapterNum, mangaId) {
    sessionStorage.setItem('readMangaId', mangaId.toString());
    sessionStorage.setItem('readChapterId', chapterId);
    sessionStorage.setItem('readChapterNumber', chapterNum);
    window.location.href = 'reader.html';
}

function startReading(mangaId, chapterNum) {
    sessionStorage.setItem('readMangaId', mangaId.toString());
    sessionStorage.setItem('readChapterNumber', chapterNum || '1');
    
    // Если есть загруженные главы — открываем первую
    if (viewChaptersList.length > 0) {
        const first = viewChaptersList[0];
        sessionStorage.setItem('readChapterId', first.id);
        sessionStorage.setItem('readChapterNumber', first.chapter || '1');
    } else {
        sessionStorage.removeItem('readChapterId');
    }
    
    window.location.href = 'reader.html';
}

function handleMangaFavoriteClick(mangaId) {
    mangaId = parseInt(mangaId);
    if (typeof isMangaInFavorites === 'function' && isMangaInFavorites(mangaId)) {
        handleRemoveMangaFromFavorites(mangaId);
    } else {
        handleAddMangaToFavorites(mangaId);
    }
}

function handleAddMangaToFavorites(mangaId) {
    mangaId = parseInt(mangaId);
    if (typeof isAuthenticatedSync === 'function' && !isAuthenticatedSync()) {
        if (typeof showWarning === 'function') showWarning('Для добавления в избранное необходимо войти в аккаунт');
        return;
    }
    if (typeof window.addMangaToFavorites !== 'undefined') {
        const result = window.addMangaToFavorites(mangaId);
        if (result && result.success) {
            if (typeof showSuccess === 'function') showSuccess(result.message);
        } else {
            if (typeof showError === 'function') showError(result ? result.message : 'Ошибка');
        }
        updateMangaFavoriteButton(mangaId);
    }
}

function handleRemoveMangaFromFavorites(mangaId) {
    mangaId = parseInt(mangaId);
    if (typeof window.removeMangaFromFavorites !== 'undefined') {
        const result = window.removeMangaFromFavorites(mangaId);
        if (result && result.success) {
            if (typeof showSuccess === 'function') showSuccess(result.message);
        } else {
            if (typeof showError === 'function') showError(result ? result.message : 'Ошибка');
        }
        updateMangaFavoriteButton(mangaId);
    }
}

function updateMangaFavoriteButton(mangaId) {
    mangaId = parseInt(mangaId);
    const btn = document.getElementById('favoriteBtn');
    if (btn && typeof isMangaInFavorites === 'function') {
        if (isMangaInFavorites(mangaId)) {
            btn.textContent = '❤️ В избранном';
            btn.onclick = () => handleRemoveMangaFromFavorites(mangaId);
        } else {
            btn.textContent = '🤍 В избранное';
            btn.onclick = () => handleAddMangaToFavorites(mangaId);
        }
    }
}

window.handleMangaFavoriteClick = handleMangaFavoriteClick;
window.handleAddMangaToFavorites = handleAddMangaToFavorites;
window.handleRemoveMangaFromFavorites = handleRemoveMangaFromFavorites;
window.updateMangaFavoriteButton = updateMangaFavoriteButton;
window.openChapter = openChapter;
window.startReading = startReading;
