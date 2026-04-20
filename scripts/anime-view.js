// Страница просмотра аниме
document.addEventListener('DOMContentLoaded', async () => {
    // Убеждаемся, что загрузка показывается
    if (typeof showLoading === 'function') {
        showLoading();
    }
    
    // Защитный таймаут - скрыть загрузку максимум через 15 секунд
    const loadingTimeout = setTimeout(() => {
        if (typeof hideLoading === 'function') {
            hideLoading();
        }
    }, 15000);
    
    const urlParams = new URLSearchParams(window.location.search);
    const malId = urlParams.get('mal_id');
    const idFromUrl = urlParams.get('id');

    // ID из URL (?id=) — приоритет (поиск в шапке, прямые ссылки). Иначе sessionStorage.
    let animeId = null;
    if (idFromUrl != null && idFromUrl !== '' && String(idFromUrl).trim() !== '') {
        const parsed = parseInt(idFromUrl, 10);
        if (!Number.isNaN(parsed)) {
            animeId = String(parsed);
            sessionStorage.setItem('viewAnimeId', animeId);
        }
    }
    if (!animeId) {
        animeId = sessionStorage.getItem('viewAnimeId');
    }

    // Виртуальная карточка каталога (id = 10_000_000 + mal_id): полноценная страница Jikan + плеер
    if (animeId) {
        let virtualAnime = getAnimeById(animeId);
        let jikanFetchedFallback = null;
        const idNum = parseInt(animeId, 10);
        if (
            (!virtualAnime || !virtualAnime._jikanRaw) &&
            !Number.isNaN(idNum) &&
            idNum >= 10000000
        ) {
            const mal = idNum - 10000000;
            if (mal > 0) {
                try {
                    const res = await fetch(`https://api.jikan.moe/v4/anime/${mal}`);
                    if (res.ok) {
                        const jikanData = (await res.json()).data;
                        if (jikanData && typeof registerJikanHomeList === 'function') {
                            registerJikanHomeList([jikanData]);
                        }
                        virtualAnime = getAnimeById(animeId);
                        if (!virtualAnime && jikanData) {
                            jikanFetchedFallback = jikanData;
                        }
                    }
                } catch (_) {
                    /* ignore */
                }
            }
        }
        const jikanForView =
            (virtualAnime && virtualAnime.isJikanVirtual && virtualAnime._jikanRaw) ||
            jikanFetchedFallback;
        if (jikanForView) {
            clearTimeout(loadingTimeout);
            const mergedCard =
                virtualAnime && virtualAnime.isJikanVirtual ? virtualAnime : null;
            await renderJikanAnimeDetail(jikanForView, mergedCard);
            if (typeof hideLoading === 'function') hideLoading();
            return;
        }
    }

    // Попытка загрузить Jikan аниме (из главной — Новинки/Скоро выходит/В эфире)
    if (!animeId && malId) {
        try {
            let jikanData = null;
            const stored = sessionStorage.getItem('jikanAnimeData');
            if (stored) {
                jikanData = JSON.parse(stored);
                sessionStorage.removeItem('jikanAnimeData');
            }
            if (!jikanData || String(jikanData.mal_id) !== String(malId)) {
                const res = await fetch(`https://api.jikan.moe/v4/anime/${malId}`);
                if (res.ok) jikanData = (await res.json()).data;
            }
            if (jikanData) {
                clearTimeout(loadingTimeout);
                await renderJikanAnimeDetail(jikanData);
                if (typeof hideLoading === 'function') hideLoading();
                return;
            }
        } catch (e) {
            console.warn('[view] Jikan fetch error:', e);
        }
    }

    if (!animeId) {
        clearTimeout(loadingTimeout);
        document.getElementById('animeContent').innerHTML = `
            <div class="page-placeholder">
                <h1>Аниме не найдено</h1>
                <p>Не удалось загрузить информацию об аниме.</p>
                <a href="../index.html" class="btn btn-primary">Вернуться на главную</a>
            </div>
        `;
        setTimeout(() => {
            if (typeof hideLoading === 'function') hideLoading();
        }, 100);
        return;
    }
    
    const anime = getAnimeById(animeId);
    if (!anime) {
        clearTimeout(loadingTimeout);
        document.getElementById('animeContent').innerHTML = `
            <div class="page-placeholder">
                <h1>Аниме не найдено</h1>
                <p>Аниме с ID ${animeId} не существует в базе данных.</p>
                <a href="../index.html" class="btn btn-primary">Вернуться на главную</a>
            </div>
        `;
        setTimeout(() => {
            if (typeof hideLoading === 'function') hideLoading();
        }, 100);
        return;
    }
    
    try {
        await renderAnimeDetail(anime);
        
        clearTimeout(loadingTimeout);
        if (typeof hideLoading === 'function') {
            hideLoading();
        }
    } catch (error) {
        console.error('Ошибка рендеринга аниме:', error);
        const container = document.getElementById('animeContent');
        if (container) {
            container.innerHTML = `
                <div class="page-placeholder">
                    <h1>Ошибка загрузки</h1>
                    <p>Не удалось отобразить страницу аниме. Попробуйте обновить страницу.</p>
                    <a href="../index.html" class="btn btn-primary">Вернуться на главную</a>
                </div>
            `;
        }
        clearTimeout(loadingTimeout);
        if (typeof hideLoading === 'function') {
            hideLoading();
        }
    }
});

function escapeHtmlText(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

async function renderJikanAnimeDetail(data, mergedCard = null) {
    if (typeof window !== 'undefined') {
        window.__animeTrailerEmbedSrc = '';
    }
    const container = document.getElementById('animeContent');
    if (!container) return;

    if (
        typeof jikanItemHasRestrictedGenre === 'function' &&
        jikanItemHasRestrictedGenre(data) &&
        typeof isAdultContentEnabled === 'function' &&
        !isAdultContentEnabled()
    ) {
        container.innerHTML = `
            <div class="page-placeholder">
                <h1>Контент 18+</h1>
                <p>Это аниме относится к жанрам «Хентай» или «Эротика». Включите их отображение в настройках профиля и подтвердите возраст (18+).</p>
                <a href="../profile.html" class="btn btn-primary">Открыть настройки</a>
                <a href="../index.html" class="btn btn-secondary" style="margin-left:0.5rem;">На главную</a>
            </div>`;
        return;
    }

    if (typeof registerJikanHomeList === 'function') {
        registerJikanHomeList([data]);
    }

    const hasMergedTitle =
        mergedCard &&
        mergedCard.title &&
        String(mergedCard.title).trim() &&
        String(mergedCard.title).trim() !== '—';
    const hasMergedDesc =
        mergedCard &&
        mergedCard.description &&
        String(mergedCard.description).trim();

    let titleRu = hasMergedTitle
        ? String(mergedCard.title).trim()
        : data.title_english || data.title || '—';
    const looksRussian = (s) => /[а-яёА-ЯЁ]/.test(String(s || ''));
    const jikanSynopsis = (data.synopsis || '')
        .replace('[Written by MAL Rewrite]', '')
        .replace(/<[^>]+>/g, ' ')
        .trim();

    let synopsis = '';
    let shiki = null;
    if (window.shikimoriApi) {
        try {
            shiki = await window.shikimoriApi.enqueueFetchShikimoriByMalId(
                data.mal_id,
                data.title_english || data.title || ''
            );
        } catch (_) {
            /* ignore */
        }
    }
    if (typeof patchJikanVirtualShiki === 'function') {
        patchJikanVirtualShiki(data.mal_id, shiki);
    }
    if (shiki?.russian) {
        const cur = String(titleRu || '').trim();
        if (!hasMergedTitle || cur === '—' || !looksRussian(cur)) titleRu = shiki.russian;
    }

    let ruDescFromShiki = '';
    if (shiki && window.shikimoriApi?.stripHtml) {
        ruDescFromShiki = window.shikimoriApi
            .stripHtml(shiki.description_html || shiki.description || '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    if (hasMergedDesc) {
        const merged = String(mergedCard.description).trim();
        if (looksRussian(merged)) {
            synopsis = merged;
        }
    }
    if (ruDescFromShiki) {
        if (!synopsis || !looksRussian(synopsis) || ruDescFromShiki.length > synopsis.length) {
            synopsis = ruDescFromShiki;
        }
    }
    if (!synopsis && hasMergedDesc) {
        synopsis = String(mergedCard.description).trim();
    }
    if (!synopsis) {
        synopsis = jikanSynopsis || 'Описание появится позже.';
    }

    const posterUrl = data.images?.jpg?.large_image_url || data.images?.jpg?.image_url || '';
    const titleEn = data.title_english || data.title || '';
    const titleJp = data.title_japanese || '';
    let epLine = '';
    if (window.shikimoriApi?.formatAiredTotal) {
        epLine = window.shikimoriApi.formatAiredTotal(data, shiki) || '';
    }
    if (!epLine) {
        const tot = data.episodes;
        epLine = tot != null && tot > 0 ? `? / ${tot} эп.` : '? / ? эп.';
    }
    const duration = data.duration || '';
    const status =
        data.status === 'Currently Airing'
            ? 'Сейчас выходит'
            : data.status === 'Not yet aired'
              ? 'Анонсировано'
              : data.status === 'Finished Airing'
                ? 'Завершено'
                : data.status || '';
    const type = data.type || '';
    const season = data.season ? data.season.charAt(0).toUpperCase() + data.season.slice(1) : '';
    const year = data.year || data.aired?.prop?.from?.year || '';
    const studios = (data.studios || []).map((s) => s.name).join(', ') || '—';
    const genres = (data.genres || [])
        .concat(data.themes || [])
        .map((g) =>
            typeof mapJikanGenreName === 'function' ? mapJikanGenreName(g.name) : g.name
        )
        .filter(Boolean);
    const source = data.source || '';
    const trailerRaw = data.trailer?.embed_url || data.trailer?.url || '';
    const trailerUrl = trailerRaw;
    if (typeof window !== 'undefined' && trailerUrl) {
        window.__animeTrailerEmbedSrc = buildTrailerEmbedUrl(trailerUrl);
    }
    const countdownIso = resolveCountdownTargetIso(data, shiki);
    const previousUrl = sessionStorage.getItem('previousUrl') || '../index.html';

    const rawEp = parseInt(data.episodes, 10);
    let totalEpisodes = 1;
    if (Number.isFinite(rawEp) && rawEp > 0) {
        totalEpisodes = rawEp;
    } else if (data.status === 'Currently Airing') {
        totalEpisodes = 24;
    } else if (data.type !== 'Movie' && data.status !== 'Not yet aired') {
        totalEpisodes = 12;
    } else if (data.type !== 'Movie') {
        totalEpisodes = 1;
    }
    const virtualAnime = {
        id: 10000000 + data.mal_id,
        mal_id: data.mal_id,
        isJikanVirtual: true,
        title: titleRu,
        titleAlt: titleEn || data.title,
        type: data.type === 'Movie' ? 'Фильм' : 'Сериал',
        totalEpisodes,
        _jikanRaw: data
    };

    document.title = `${titleRu} — Re-Minko`;

    container.innerHTML = `
        <div class="anime-detail-header">
            <a href="${previousUrl}" class="back-button">← Назад</a>
        </div>
        <div class="anime-detail-main">
            <div class="anime-detail-poster" style="${posterUrl ? `background-image:url('${posterUrl}');background-size:cover;background-position:center;` : 'background:linear-gradient(135deg,#6c5ce7,#a29bfe);'}">
                ${status ? `<div class="anime-status">${status}</div>` : ''}
            </div>
            <div class="anime-detail-info">
                <h1 class="anime-detail-title">${escapeHtmlText(titleRu)}</h1>
                ${titleEn && titleEn !== titleRu ? `<div class="anime-detail-alt-title" style="opacity:0.85">${escapeHtmlText(titleEn)}</div>` : ''}
                ${titleJp ? `<div class="anime-detail-alt-title">${escapeHtmlText(titleJp)}</div>` : ''}
                <div class="anime-detail-meta">
                    ${type ? `<span class="meta-item">📺 ${type}</span>` : ''}
                    ${epLine ? `<span class="meta-item">🎬 ${epLine}</span>` : ''}
                    ${duration ? `<span class="meta-item">⏱ ${duration}</span>` : ''}
                    ${year ? `<span class="meta-item">📅 ${season ? season + ' ' : ''}${year}</span>` : ''}
                    ${source ? `<span class="meta-item">📖 ${source}</span>` : ''}
                </div>
                <div class="anime-detail-studio">${studios}</div>
                ${genres.length > 0 ? `<div class="anime-detail-genres">${genres.map((g) => `<span class="genre-tag">${escapeHtmlText(g)}</span>`).join('')}</div>` : ''}
                <p class="anime-detail-description">${escapeHtmlText(synopsis)}</p>
                <div class="anime-detail-actions" style="margin-top:12px;display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;">
                    <button type="button" class="btn btn-secondary" onclick="if(typeof scrollToInlinePlayer==='function')scrollToInlinePlayer();">К плееру ↓</button>
                </div>
            </div>
        </div>
        ${generateInlineKodikSection(virtualAnime, { trailerUrl, countdownIso })}
        <div class="anime-detail-section">
            <h2 class="section-title">Информация</h2>
            <div class="anime-detail-info-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:12px;">
                <div class="info-item"><span class="info-label">Тип</span><span class="info-value">${type || '—'}</span></div>
                <div class="info-item"><span class="info-label">Эпизоды</span><span class="info-value">${epLine || '—'}</span></div>
                <div class="info-item"><span class="info-label">Статус</span><span class="info-value">${status || '—'}</span></div>
                <div class="info-item"><span class="info-label">Студия</span><span class="info-value">${studios}</span></div>
                <div class="info-item"><span class="info-label">Источник</span><span class="info-value">${source || '—'}</span></div>
            </div>
        </div>
        <div style="text-align:center;margin:2rem 0;">
            <a href="../catalog/anime.html?search=${encodeURIComponent(titleRu)}" class="btn btn-primary" style="padding:0.8rem 2rem;border-radius:30px;background:linear-gradient(135deg,#7c3aed,#a78bfa);color:#fff;text-decoration:none;font-weight:600;">Найти в каталоге Re-Minko</a>
        </div>
    `;

    window.__jikanVirtualPlayerAnime = virtualAnime;
    initCatalogAnimeInlineKodik(virtualAnime);
    wireAnimePlayerTabs();

    if (window.shikimoriApi?.enqueueFetchShikimoriByMalId) {
        window.shikimoriApi
            .enqueueFetchShikimoriByMalId(data.mal_id, data.title_english || data.title || '')
            .then((shLate) => {
                if (!shLate) return;
                if (typeof patchJikanVirtualShiki === 'function') {
                    patchJikanVirtualShiki(data.mal_id, shLate);
                }
                if (shLate.russian) {
                    const h1 = document.querySelector('.anime-detail-title');
                    const curTitle = h1 && h1.textContent ? h1.textContent.trim() : '';
                    const shouldPatchTitle =
                        !looksRussian(curTitle) || curTitle === '—';
                    if (h1 && shouldPatchTitle) {
                        h1.textContent = shLate.russian;
                        document.title = `${shLate.russian} — Re-Minko`;
                    }
                    if (window.__jikanVirtualPlayerAnime && shouldPatchTitle) {
                        window.__jikanVirtualPlayerAnime.title = shLate.russian;
                    }
                }
                if (window.shikimoriApi?.stripHtml) {
                    const lateDesc = window.shikimoriApi
                        .stripHtml(shLate.description_html || shLate.description || '')
                        .replace(/\s+/g, ' ')
                        .trim();
                    if (lateDesc) {
                        const de = document.querySelector('.anime-detail-description');
                        if (de) {
                            const cur = (de.textContent || '').trim();
                            if (
                                looksRussian(lateDesc) &&
                                (!looksRussian(cur) || lateDesc.length > cur.length)
                            ) {
                                de.textContent = lateDesc;
                            } else if (!looksRussian(cur) && lateDesc.length > cur.length) {
                                de.textContent = lateDesc;
                            }
                        }
                    }
                }
            });
    }
}

async function renderAnimeDetail(anime) {
    if (typeof window !== 'undefined') {
        window.__animeTrailerEmbedSrc = '';
    }
    const gradient = generateGradient(anime.id);
    const container = document.getElementById('animeContent');
    if (!container) return;
    
    // Получаем предыдущий URL или используем главную страницу
    const previousUrl = sessionStorage.getItem('previousUrl') || '../index.html';
    
    // Проверяем, в избранном ли
    const animeIdInt = parseInt(anime.id);
    const isFavorite = typeof isInFavorites === 'function' ? isInFavorites(animeIdInt) : false;
    const favoriteBtnText = isFavorite ? '❤️ В избранном' : '🤍 В избранное';
    
    // Загружаем постер и дополнительные данные (не блокируем рендеринг)
    let posterUrl = null;
    let description = anime.description || null;
    let jikanGenres = anime.genres || [];
    let jikanYear = anime.year || null;
    let jikanEpisodes = anime.totalEpisodes || null;
    let jikanStudios = anime.studio ? [anime.studio] : [];

    const searchTitle = anime.titleAlt || anime.title;
    const looksRussianText = (s) => /[а-яёА-ЯЁ]/.test(String(s || ''));
    
    const initialPoster =
        anime.posterUrl ||
        (anime.poster && String(anime.poster).trim()) ||
        null;
    const posterStyle = initialPoster
        ? `background-image: url('${initialPoster}'); background-size: cover; background-position: center;`
        : `background: ${gradient};`;
    
    // Загружаем данные параллельно в фоне и обновляем страницу после загрузки
    // НЕ блокируем рендеринг - показываем страницу сразу с базовыми данными
    (async () => {
        try {
            // Приоритет 1: Быстрый API для постера
            if (typeof getPosterFast === 'function') {
                try {
                    const url = await Promise.race([
                        getPosterFast(searchTitle, 'anime'),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
                    ]);
                    if (url && !url.startsWith('data:image')) {
                        const posterElement = container.querySelector('.anime-detail-poster');
                        if (posterElement) {
                            posterElement.style.backgroundImage = `url('${url}')`;
                            posterElement.style.backgroundSize = 'cover';
                            posterElement.style.backgroundPosition = 'center';
                        }
                    }
                } catch (e) {
                    // Игнорируем ошибки загрузки постера
                }
            }
            
            // Приоритет 2: Jikan API для дополнительных данных
            if (typeof window !== 'undefined' && window.jikanGetAnimeDetails) {
                try {
                    const jikanData = await Promise.race([
                        window.jikanGetAnimeDetails(searchTitle),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
                    ]);
                    
                    if (jikanData) {
                        // Обновляем постер, если он еще не загружен
                        if (jikanData.poster) {
                            const posterElement = container.querySelector('.anime-detail-poster');
                            if (posterElement && !posterElement.style.backgroundImage) {
                                posterElement.style.backgroundImage = `url('${jikanData.poster}')`;
                                posterElement.style.backgroundSize = 'cover';
                                posterElement.style.backgroundPosition = 'center';
                            }
                        }
                        
                        // Обновляем описание
                        if (jikanData.description) {
                            const descElement = container.querySelector('.anime-detail-description');
                            if (descElement && descElement.textContent.trim() === 'Описание отсутствует.') {
                                descElement.textContent = jikanData.description;
                            }
                        }
                        
                        // Обновляем жанры
                        if (jikanData.genres && jikanData.genres.length > 0) {
                            const genresElement = container.querySelector('.anime-detail-genres');
                            if (genresElement) {
                                genresElement.innerHTML = jikanData.genres.map(genre => 
                                    `<span class="genre-tag" onclick="window.location.href='../catalog/anime.html?genre=${encodeURIComponent(genre)}'">${genre}</span>`
                                ).join('');
                            }
                        }
                        
                        // Обновляем год
                        if (jikanData.year) {
                            const yearElements = container.querySelectorAll('.anime-detail-year');
                            yearElements.forEach(el => {
                                if (el.textContent === anime.year || !el.textContent) {
                                    el.textContent = jikanData.year;
                                }
                            });
                        }
                        
                        // Обновляем студии
                        if (jikanData.studios && jikanData.studios.length > 0) {
                            const studioElements = container.querySelectorAll('.anime-detail-studio');
                            studioElements.forEach(el => {
                                if (el.textContent.includes('Студия:')) {
                                    el.textContent = `Студия: ${jikanData.studios.join(', ')}`;
                                }
                            });
                        }
                        
                        // Обновляем количество серий
                        if (jikanData.episodes) {
                            const episodesElements = container.querySelectorAll('.anime-detail-studio');
                            episodesElements.forEach(el => {
                                if (el.textContent.includes('Всего серий:')) {
                                    el.textContent = `Всего серий: ${jikanData.episodes}`;
                                }
                            });
                        }
                    }
                } catch (e) {
                    // Игнорируем ошибки загрузки данных из Jikan
                }
            }
        } catch (e) {
            // Игнорируем все ошибки загрузки дополнительных данных
        }
    })();
    
    container.innerHTML = `
        <a href="${previousUrl}" class="back-button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Назад
        </a>
        
        <div class="anime-detail">
            <div class="anime-detail-header">
                <div class="anime-detail-poster" style="${posterStyle}"></div>
                <div class="anime-detail-info">
                    <h1 class="anime-detail-title">${anime.title}</h1>
                    <div class="anime-detail-meta">
                        <div class="anime-detail-year">${jikanYear || anime.year}</div>
                        <div class="anime-detail-status">${anime.status}</div>
                        <div class="anime-detail-type">${anime.type}</div>
                    </div>
                    ${jikanStudios.length > 0 ? `<div class="anime-detail-studio">Студия: ${jikanStudios.join(', ')}</div>` : (anime.studio ? `<div class="anime-detail-studio">Студия: ${anime.studio}</div>` : '')}
                    ${anime.duration ? `<div class="anime-detail-studio">Длительность: ${anime.duration}</div>` : ''}
                    ${jikanEpisodes ? `<div class="anime-detail-studio">Всего серий: ${jikanEpisodes}</div>` : (anime.totalEpisodes ? `<div class="anime-detail-studio">Всего серий: ${anime.totalEpisodes}</div>` : '')}
                    
                    <div class="anime-detail-description">
                        ${description ? escapeHtmlText(description) : 'Описание отсутствует.'}
                    </div>
                    
                    <div class="anime-detail-genres">
                        ${(jikanGenres.length > 0 ? jikanGenres : anime.genres).map(genre => `
                            <span class="genre-tag" onclick="window.location.href='../catalog/anime.html?genre=${encodeURIComponent(genre)}'">${genre}</span>
                        `).join('')}
                    </div>
                    
                    <div class="anime-detail-actions">
                        <button type="button" class="btn btn-primary" onclick="if(typeof scrollToInlinePlayer==='function')scrollToInlinePlayer();">
                            К плееру ↓
                        </button>
                        <button type="button" class="btn btn-secondary favorite-btn" id="favoriteBtn" data-maint-lock="favorites" onclick="handleFavoriteClick(${animeIdInt})">
                            ${favoriteBtnText}
                        </button>
                        <button type="button" class="btn btn-secondary watch-together-btn" data-maint-lock="watch_together" onclick="openWatchTogetherModalAnime(${anime.id}, '${anime.title.replace(/'/g, "\\'")}')">
                            👥 Смотреть вместе
                        </button>
                    </div>
                </div>
            </div>
            
            ${generateInlineKodikSection(anime, catalogAnimeTrailerOpts(anime))}
        </div>
    `;
    initCatalogAnimeInlineKodik(anime);
    wireAnimePlayerTabs();
    queueMicrotask(() => {
        if (typeof window.reminkoApplySidebarMaintenanceLocks === 'function') {
            window.reminkoApplySidebarMaintenanceLocks();
        }
    });
    if (anime.mal_id && window.shikimoriApi?.enqueueFetchShikimoriByMalId) {
        window.shikimoriApi
            .enqueueFetchShikimoriByMalId(
                anime.mal_id,
                searchTitle
            )
            .then((sh) => {
                if (!sh || !window.shikimoriApi?.stripHtml) return;
                const ru = window.shikimoriApi
                    .stripHtml(sh.description_html || sh.description || '')
                    .replace(/\s+/g, ' ')
                    .trim();
                if (!ru) return;
                const de = container.querySelector('.anime-detail-description');
                if (!de) return;
                const cur = (de.textContent || '').trim();
                if (looksRussianText(ru) && (!looksRussianText(cur) || ru.length > cur.length)) {
                    de.textContent = ru;
                }
            })
            .catch(() => {});
    }
}

function getCatalogEpisodeCursor(anime) {
    if (!anime) return 1;
    const total = Math.max(1, parseInt(anime.totalEpisodes, 10) || 1);
    if (anime.type !== 'Сериал' || total <= 1) return 1;
    let ep = parseInt(anime.episodes, 10);
    if (Number.isNaN(ep) || ep < 1) ep = 1;
    return Math.min(ep, total);
}

// Встроенный плеер Kodik: общая логика в kodik-catalog-resolve.js (тот же API, что в комнате)
let currentPlayerAnime = null;
let currentEpisode = 1;
let __animeCountdownTimer = null;

function buildTrailerEmbedUrl(raw) {
    if (!raw) return '';
    let urlStr = String(raw).trim();
    try {
        if (/youtube\.com\/watch/i.test(urlStr) || /youtu\.be\//i.test(urlStr)) {
            const u = new URL(urlStr, window.location.href);
            const v = u.searchParams.get('v') || u.pathname.replace(/^\//, '').split('/').filter(Boolean)[0];
            if (v) {
                urlStr = `https://www.youtube.com/embed/${encodeURIComponent(v)}`;
            }
        }
        const u = new URL(urlStr, window.location.href);
        u.searchParams.set('autoplay', '0');
        u.searchParams.set('mute', '0');
        u.searchParams.set('rel', '0');
        u.searchParams.set('modestbranding', '1');
        return u.toString();
    } catch {
        const sep = urlStr.includes('?') ? '&' : '?';
        return `${urlStr}${sep}autoplay=0&mute=0&rel=0`;
    }
}

function catalogAnimeTrailerOpts(anime) {
    const j = anime && anime._jikanRaw;
    const raw = j?.trailer?.embed_url || j?.trailer?.url || '';
    if (typeof window !== 'undefined') {
        window.__animeTrailerEmbedSrc = raw ? buildTrailerEmbedUrl(raw) : '';
    }
    const countdownIso =
        j && typeof resolveCountdownTargetIso === 'function'
            ? resolveCountdownTargetIso(j, null)
            : '';
    return { trailerUrl: raw || '', countdownIso };
}

function readTrailerSrcFromPlayerSection(section) {
    if (typeof window !== 'undefined' && window.__animeTrailerEmbedSrc) {
        return window.__animeTrailerEmbedSrc;
    }
    if (!section) return '';
    const enc = section.getAttribute('data-trailer-src');
    if (enc == null || enc === '') return '';
    try {
        return decodeURIComponent(enc);
    } catch {
        return enc;
    }
}

/** Следующее время эфира по полю broadcast Jikan (Asia/Tokyo) */
function broadcastToNextIso(broadcast) {
    if (!broadcast?.day || !broadcast?.time) return null;
    const tz = 'Asia/Tokyo';
    const dayStr = String(broadcast.day).toLowerCase().replace(/s$/, '');
    const [th, tm] = String(broadcast.time)
        .split(':')
        .map((n) => parseInt(n, 10) || 0);
    const now = Date.now();
    for (let i = 0; i < 10; i++) {
        const probe = new Date(now + i * 86400000);
        const longDay = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' })
            .format(probe)
            .toLowerCase();
        if (longDay !== dayStr) continue;
        const ymd = new Intl.DateTimeFormat('en-CA', {
            timeZone: tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(probe);
        const [yy, mm, dd] = ymd.split('-').map(Number);
        const ms = Date.UTC(yy, mm - 1, dd, th - 9, tm, 0);
        if (ms > now) return new Date(ms).toISOString();
    }
    return null;
}

function resolveCountdownTargetIso(data, shiki) {
    const ne = shiki && (shiki.next_episode_at || shiki.nextEpisodeAt);
    if (ne) return String(ne);
    if (data?.status === 'Not yet aired' && data.aired?.from) return String(data.aired.from);
    if (data?.status === 'Currently Airing' && data.broadcast?.day && data.broadcast?.time) {
        const b = broadcastToNextIso(data.broadcast);
        if (b) return b;
    }
    return '';
}

function ruUnit(n, one, few, many) {
    const nAbs = Math.floor(Math.abs(n)) % 100;
    const n1 = nAbs % 10;
    if (nAbs >= 11 && nAbs <= 14) return many;
    if (n1 === 1) return one;
    if (n1 >= 2 && n1 <= 4) return few;
    return many;
}

function stopAnimeReleaseCountdown() {
    if (__animeCountdownTimer) {
        clearInterval(__animeCountdownTimer);
        __animeCountdownTimer = null;
    }
}

function hideAnimeWatchUnavailable() {
    const block = document.getElementById('animeWatchUnavailable');
    const wrap = document.getElementById('animeKodikFrameWrap');
    if (block) block.hidden = true;
    if (wrap) wrap.hidden = false;
    stopAnimeReleaseCountdown();
}

function renderCountdownMarkup(diffMs) {
    if (diffMs <= 0) return '<div class="countdown__unknown">Ожидаем обновление расписания…</div>';
    let s = Math.floor(diffMs / 1000);
    const secs = s % 60;
    s = Math.floor(s / 60);
    const mins = s % 60;
    s = Math.floor(s / 60);
    const hours = s % 24;
    const days = Math.floor(s / 24);
    const d = String(days).padStart(2, '0');
    const h = String(hours).padStart(2, '0');
    const m = String(mins).padStart(2, '0');
    const sec = String(secs).padStart(2, '0');
    return `
        <div class="countdown__line" aria-live="polite">
            <span class="countdown__num">${d}</span> <span class="countdown__unit">${ruUnit(days, 'день', 'дня', 'дней')}</span>
            <span class="countdown__colon"> : </span>
            <span class="countdown__num">${h}</span> <span class="countdown__unit">${ruUnit(hours, 'час', 'часа', 'часов')}</span>
            <span class="countdown__colon"> : </span>
            <span class="countdown__num">${m}</span> <span class="countdown__unit">${ruUnit(mins, 'минута', 'минуты', 'минут')}</span>
            <span class="countdown__colon"> : </span>
            <span class="countdown__num">${sec}</span> <span class="countdown__unit">${ruUnit(secs, 'секунда', 'секунды', 'секунд')}</span>
        </div>`;
}

function showAnimeWatchUnavailable(iso) {
    const block = document.getElementById('animeWatchUnavailable');
    const wrap = document.getElementById('animeKodikFrameWrap');
    const iframe = document.getElementById('animeKodikIframe');
    if (iframe) iframe.src = 'about:blank';
    if (wrap) wrap.hidden = true;
    if (!block) return;
    block.hidden = false;
    const inner = document.getElementById('animeCountdownInner');
    if (!inner) return;
    stopAnimeReleaseCountdown();
    const target = iso ? Date.parse(iso) : NaN;
    if (!iso || Number.isNaN(target) || target <= Date.now()) {
        inner.innerHTML =
            '<div class="countdown__unknown">Дата следующего эпизода неизвестна.</div>';
        return;
    }
    const tick = () => {
        const left = target - Date.now();
        inner.innerHTML = renderCountdownMarkup(left);
        if (left <= 0) {
            stopAnimeReleaseCountdown();
            inner.innerHTML =
                '<div class="countdown__unknown">Время выхода прошло — скоро обновим плеер.</div>';
        }
    };
    tick();
    __animeCountdownTimer = setInterval(tick, 1000);
}

window.switchAnimePlayerTab = function (name) {
    const watch = document.getElementById('animeTabPanelWatch');
    const trail = document.getElementById('animeTabPanelTrailer');
    const section = document.getElementById('animeInlinePlayerSection');
    section?.querySelectorAll?.('.anime-source-tab').forEach((b) => {
        const on = b.getAttribute('data-tab') === name;
        b.classList.toggle('anime-source-tab--active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (watch) watch.hidden = name !== 'watch';
    if (trail) trail.hidden = name !== 'trailer';
    if (name === 'trailer') {
        const iframe = document.getElementById('animeTrailerIframe');
        const srcFinal = readTrailerSrcFromPlayerSection(section);
        if (iframe && srcFinal) {
            iframe.src = srcFinal;
            iframe.dataset.loaded = '1';
        }
    }
};

function wireAnimePlayerTabs() {
    const section = document.getElementById('animeInlinePlayerSection');
    if (!section || section.dataset.animeTabsDelegated === '1') return;
    section.dataset.animeTabsDelegated = '1';
    section.addEventListener('click', (e) => {
        const btn = e.target && e.target.closest && e.target.closest('.anime-source-tab');
        if (!btn || !section.contains(btn)) return;
        e.preventDefault();
        const tabName = btn.getAttribute('data-tab');
        if (tabName) window.switchAnimePlayerTab(tabName);
    });
}

function generateInlineKodikSection(anime, opts = {}) {
    const trailerUrl = opts.trailerUrl || '';
    const countdownIso = opts.countdownIso || '';
    const hasTrailer = !!trailerUrl;
    const trailerData = hasTrailer ? encodeURIComponent(buildTrailerEmbedUrl(trailerUrl)) : '';
    const safeIso = String(countdownIso || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;');
    const tabBar = hasTrailer
        ? `<div class="anime-player-source-tabs" role="tablist" aria-label="Источник видео">
            <button type="button" class="anime-source-tab anime-source-tab--active" data-tab="watch" role="tab" aria-selected="true" tabindex="0">Смотреть</button>
            <button type="button" class="anime-source-tab" data-tab="trailer" role="tab" aria-selected="false" tabindex="0">Трейлер</button>
        </div>`
        : `<h3 class="anime-inline-kodik-title">Просмотр</h3>`;

    const trailerPanel = hasTrailer
        ? `<div id="animeTabPanelTrailer" class="anime-tab-panel anime-tab-panel--trailer" data-panel="trailer" hidden>
            <div class="anime-trailer-wrap anime-trailer-wrap--tabbed">
                <iframe id="animeTrailerIframe" class="anime-trailer-iframe" title="Трейлер"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                    loading="lazy" src="about:blank" referrerpolicy="strict-origin-when-cross-origin"></iframe>
            </div>
        </div>`
        : '';

    return `
        <div class="anime-detail-section anime-inline-kodik" id="animeInlinePlayerSection" data-countdown-iso="${safeIso}" data-trailer-src="${trailerData}">
            ${tabBar}
            <div id="animeTabPanelWatch" class="anime-tab-panel anime-tab-panel--watch" data-panel="watch">
                <div id="animeWatchUnavailable" class="anime-watch-unavailable" hidden>
                    <p class="anime-watch-unavailable-msg">Аниме ещё не вышло или пока недоступно в Kodik.</p>
                    <div class="anime-release-countdown">
                        <div class="countdown__text">До выхода след. серии осталось:</div>
                        <div class="countdown__wrp fx-col fx-center" id="animeCountdownInner"></div>
                    </div>
                </div>
                <div id="kodikPlayerHint" class="anime-kodik-hint" hidden></div>
                <div class="anime-kodik-frame-wrap" id="animeKodikFrameWrap">
                    <iframe id="animeKodikIframe" class="anime-kodik-iframe" title="Плеер Kodik"
                        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                        referrerpolicy="origin"></iframe>
                </div>
            </div>
            ${trailerPanel}
        </div>
    `;
}

function fillInlineEpisodeSelect(total, current) {
    const sel = document.getElementById('animeKodikEpisodeSelect');
    if (!sel) return;
    let html = '';
    for (let i = 1; i <= total; i++) {
        html += `<option value="${i}"${i === current ? ' selected' : ''}>Серия ${i}</option>`;
    }
    sel.innerHTML = html;
}

function updateInlineEpisodeNavButtons() {
    if (!currentPlayerAnime || currentPlayerAnime.type !== 'Сериал') return;
    const total = currentPlayerAnime.totalEpisodes || 1;
    const prevBtn = document.getElementById('animeKodikPrevBtn');
    const nextBtn = document.getElementById('animeKodikNextBtn');
    if (prevBtn) prevBtn.disabled = currentEpisode <= 1;
    if (nextBtn) nextBtn.disabled = currentEpisode >= total;
}

function highlightEpisodeCardsInList() {
    document.querySelectorAll('#episodeList .episode-card[data-episode]').forEach((el) => {
        const n = parseInt(el.dataset.episode, 10);
        el.classList.toggle('active', n === currentEpisode);
    });
}

function scrollToInlinePlayer() {
    const sec = document.getElementById('animeInlinePlayerSection');
    if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateKodikPlayerHint() {
    const el = document.getElementById('kodikPlayerHint');
    if (!el) return;
    const tok =
        typeof window !== 'undefined' &&
        window.APP_CONFIG &&
        typeof window.APP_CONFIG.kodik?.apiToken === 'string' &&
        window.APP_CONFIG.kodik.apiToken.trim();
    if (!tok) {
        el.hidden = false;
        el.className = 'anime-kodik-hint anime-kodik-hint--warn';
        el.innerHTML =
            'Нужен токен Kodik API. В <code>config.local.js</code> укажите ' +
            '<code>window.APP_CONFIG.kodik.apiToken</code> (личный кабинет Kodik), файл подключайте до <code>scripts/config.js</code>.';
    }
}

async function applyKodikIframeSrc(anime, episode) {
    const iframe = document.getElementById('animeKodikIframe');
    if (!iframe || !anime) return;

    if (!window.KodikApi || !KodikApi.hasToken()) {
        updateKodikPlayerHint();
        return;
    }

    const hint = document.getElementById('kodikPlayerHint');
    const section = document.getElementById('animeInlinePlayerSection');
    const iso = section?.dataset?.countdownIso || '';
    const ep = Math.max(1, parseInt(episode, 10) || 1);

    hideAnimeWatchUnavailable();

    if (hint) {
        hint.hidden = false;
        hint.className = 'anime-kodik-hint anime-kodik-hint--loading';
        hint.innerHTML =
            '<strong class="anime-kodik-hint__title">Подбор плеера через Kodik API…</strong>' +
            '<p class="anime-kodik-hint__note">Плеер может появиться с задержкой: подождите несколько секунд. Если окно пустое или надпись не исчезает — обновите страницу (F5), пока не подгрузится видео.</p>';
    }

    try {
        const K = window.KodikCatalogResolve;
        if (!K || typeof K.resolveEmbedBase !== 'function') {
            throw new Error('KodikCatalogResolve не загружен');
        }
        const base = await K.resolveEmbedBase(anime);
        const url = K.buildIframeUrl(base.href, base.isSerial, ep);
        iframe.src = url;
        if (hint) {
            hint.hidden = true;
            hint.textContent = '';
            hint.innerHTML = '';
            hint.className = 'anime-kodik-hint';
        }
    } catch (e) {
        console.warn('[Kodik API]', e);
        iframe.src = 'about:blank';
        if (hint) {
            hint.hidden = true;
            hint.textContent = '';
            hint.innerHTML = '';
            hint.className = 'anime-kodik-hint';
        }
        showAnimeWatchUnavailable(iso);
    }
}

function pushWatchActivity(anime) {
    if (typeof DirectMessagesService === 'undefined') return;
    if (!anime || anime.isJikanVirtual || parseInt(anime.id, 10) >= 10000000) return;
    DirectMessagesService.updateActivity({
        type: 'watching',
        title: anime.title || anime.titleAlt || 'Аниме',
        animeId: anime.id
    }).catch(() => {});
}

function initCatalogAnimeInlineKodik(anime) {
    if (!anime) return;
    hideAnimeWatchUnavailable();
    const trail = document.getElementById('animeTrailerIframe');
    if (trail) {
        delete trail.dataset.loaded;
        trail.src = 'about:blank';
    }
    const secTabs = document.getElementById('animeInlinePlayerSection');
    secTabs?.querySelectorAll?.('.anime-source-tab').forEach((b) => {
        const on = b.getAttribute('data-tab') === 'watch';
        b.classList.toggle('anime-source-tab--active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    const watchPanel = document.getElementById('animeTabPanelWatch');
    const trailPanel = document.getElementById('animeTabPanelTrailer');
    if (watchPanel) watchPanel.hidden = false;
    if (trailPanel) trailPanel.hidden = true;

    currentPlayerAnime = anime;
    currentEpisode = getCatalogEpisodeCursor(anime);
    if (anime.type === 'Сериал' && anime.totalEpisodes > 1) {
        fillInlineEpisodeSelect(anime.totalEpisodes, currentEpisode);
        updateInlineEpisodeNavButtons();
    }
    void applyKodikIframeSrc(anime, currentEpisode);
    highlightEpisodeCardsInList();
}

function playAnime(animeId) {
    const anime = getAnimeById(animeId);
    if (!anime) return;

    if (typeof hideLoading === 'function') {
        hideLoading();
    }

    if (
        typeof addToWatchHistory === 'function' &&
        !anime.isJikanVirtual &&
        parseInt(anime.id, 10) < 10000000
    ) {
        addToWatchHistory(animeId, 1);
    }

    currentPlayerAnime = anime;
    currentEpisode = 1;
    if (anime.type === 'Сериал' && anime.totalEpisodes > 1) {
        fillInlineEpisodeSelect(anime.totalEpisodes, currentEpisode);
        updateInlineEpisodeNavButtons();
    }
    void applyKodikIframeSrc(anime, currentEpisode);
    highlightEpisodeCardsInList();
    const sel = document.getElementById('animeKodikEpisodeSelect');
    if (sel) sel.value = String(currentEpisode);
    pushWatchActivity(anime);
    scrollToInlinePlayer();
}

function playEpisode(animeId, episodeNumber) {
    const anime = getAnimeById(animeId);
    if (!anime) return;

    if (typeof hideLoading === 'function') {
        hideLoading();
    }

    const total = Math.max(1, parseInt(anime.totalEpisodes, 10) || 1);
    let ep = parseInt(episodeNumber, 10);
    if (Number.isNaN(ep) || ep < 1) ep = 1;
    if (ep > total) ep = total;

    if (
        typeof addToWatchHistory === 'function' &&
        !anime.isJikanVirtual &&
        parseInt(anime.id, 10) < 10000000
    ) {
        addToWatchHistory(animeId, ep);
    }

    currentPlayerAnime = anime;
    currentEpisode = ep;
    if (anime.type === 'Сериал' && anime.totalEpisodes > 1) {
        fillInlineEpisodeSelect(anime.totalEpisodes, currentEpisode);
        updateInlineEpisodeNavButtons();
    }
    void applyKodikIframeSrc(anime, currentEpisode);
    highlightEpisodeCardsInList();
    const sel = document.getElementById('animeKodikEpisodeSelect');
    if (sel) sel.value = String(currentEpisode);
    pushWatchActivity(anime);
    scrollToInlinePlayer();
}

function openPlayer(anime, episode = 1) {
    if (!anime) return;
    playEpisode(anime.id, episode);
}

function prevEpisode() {
    if (currentEpisode > 1) {
        goToEpisode(currentEpisode - 1);
    }
}

function nextEpisode() {
    const total = currentPlayerAnime ? Math.max(1, parseInt(currentPlayerAnime.totalEpisodes, 10) || 1) : 1;
    if (currentPlayerAnime && currentEpisode < total) {
        goToEpisode(currentEpisode + 1);
    }
}

function goToEpisode(ep) {
    const episode = parseInt(ep, 10);
    if (!currentPlayerAnime || Number.isNaN(ep)) return;
    const total = Math.max(1, parseInt(currentPlayerAnime.totalEpisodes, 10) || 1);
    if (episode < 1 || episode > total) return;

    currentEpisode = episode;

    if (
        typeof addToWatchHistory === 'function' &&
        currentPlayerAnime &&
        !currentPlayerAnime.isJikanVirtual &&
        parseInt(currentPlayerAnime.id, 10) < 10000000
    ) {
        addToWatchHistory(currentPlayerAnime.id, episode);
    }

    void applyKodikIframeSrc(currentPlayerAnime, episode);
    highlightEpisodeCardsInList();
    const sel = document.getElementById('animeKodikEpisodeSelect');
    if (sel) sel.value = String(episode);
    updateInlineEpisodeNavButtons();
    pushWatchActivity(currentPlayerAnime);
}

function toggleFullscreenPlayer() {
    const wrap = document.querySelector('.anime-kodik-frame-wrap');
    if (!wrap) return;
    if (!document.fullscreenElement) {
        wrap.requestFullscreen?.().catch(() => {});
    } else {
        document.exitFullscreen?.();
    }
}

function closePlayer() {
    if (typeof DirectMessagesService !== 'undefined') {
        DirectMessagesService.clearActivity().catch(() => {});
    }
}

function handleAddToFavorites(animeId) {
    // Убеждаемся, что animeId - число
    animeId = parseInt(animeId);

    const favBtn = document.getElementById('favoriteBtn');
    if (favBtn && (favBtn.disabled || favBtn.classList.contains('reminko-maint-locked'))) {
        if (typeof showWarning === 'function') showWarning('Раздел в разработке');
        return;
    }

    const isAuth = typeof isAuthenticatedSync === 'function' ? isAuthenticatedSync() : (localStorage.getItem('isAuth') === 'true');
    if (!isAuth) {
        showWarning('Для добавления в избранное необходимо войти в аккаунт');
        const loginModal = document.getElementById('loginModal');
        if (loginModal) {
            loginModal.classList.add('active');
        }
        return;
    }
    
    // Используем функцию из anime-stats.js (глобальная область)
    if (typeof window.addToFavorites !== 'undefined') {
        const result = window.addToFavorites(animeId);
        if (result && result.message) {
            if (result.success) {
                showSuccess(result.message);
            } else {
                showError(result.message);
            }
            updateFavoriteButton(animeId);
        }
    } else {
        console.error('addToFavorites не найдена');
        showError('Ошибка: функция добавления в избранное не найдена');
    }
}

function handleRemoveFromFavorites(animeId) {
    // Убеждаемся, что animeId - число
    animeId = parseInt(animeId);

    const favBtn = document.getElementById('favoriteBtn');
    if (favBtn && (favBtn.disabled || favBtn.classList.contains('reminko-maint-locked'))) {
        if (typeof showWarning === 'function') showWarning('Раздел в разработке');
        return;
    }

    if (typeof window.removeFromFavorites !== 'undefined') {
        const result = window.removeFromFavorites(animeId);
        if (result && result.message) {
            if (result.success) {
                showSuccess(result.message);
            } else {
                showError(result.message);
            }
            updateFavoriteButton(animeId);
        }
    } else {
        console.error('removeFromFavorites не найдена');
        showError('Ошибка: функция удаления из избранного не найдена');
    }
}

function updateFavoriteButton(animeId) {
    // Убеждаемся, что animeId - число
    animeId = parseInt(animeId);
    
    const favoriteBtn = document.getElementById('favoriteBtn');
    if (favoriteBtn && typeof isInFavorites === 'function') {
        if (isInFavorites(animeId)) {
            favoriteBtn.textContent = '❤️ В избранном';
            favoriteBtn.onclick = () => handleRemoveFromFavorites(animeId);
        } else {
            favoriteBtn.textContent = '🤍 В избранное';
            favoriteBtn.onclick = () => handleAddToFavorites(animeId);
        }
    }
    queueMicrotask(() => {
        if (typeof window.reminkoApplySidebarMaintenanceLocks === 'function') {
            window.reminkoApplySidebarMaintenanceLocks();
        }
    });
}

function handleFavoriteClick(animeId) {
    // Убеждаемся, что animeId - число
    animeId = parseInt(animeId);

    const favBtn = document.getElementById('favoriteBtn');
    if (favBtn && (favBtn.disabled || favBtn.classList.contains('reminko-maint-locked'))) {
        if (typeof showWarning === 'function') showWarning('Раздел в разработке');
        return;
    }

    if (typeof isInFavorites === 'function' && isInFavorites(animeId)) {
        handleRemoveFromFavorites(animeId);
    } else {
        handleAddToFavorites(animeId);
    }
}

// ==================== СМОТРЕТЬ ВМЕСТЕ ====================

let watchTogetherAnimeId = null;
let watchTogetherAnimeTitle = '';

// Открыть модальное окно "Смотреть вместе"
function openWatchTogetherModalAnime(animeId, animeTitle) {
    const wtBtn = document.querySelector('.watch-together-btn');
    if (wtBtn && (wtBtn.disabled || wtBtn.classList.contains('reminko-maint-locked'))) {
        if (typeof showWarning === 'function') showWarning('Раздел в разработке');
        return;
    }

    // Проверяем авторизацию (синхронно)
    const isAuth = typeof isAuthenticatedSync === 'function' ? isAuthenticatedSync() : (localStorage.getItem('isAuth') === 'true');
    if (!isAuth) {
        if (typeof showWarning === 'function') {
            showWarning('Войдите в аккаунт, чтобы смотреть вместе');
        }
        return;
    }
    
    watchTogetherAnimeId = animeId;
    watchTogetherAnimeTitle = animeTitle;
    
    // Создаём модальное окно если его нет
    let modal = document.getElementById('watchTogetherModal');
    if (!modal) {
        // Сначала добавляем стили
        addWatchTogetherStyles();
        
        modal = document.createElement('div');
        modal.id = 'watchTogetherModal';
        modal.className = 'watch-together-modal';
        modal.style.display = 'none'; // Явно скрываем
        modal.innerHTML = `
            <div class="watch-together-content">
                <div class="watch-together-header">
                    <h3 class="watch-together-title">👥 Смотреть вместе</h3>
                    <button class="watch-together-close" onclick="closeWatchTogetherModalAnime()">&times;</button>
                </div>
                <div class="watch-together-body">
                    <p class="watch-together-anime-title" id="watchTogetherAnimeTitle"></p>
                    
                    <div class="watch-together-options">
                        <div class="watch-together-option" onclick="createWatchSessionAnime()">
                            <div class="watch-together-option-icon">➕</div>
                            <div class="watch-together-option-text">
                                <h4>Создать сессию</h4>
                                <p>Создайте комнату и пригласите друзей</p>
                            </div>
                        </div>
                        <div class="watch-together-option" onclick="showJoinSessionAnime()">
                            <div class="watch-together-option-icon">🔗</div>
                            <div class="watch-together-option-text">
                                <h4>Присоединиться</h4>
                                <p>Введите код сессии друга</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="session-code-section" id="joinSessionSectionAnime" style="display: none;">
                        <h4 class="session-code-title">Введите код сессии:</h4>
                        <div class="session-code-input-wrapper">
                            <input type="text" class="session-code-input" id="joinSessionCodeAnime" placeholder="XXXXXXXX" maxlength="8">
                            <button class="session-code-btn" onclick="joinWatchSessionAnime()">Войти</button>
                        </div>
                    </div>
                    
                    <div class="active-session-info" id="activeSessionInfoAnime" style="display: none;">
                        <div class="session-created">
                            <h4>✅ Сессия создана!</h4>
                            <p>Код сессии:</p>
                            <div class="session-code-display" id="sessionCodeDisplayAnime">XXXXXXXX</div>
                            <button class="btn btn-primary" onclick="startWatchingTogether()">▶️ Начать просмотр</button>
                        </div>
                    </div>
                    
                    <div class="invite-friends-section" id="inviteFriendsSectionAnime" style="display: none;">
                        <h4>Пригласить друзей:</h4>
                        <div class="online-friends-list" id="onlineFriendsListAnime">
                            <p style="color: var(--text-secondary);">Загрузка...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    // Обновляем название аниме
    document.getElementById('watchTogetherAnimeTitle').textContent = animeTitle;
    
    // Сбрасываем состояние
    document.getElementById('joinSessionSectionAnime').style.display = 'none';
    document.getElementById('activeSessionInfoAnime').style.display = 'none';
    document.getElementById('inviteFriendsSectionAnime').style.display = 'none';
    
    modal.classList.add('active');
}

// Закрыть модальное окно
function closeWatchTogetherModalAnime() {
    const modal = document.getElementById('watchTogetherModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Показать форму ввода кода
function showJoinSessionAnime() {
    document.getElementById('joinSessionSectionAnime').style.display = 'block';
}

// Создать сессию
async function createWatchSessionAnime() {
    const user = typeof getCurrentUserSync === 'function' ? getCurrentUserSync() : JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!user) {
        if (typeof showError === 'function') showError('Необходимо войти в аккаунт');
        return;
    }
    
    if (typeof watchTogetherService === 'undefined') {
        if (typeof showError === 'function') showError('Сервис недоступен');
        return;
    }
    
    const result = await watchTogetherService.createSession(user.id, watchTogetherAnimeId, null, 'anime');
    
    if (result.success) {
        document.getElementById('sessionCodeDisplayAnime').textContent = result.code;
        document.getElementById('activeSessionInfoAnime').style.display = 'block';
        document.getElementById('inviteFriendsSectionAnime').style.display = 'block';
        
        // Загружаем онлайн друзей
        loadOnlineFriendsForInvite(result.code);
        
        if (typeof showSuccess === 'function') showSuccess('Сессия создана!');
    } else {
        if (typeof showError === 'function') showError(result.message || 'Ошибка создания сессии');
    }
}

// Присоединиться к сессии
async function joinWatchSessionAnime() {
    const code = document.getElementById('joinSessionCodeAnime').value.trim().toUpperCase();
    
    if (!code || code.length !== 8) {
        if (typeof showError === 'function') showError('Введите корректный код (8 символов)');
        return;
    }
    
    const user = typeof getCurrentUserSync === 'function' ? getCurrentUserSync() : JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!user) {
        if (typeof showError === 'function') showError('Необходимо войти в аккаунт');
        return;
    }
    
    if (typeof watchTogetherService === 'undefined') {
        if (typeof showError === 'function') showError('Сервис недоступен');
        return;
    }
    
    const result = await watchTogetherService.joinSession(user.id, code);
    
    if (result.success) {
        if (typeof showSuccess === 'function') showSuccess('Вы присоединились к сессии!');
        closeWatchTogetherModalAnime();
        
        // Переходим к аниме из сессии если оно есть
        if (result.session && result.session.anime_id) {
            playAnime(result.session.anime_id);
        }
    } else {
        if (typeof showError === 'function') showError(result.message || 'Ошибка присоединения');
    }
}

// Начать просмотр
function startWatchingTogether() {
    closeWatchTogetherModalAnime();
    if (watchTogetherAnimeId) {
        playAnime(watchTogetherAnimeId);
    }
}

// Загрузить онлайн друзей для приглашения
async function loadOnlineFriendsForInvite(sessionCode) {
    const container = document.getElementById('onlineFriendsListAnime');
    if (!container) return;
    
    const user = typeof getCurrentUserSync === 'function' ? getCurrentUserSync() : JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!user || typeof friendsService === 'undefined') {
        container.innerHTML = '<p style="color: var(--text-secondary);">Войдите, чтобы пригласить друзей</p>';
        return;
    }
    
    try {
        const onlineFriends = await friendsService.getOnlineFriends(user.id);
        
        if (onlineFriends.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary);">Нет друзей онлайн</p>';
            return;
        }
        
        container.innerHTML = onlineFriends.map(f => {
            const friend = f.friend;
            return `
                <div class="online-friend-item">
                    <img src="${friend.avatar || '../Fons/1 b.jpg'}" alt="${friend.username}" class="friend-avatar-small" onerror="this.src='../Fons/1 b.jpg'">
                    <span class="friend-name-small">${friend.username}</span>
                    <button class="btn btn-small btn-primary" onclick="inviteFriendToWatch('${friend.id}', '${sessionCode}')">
                        Пригласить
                    </button>
                </div>
            `;
        }).join('');
    } catch (error) {
        container.innerHTML = '<p style="color: var(--text-secondary);">Ошибка загрузки</p>';
    }
}

// Пригласить друга
async function inviteFriendToWatch(friendId, sessionCode) {
    const user = typeof getCurrentUserSync === 'function' ? getCurrentUserSync() : JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    if (!user || typeof friendsService === 'undefined') return;
    
    const result = await friendsService.inviteToWatch(user.id, friendId, sessionCode, watchTogetherAnimeTitle);
    
    if (result.success) {
        if (typeof showSuccess === 'function') showSuccess('Приглашение отправлено!');
    } else {
        if (typeof showError === 'function') showError(result.message || 'Ошибка отправки');
    }
}

// Добавить стили для модального окна
function addWatchTogetherStyles() {
    if (document.getElementById('watchTogetherStyles')) return;
    
    const style = document.createElement('style');
    style.id = 'watchTogetherStyles';
    style.textContent = `
        .watch-together-modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 1rem;
        }
        
        .watch-together-modal.active {
            display: flex;
        }
        
        .watch-together-content {
            background: var(--bg-card);
            border-radius: 16px;
            max-width: 500px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
        }
        
        .watch-together-header {
            padding: 1.5rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .watch-together-title {
            font-size: 1.25rem;
            font-weight: 600;
            color: var(--text-primary);
        }
        
        .watch-together-close {
            background: none;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            padding: 0.5rem;
            font-size: 1.5rem;
            line-height: 1;
        }
        
        .watch-together-body {
            padding: 1.5rem;
        }
        
        .watch-together-anime-title {
            color: var(--primary-color);
            font-size: 1.1rem;
            margin-bottom: 1.5rem;
            text-align: center;
        }
        
        .watch-together-options {
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }
        
        .watch-together-option {
            display: flex;
            align-items: center;
            padding: 1rem;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.3s ease;
            gap: 1rem;
        }
        
        .watch-together-option:hover {
            background: rgba(255, 255, 255, 0.1);
        }
        
        .watch-together-option-icon {
            width: 48px;
            height: 48px;
            background: var(--primary-color);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
        }
        
        .watch-together-option-text h4 {
            color: var(--text-primary);
            margin-bottom: 0.25rem;
        }
        
        .watch-together-option-text p {
            color: var(--text-secondary);
            font-size: 0.85rem;
        }
        
        .session-code-section {
            margin-top: 1.5rem;
            padding-top: 1.5rem;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .session-code-title {
            color: var(--text-primary);
            margin-bottom: 1rem;
        }
        
        .session-code-input-wrapper {
            display: flex;
            gap: 0.5rem;
        }
        
        .session-code-input {
            flex: 1;
            padding: 0.75rem 1rem;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            color: var(--text-primary);
            font-size: 1rem;
            text-transform: uppercase;
            letter-spacing: 2px;
        }
        
        .session-code-btn {
            padding: 0.75rem 1.5rem;
            background: var(--primary-color);
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
        }
        
        .active-session-info {
            margin-top: 1.5rem;
            padding: 1.5rem;
            background: rgba(var(--primary-rgb), 0.1);
            border-radius: 12px;
            text-align: center;
        }
        
        .session-code-display {
            background: rgba(255, 255, 255, 0.1);
            padding: 1rem;
            border-radius: 8px;
            font-family: monospace;
            font-size: 1.5rem;
            letter-spacing: 4px;
            color: var(--primary-color);
            margin: 1rem 0;
        }
        
        .invite-friends-section {
            margin-top: 1.5rem;
            padding-top: 1.5rem;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .online-friend-item {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.75rem;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            margin-bottom: 0.5rem;
        }
        
        .friend-avatar-small {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            object-fit: cover;
        }
        
        .friend-name-small {
            flex: 1;
            color: var(--text-primary);
        }
        
        .btn-small {
            padding: 0.5rem 1rem;
            font-size: 0.85rem;
        }
        
        .watch-together-btn {
            background: rgba(var(--primary-rgb), 0.2) !important;
            color: var(--primary-color) !important;
        }
        
        .watch-together-btn:hover {
            background: rgba(var(--primary-rgb), 0.3) !important;
        }
    `;
    document.head.appendChild(style);
}

// Глобальные экспорты для плеера (необходимы для onclick в HTML)
window.playAnime = playAnime;
window.playEpisode = playEpisode;
window.openPlayer = openPlayer;
window.closePlayer = closePlayer;
window.prevEpisode = prevEpisode;
window.nextEpisode = nextEpisode;
window.goToEpisode = goToEpisode;
window.toggleFullscreenPlayer = toggleFullscreenPlayer;
window.handleFavoriteClick = handleFavoriteClick;
window.openWatchTogetherModalAnime = openWatchTogetherModalAnime;
window.closeWatchTogetherModalAnime = closeWatchTogetherModalAnime;
window.createWatchSessionAnime = createWatchSessionAnime;
window.joinWatchSessionAnime = joinWatchSessionAnime;
window.showJoinSessionAnime = showJoinSessionAnime;
window.startWatchingTogether = startWatchingTogether;
window.inviteFriendToWatch = inviteFriendToWatch;

// Восстановление после «Назад» (bfcache): иначе iframe остаётся на промежуточной ошибке Kodik.
window.addEventListener('pageshow', (ev) => {
    if (!ev.persisted) return;
    const iframe = document.getElementById('animeKodikIframe');
    if (!iframe) return;
    let anime = currentPlayerAnime;
    if (!anime && typeof getAnimeById === 'function') {
        const rawId = sessionStorage.getItem('viewAnimeId');
        if (rawId) anime = getAnimeById(rawId);
    }
    if (!anime) return;
    const ep =
        typeof currentEpisode === 'number' && currentEpisode >= 1
            ? currentEpisode
            : getCatalogEpisodeCursor(anime);
    currentPlayerAnime = anime;
    currentEpisode = ep;
    iframe.src = 'about:blank';
    requestAnimationFrame(() => {
        void applyKodikIframeSrc(anime, ep);
    });
});
