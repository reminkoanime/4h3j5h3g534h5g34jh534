// Читалка манги через MangaDex API

let currentManga = null;
let currentChapterId = null;
let chaptersList = [];
let currentChapterIndex = 0;
let pageUrls = [];
let readingMode = 'scroll'; // 'scroll' | 'page'
let currentPageIndex = 0;

document.addEventListener('DOMContentLoaded', () => {
    const mangaId = sessionStorage.getItem('readMangaId');
    const chapterId = sessionStorage.getItem('readChapterId');
    const chapterNum = sessionStorage.getItem('readChapterNumber') || '1';
    
    if (!mangaId) {
        showReaderError('Манга не выбрана');
        setTimeout(() => { window.location.href = '../catalog/manga.html'; }, 2000);
        return;
    }
    
    if (typeof getMangaById === 'function') {
        currentManga = getMangaById(mangaId);
    }
    
    const titleEl = document.getElementById('readerTitle');
    if (titleEl && currentManga) {
        titleEl.textContent = `${currentManga.title} — Загрузка...`;
    }
    
    initReaderControls();
    
    if (chapterId) {
        loadChapterById(chapterId, chapterNum);
    } else if (currentManga) {
        loadChapterBySearch(currentManga, chapterNum);
    } else {
        showReaderError('Не удалось загрузить мангу');
    }
    
    document.addEventListener('keydown', handleReaderKeys);
});

function initReaderControls() {
    const modeBtn = document.getElementById('readingModeBtn');
    if (modeBtn) {
        modeBtn.addEventListener('click', toggleReadingMode);
    }
}

async function loadChapterBySearch(manga, chapterNum) {
    const container = document.getElementById('pageContainer');
    container.innerHTML = '<div class="manga-page-loading">Поиск манги на MangaDex...</div>';
    
    if (typeof MangaDex === 'undefined') {
        showReaderError('MangaDex API не загружен');
        return;
    }

    try {
        const searchTitle = manga.titleAlt || manga.title;
        const mdResult = await MangaDex.searchManga(searchTitle);
        
        if (!mdResult) {
            showReaderError(`Манга "${manga.title}" не найдена на MangaDex`);
            return;
        }

        container.innerHTML = '<div class="manga-page-loading">Загрузка глав...</div>';
        
        chaptersList = await MangaDex.getChapters(mdResult.mangadexId);
        
        if (chaptersList.length === 0) {
            showReaderError('Главы не найдены на MangaDex для этой манги');
            return;
        }

        // Ищем нужную главу по номеру
        let targetIndex = chaptersList.findIndex(ch => ch.chapter === chapterNum);
        if (targetIndex === -1) targetIndex = 0;
        
        currentChapterIndex = targetIndex;
        await loadChapterPages(chaptersList[targetIndex]);
        
    } catch (e) {
        console.error('[Reader] Error:', e);
        showReaderError('Ошибка загрузки: ' + e.message);
    }
}

async function loadChapterById(chapterId, chapterNum) {
    const container = document.getElementById('pageContainer');
    container.innerHTML = '<div class="manga-page-loading">Загрузка главы...</div>';
    
    if (typeof MangaDex === 'undefined') {
        showReaderError('MangaDex API не загружен');
        return;
    }

    try {
        currentChapterId = chapterId;
        
        // Если есть список глав в sessionStorage — восстанавливаем
        const storedChapters = sessionStorage.getItem('readerChaptersList');
        if (storedChapters) {
            try {
                chaptersList = JSON.parse(storedChapters);
                currentChapterIndex = chaptersList.findIndex(ch => ch.id === chapterId);
                if (currentChapterIndex === -1) currentChapterIndex = 0;
            } catch (e) {
                chaptersList = [];
            }
        }

        const pages = await MangaDex.getChapterPages(chapterId);
        
        if (!pages.quality.length && !pages.dataSaver.length) {
            showReaderError('Страницы главы не найдены');
            return;
        }

        pageUrls = pages.dataSaver.length > 0 ? pages.dataSaver : pages.quality;
        
        updateReaderTitle(chapterNum);
        renderPages();
        updateChapterNav();
        
        if (typeof hideLoading === 'function') hideLoading();
        
    } catch (e) {
        console.error('[Reader] Error:', e);
        showReaderError('Ошибка загрузки: ' + e.message);
    }
}

async function loadChapterPages(chapter) {
    const container = document.getElementById('pageContainer');
    container.innerHTML = '<div class="manga-page-loading">Загрузка страниц...</div>';
    
    try {
        currentChapterId = chapter.id;
        const pages = await MangaDex.getChapterPages(chapter.id);
        
        if (!pages.quality.length && !pages.dataSaver.length) {
            showReaderError('Страницы главы не найдены');
            return;
        }

        pageUrls = pages.dataSaver.length > 0 ? pages.dataSaver : pages.quality;
        
        const chNum = chapter.chapter || (currentChapterIndex + 1).toString();
        updateReaderTitle(chNum);
        renderPages();
        updateChapterNav();
        
        if (typeof hideLoading === 'function') hideLoading();
        
        window.scrollTo({ top: 0, behavior: 'auto' });
        
    } catch (e) {
        console.error('[Reader] Chapter load error:', e);
        showReaderError('Ошибка загрузки страниц: ' + e.message);
    }
}

function updateReaderTitle(chapterNum) {
    const titleEl = document.getElementById('readerTitle');
    if (!titleEl) return;
    const name = currentManga ? currentManga.title : 'Манга';
    titleEl.textContent = `${name} — Глава ${chapterNum}`;
}

function renderPages() {
    const container = document.getElementById('pageContainer');
    container.innerHTML = '';
    
    if (readingMode === 'scroll') {
        renderScrollMode(container);
    } else {
        renderPageMode(container);
    }
}

function renderScrollMode(container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'manga-scroll-wrapper';
    
    pageUrls.forEach((url, i) => {
        const pageDiv = document.createElement('div');
        pageDiv.className = 'manga-page-item';
        
        const img = document.createElement('img');
        img.src = url;
        img.alt = `Страница ${i + 1}`;
        img.loading = i < 3 ? 'eager' : 'lazy';
        img.className = 'manga-page-img';
        img.onerror = function() {
            this.style.display = 'none';
            pageDiv.innerHTML = `<div class="manga-page-error-inline">Не удалось загрузить страницу ${i + 1}</div>`;
        };
        
        pageDiv.appendChild(img);
        wrapper.appendChild(pageDiv);
    });
    
    container.appendChild(wrapper);
    
    const pageInfo = document.getElementById('pageInfo');
    if (pageInfo) pageInfo.textContent = `${pageUrls.length} стр.`;
}

function renderPageMode(container) {
    if (pageUrls.length === 0) return;
    
    currentPageIndex = 0;
    
    const pageDiv = document.createElement('div');
    pageDiv.className = 'manga-single-page';
    pageDiv.id = 'singlePageView';
    
    const img = document.createElement('img');
    img.src = pageUrls[0];
    img.alt = 'Страница 1';
    img.className = 'manga-page-img';
    img.id = 'currentPageImg';
    
    pageDiv.appendChild(img);
    container.appendChild(pageDiv);
    
    // Клик по изображению — следующая страница
    pageDiv.addEventListener('click', (e) => {
        const rect = pageDiv.getBoundingClientRect();
        const x = e.clientX - rect.left;
        if (x > rect.width / 2) {
            goToNextPage();
        } else {
            goToPrevPage();
        }
    });
    
    updatePageInfo();
}

function goToNextPage() {
    if (currentPageIndex < pageUrls.length - 1) {
        currentPageIndex++;
        const img = document.getElementById('currentPageImg');
        if (img) {
            img.src = pageUrls[currentPageIndex];
            img.alt = `Страница ${currentPageIndex + 1}`;
        }
        updatePageInfo();
    }
}

function goToPrevPage() {
    if (currentPageIndex > 0) {
        currentPageIndex--;
        const img = document.getElementById('currentPageImg');
        if (img) {
            img.src = pageUrls[currentPageIndex];
            img.alt = `Страница ${currentPageIndex + 1}`;
        }
        updatePageInfo();
    }
}

function updatePageInfo() {
    const pageInfo = document.getElementById('pageInfo');
    if (pageInfo) {
        pageInfo.textContent = `${currentPageIndex + 1} / ${pageUrls.length}`;
    }
    
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    if (prevBtn) prevBtn.disabled = currentPageIndex === 0;
    if (nextBtn) nextBtn.disabled = currentPageIndex >= pageUrls.length - 1;
}

function toggleReadingMode() {
    readingMode = readingMode === 'scroll' ? 'page' : 'scroll';
    const btn = document.getElementById('readingModeBtn');
    if (btn) btn.textContent = readingMode === 'scroll' ? '📜 Скролл' : '📄 Постранично';
    renderPages();
}

function updateChapterNav() {
    const prevChBtn = document.getElementById('prevChapterBtn');
    const nextChBtn = document.getElementById('nextChapterBtn');
    
    if (prevChBtn) prevChBtn.disabled = currentChapterIndex <= 0;
    if (nextChBtn) nextChBtn.disabled = currentChapterIndex >= chaptersList.length - 1;
}

async function nextChapter() {
    if (currentChapterIndex >= chaptersList.length - 1) return;
    currentChapterIndex++;
    await loadChapterPages(chaptersList[currentChapterIndex]);
}

async function previousChapter() {
    if (currentChapterIndex <= 0) return;
    currentChapterIndex--;
    await loadChapterPages(chaptersList[currentChapterIndex]);
}

function nextPage() {
    if (readingMode === 'page') {
        goToNextPage();
    } else {
        nextChapter();
    }
}

function previousPage() {
    if (readingMode === 'page') {
        goToPrevPage();
    } else {
        previousChapter();
    }
}

function handleReaderKeys(e) {
    if (readingMode === 'page') {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            goToNextPage();
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            goToPrevPage();
        }
    }
    if (e.key === 'Escape') goBack();
}

function showReaderError(msg) {
    const container = document.getElementById('pageContainer');
    if (container) {
        container.innerHTML = `
            <div class="manga-reader-error">
                <div class="error-icon">📖</div>
                <h3>${msg}</h3>
                <p>Попробуйте другую мангу или проверьте соединение.</p>
                <button class="btn btn-primary" onclick="goBack()">Назад</button>
            </div>
        `;
    }
    if (typeof hideLoading === 'function') hideLoading();
}

function goBack() {
    const mangaId = sessionStorage.getItem('readMangaId');
    if (mangaId) {
        sessionStorage.setItem('viewMangaId', mangaId);
        window.location.href = 'view.html';
    } else {
        window.location.href = '../catalog/manga.html';
    }
}

window.nextPage = nextPage;
window.previousPage = previousPage;
window.nextChapter = nextChapter;
window.previousChapter = previousChapter;
window.goBack = goBack;
window.toggleReadingMode = toggleReadingMode;
