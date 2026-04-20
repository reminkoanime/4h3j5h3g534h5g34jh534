// Страница профиля пользователя

const favoritesPerPage = 10; // 5x2 для аниме
const mangaFavoritesPerPage = 10; // 5x2 для манги
let currentFavoritesPage = 0;
let currentMangaFavoritesPage = 0;

// Доступные аватары
const availableAvatars = [
    'Fons/1 b.jpg', // Парень 1
    'Fons/2 b.jpg', // Парень 2
    'Fons/3 b.jpg', // Парень 3
    'Fons/4 b.jpg', // Парень 4
    'Fons/5 b.jpg', // Парень 5
    'Fons/1 g.jpg', // Девушка 1
    'Fons/2 g.jpg', // Девушка 2
    'Fons/3 g.jpg', // Девушка 3
    'Fons/4 g.jpg', // Девушка 4
    'Fons/5 g.jpg'  // Девушка 5
];

// Получить доступные аватары для пользователя
async function getAvailableAvatarsForUser(userId, userGender, userAchievements) {
    return [...availableAvatars];
}

// Получить случайный аватар
function getRandomAvatar() {
    return availableAvatars[Math.floor(Math.random() * availableAvatars.length)];
}

document.addEventListener('DOMContentLoaded', async () => {
    // Проверяем параметр user из URL
    const urlParams = new URLSearchParams(window.location.search);
    const userIdFromUrl = urlParams.get('user') || urlParams.get('id');
    
    if (userIdFromUrl) {
        // Загружаем профиль другого пользователя
        await loadUserProfile(userIdFromUrl);
    } else {
        // Загружаем свой профиль
        const isAuth = await isAuthenticated();
        if (!isAuth) {
            window.location.href = 'index.html';
            return;
        }
        
        loadProfile();
        initAvatarPicker();
    }
});

// Загрузить профиль другого пользователя
async function loadUserProfile(userId) {
    if (!supabaseClient) {
        if (typeof showError === 'function') {
            showError('Не удалось загрузить профиль пользователя');
        }
        return;
    }
    
    try {
        // Загружаем профиль пользователя из Supabase
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (error || !profile) {
            if (typeof showError === 'function') {
                showError('Профиль пользователя не найден');
            }
            return;
        }
        
        const userData = {
            id: profile.id,
            email: '',
            username: profile.username || 'Пользователь',
            avatar: profile.avatar || 'Fons/1 b.jpg',
            gender: profile.gender || 'male',
            registerDate: profile.created_at || null
        };
        
        await renderProfile(userData, true); // true = просмотр чужого профиля
        initFavoritesScroll();
    } catch (err) {
        console.error('Ошибка загрузки профиля пользователя:', err);
        if (typeof showError === 'function') {
            showError('Не удалось загрузить профиль пользователя');
        }
    }
}

async function loadProfile() {
    const user = await getCurrentUser();
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    
    // Базовые данные от Supabase Auth
    let finalUserData = {
        id: user.id,
        email: user.email || '',
        username: user.username || user.email?.split('@')[0] || 'Пользователь',
        avatar: user.avatar || 'Fons/1 b.jpg',
        gender: user.gender || 'male'
    };
    
    // Обогащаем из localStorage (favorites, watchHistory, settings)
    const localData = getUserData(user.id);
    if (localData) {
        finalUserData = {
            ...localData,
            id: user.id,
            email: user.email || localData.email || '',
            username: user.username || localData.username || user.email?.split('@')[0] || 'Пользователь',
            avatar: user.avatar || localData.avatar || 'Fons/1 b.jpg',
            gender: localData.gender || user.gender || 'male'
        };
    }
    
    // Дополнительно из Supabase profiles
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        try {
            const { data: profile, error } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            
            if (profile && !error) {
                finalUserData.username = profile.username || finalUserData.username;
                finalUserData.avatar = profile.avatar || finalUserData.avatar;
                finalUserData.gender = profile.gender || finalUserData.gender;
                if (profile.created_at) finalUserData.registerDate = profile.created_at;
            }
        } catch (err) {
            console.error('Ошибка загрузки профиля из Supabase:', err);
        }
    }
    
    await renderProfile(finalUserData);
    initFavoritesScroll();
}

// Глобальные переменные для аватаров пользователя
let currentUserAvatars = [];
let currentUserAchievements = [];
let currentUserGender = 'male';

// Проверка, является ли ID UUID
function isUUID(str) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
}

async function renderProfile(userData, isViewMode = false) {
    const container = document.getElementById('profileContainer');
    if (!container) return;
    
    // ID профиля, который смотрим
    const profileUserId = userData.id;
    const isUUIDFormat = profileUserId && isUUID(profileUserId.toString());

    // Для своего профиля загружаем данные текущего пользователя
    const currentUser = !isViewMode ? await getCurrentUser() : null;
    const ownUserId = currentUser ? currentUser.id : null;

    let userAchievements = [];
    let vipSubscription = null;
    let aiSubInfo = { type: 'free', isVip: false, expiresAt: null };
    let friendsList = [];
    let friendProfiles = [];

    if (!isViewMode && ownUserId && isUUID(ownUserId.toString()) && typeof window.achievementsService !== 'undefined') {
        userAchievements = await window.achievementsService.getUserAchievements(ownUserId);
    }

    if (!isViewMode) {
        currentUserAchievements = userAchievements;
        currentUserGender = userData.gender || 'male';
        currentUserAvatars = await getAvailableAvatarsForUser(ownUserId, currentUserGender, userAchievements);
    }

    if (typeof window.aiSubscriptionService !== 'undefined') {
        aiSubInfo = await window.aiSubscriptionService.getSubscriptionInfo(profileUserId);
    }

    if (isUUIDFormat && typeof supabaseClient !== 'undefined' && supabaseClient) {
        try {
            const { data: vipData } = await supabaseClient
                .from('vip_subscriptions').select('*')
                .eq('user_id', profileUserId).eq('is_active', true).maybeSingle();
            if (vipData) vipSubscription = vipData;

            const { data: friendsData } = await supabaseClient
                .from('friends').select('*')
                .or(`user_id.eq.${profileUserId},friend_id.eq.${profileUserId}`)
                .eq('status', 'accepted');
            friendsList = friendsData || [];

            // Загружаем профили друзей для плиток
            if (friendsList.length > 0) {
                const friendIds = friendsList.map(f =>
                    f.user_id === profileUserId ? f.friend_id : f.user_id
                ).filter(Boolean);
                const { data: profiles } = await supabaseClient
                    .from('profiles').select('id, username, avatar')
                    .in('id', friendIds);
                friendProfiles = profiles || [];
            }
        } catch (error) {
            console.error('Ошибка загрузки данных из Supabase:', error);
        }
    }

    const registerDate = userData.registerDate ? new Date(userData.registerDate).toLocaleDateString('ru-RU') : 'Неизвестно';

    // Избранное — для чужого профиля загружаем из Supabase
    let favoritesAnime = [];
    let favoritesManga = [];
    if (isViewMode && isUUIDFormat && supabaseClient) {
        try {
            const { data: favAnime } = await supabaseClient
                .from('favorites_anime').select('anime_id')
                .eq('user_id', profileUserId);
            if (favAnime) {
                favoritesAnime = favAnime.map(f => {
                    const anime = getAnimeById(parseInt(f.anime_id));
                    return anime ? (typeof initAnimeStats === 'function' ? initAnimeStats(anime) : anime) : null;
                }).filter(Boolean);
            }
            const { data: favManga } = await supabaseClient
                .from('favorites_manga').select('manga_id')
                .eq('user_id', profileUserId);
            if (favManga) {
                favoritesManga = favManga.map(f => {
                    return typeof getMangaById === 'function' ? getMangaById(parseInt(f.manga_id)) : null;
                }).filter(Boolean);
            }
        } catch (_) {}
    } else {
        const favorites = userData.favorites || [];
        const mangaFavs = userData.mangaFavorites || [];
        favoritesAnime = favorites.map(id => {
            const anime = getAnimeById(id);
            return anime ? (typeof initAnimeStats === 'function' ? initAnimeStats(anime) : anime) : null;
        }).filter(Boolean);
        favoritesManga = mangaFavs.map(id => {
            return typeof getMangaById === 'function' ? getMangaById(id) : null;
        }).filter(Boolean);
    }
    const totalFavorites = favoritesAnime.length + favoritesManga.length;

    // Аватар
    const creatorByEmail = (userData.email || '').toLowerCase() === 'creator@reminko.com';
    const creatorByName = (userData.username || '').toLowerCase() === 'creator@reminko.com'
        || (userData.username || '').toLowerCase() === 'creator';
    const isCreatorAccount = creatorByEmail || creatorByName;

    let avatarUrl = isCreatorAccount ? 'Fons/Creator ava.png' : (userData.avatar || 'Fons/1 b.jpg');
    if (!isViewMode) {
        const userAvatars = currentUserAvatars.length > 0 ? currentUserAvatars : availableAvatars;
        if (!isCreatorAccount && (!avatarUrl || !userAvatars.includes(avatarUrl))) {
            avatarUrl = getRandomAvatar();
            updateUserData(userData.id, { avatar: avatarUrl });
        }
    }
    const avatarUrlCss =
        typeof reminkoResolveAssetUrl === 'function' ? reminkoResolveAssetUrl(avatarUrl) : avatarUrl;
    const avatarStyle = isCreatorAccount
        ? `background-image: url('${avatarUrlCss.replace(/'/g, "\\'")}'); background-size: 92%; background-position: center 18%; width: 138px; height: 138px;`
        : `background-image: url('${avatarUrlCss.replace(/'/g, "\\'")}'); background-size: cover; background-position: center; width: 150px; height: 150px;`;

    // Время просмотра (для своего профиля из localStorage, для чужого из Supabase)
    let watchTimeLabel = '0 мин';
    if (!isViewMode) {
        const watchHistory = userData.watchHistory || [];
        const uniqueEpisodes = new Set();
        const uniqueChapters = new Set();
        watchHistory.forEach(entry => {
            if (entry.type === 'manga') {
                uniqueChapters.add(`${entry.mangaId || entry.animeId}-${entry.chapterNumber || entry.episodeNumber}`);
            } else {
                uniqueEpisodes.add(`${entry.animeId}-${entry.episodeNumber}`);
            }
        });
        const totalMinutes = (uniqueEpisodes.size * 24) + (uniqueChapters.size * 5);
        if (totalMinutes >= 60) {
            const hours = Math.floor(totalMinutes / 60);
            const mins = totalMinutes % 60;
            watchTimeLabel = mins > 0 ? `${hours} ч ${mins} мин` : `${hours} ч`;
        } else {
            watchTimeLabel = `${totalMinutes} мин`;
        }
    } else if (isUUIDFormat && supabaseClient) {
        try {
            const { data: watchedRows } = await supabaseClient
                .from('watch_history')
                .select('anime_id, episode_number')
                .eq('user_id', profileUserId);
            const uniqueEpisodes = new Set(
                (watchedRows || []).map(row => `${row.anime_id}-${row.episode_number}`)
            );
            const totalMinutes = uniqueEpisodes.size * 24;
            if (totalMinutes >= 60) {
                const hours = Math.floor(totalMinutes / 60);
                const mins = totalMinutes % 60;
                watchTimeLabel = mins > 0 ? `${hours} ч ${mins} мин` : `${hours} ч`;
            } else {
                watchTimeLabel = `${totalMinutes} мин`;
            }
        } catch (_) {}
    }

    const profileName = userData.username || 'Пользователь';

    function renderFavTiles(items, type) {
        return items.slice(0, 10).map(item => {
            const gradient = typeof generateGradient === 'function' ? generateGradient(item.id) : 'linear-gradient(135deg, #6c5ce7, #a29bfe)';
            const onclick = type === 'anime' ? `openAnimePage(${item.id})` : `openMangaPage(${item.id})`;
            const title = item.title || '';
            const shortTitle = title.length > 15 ? title.substring(0, 15) + '...' : title;
            const searchTitle = item.titleAlt || item.title || '';
            return `<div class="favorite-mini-card" onclick="${onclick}" title="${title}" data-fav-type="${type}" data-fav-title="${searchTitle.replace(/"/g, '&quot;')}">
                <div class="favorite-mini-poster" style="background: ${gradient};">
                    <div class="favorite-mini-year">${item.year || ''}</div>
                </div>
                <div class="favorite-mini-title">${shortTitle}</div>
            </div>`;
        }).join('');
    }

    function renderFriendTiles(profiles) {
        if (!profiles || profiles.length === 0) return '';
        return profiles.slice(0, 12).map(p => `
            <a href="profile.html?user=${p.id}" class="profile-friend-tile" title="${p.username || 'Пользователь'}">
                <img src="${(typeof reminkoResolveAssetUrl === 'function' ? reminkoResolveAssetUrl(p.avatar || 'Fons/1 b.jpg') : (p.avatar || '/Fons/1 b.jpg')).replace(/"/g, '&quot;')}" alt="" class="profile-friend-tile-avatar" onerror="this.onerror=null;this.src='/Fons/1 b.jpg'">
                <div class="profile-friend-tile-name">${(p.username || 'Пользователь').length > 10 ? (p.username || '').substring(0, 10) + '…' : (p.username || 'Пользователь')}</div>
            </a>
        `).join('');
    }

    function friendsCountWord(n) {
        if (n === 1) return 'друг';
        if (n >= 2 && n <= 4) return 'друга';
        return 'друзей';
    }

    // VIP бейджи для имени
    let vipBadge = '';
    if (isCreatorAccount) {
        vipBadge = '<img class="profile-creator-badge" src="Fons/creator znak.png" alt="Создатель" title="Создатель сайта" onerror="this.onerror=null;this.src=\'Fons/Creator ava.png\'">';
        if (!isViewMode) {
            vipBadge +=
                '<span class="profile-vip-badge" title="Minko AI — без ограничений, навсегда">⭐ AI</span>';
            vipBadge +=
                '<span class="profile-vip-badge" title="VIP «Смотреть вместе» — навсегда">🎬 Watch</span>';
        }
    } else if (!isViewMode) {
        if (aiSubInfo.isVip) vipBadge += '<span class="profile-vip-badge" title="VIP Minko AI">⭐ AI</span>';
        if (vipSubscription && vipSubscription.is_active) vipBadge += '<span class="profile-vip-badge" title="VIP Просмотр вместе">🎬 Watch</span>';
    }

    container.innerHTML = `
        <div class="profile-modern">
            <div class="profile-top">
                <div class="profile-avatar-wrap">
                    <div class="profile-avatar" id="profileAvatar" style="${avatarStyle}" ${!isViewMode ? 'onclick="openAvatarPicker()"' : ''}></div>
                    ${!isViewMode ? `
                        <button class="avatar-change-btn" onclick="openAvatarPicker()" title="Сменить аватар">
                            ✎
                        </button>
                    ` : ''}
                </div>
                <div class="profile-head-main">
                    <h1 class="profile-name">${profileName} ${vipBadge}</h1>
                    ${!isViewMode ? `<p class="profile-email">${userData.email || ''}</p>` : ''}
                </div>
                <div class="profile-actions-row">
                    ${!isViewMode ? `
                        <button class="btn btn-primary" onclick="editProfile()">Редактировать</button>
                        <button class="btn btn-secondary" onclick="openSettingsModal()">Настройки</button>
                    ` : `
                        <a href="messages.html?user=${profileUserId}" class="btn btn-secondary">Написать</a>
                    `}
                </div>
            </div>

            <div class="profile-stats">
                <div class="stat-card">
                    <div class="stat-value">${totalFavorites}</div>
                    <div class="stat-label">В избранном</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${watchTimeLabel}</div>
                    <div class="stat-label">Время просмотра</div>
                </div>
            </div>

            <div class="profile-tabs">
                <button class="profile-tab-btn active" data-tab-target="profileTabFavorites">Избранное</button>
                <button class="profile-tab-btn" data-tab-target="profileTabInfo">Инфо</button>
                ${!isViewMode ? `<button class="profile-tab-btn" data-tab-target="profileTabFriends">Друзья</button>` : ''}
                ${!isViewMode ? `<button class="profile-tab-btn" data-tab-target="profileTabServices">Услуги</button>` : ''}
            </div>

            <div class="profile-tab-content active" id="profileTabFavorites">
                <div class="profile-section">
                    <div class="profile-section-header">
                        <h2 class="section-title">${isViewMode ? `Избранное аниме ${profileName}` : 'Избранное аниме'}</h2>
                        ${!isViewMode ? '<a href="favorites.html" class="btn btn-primary btn-sm">Все избранное</a>' : ''}
                    </div>
                    ${favoritesAnime.length > 0 ? `
                        <div class="favorites-tiles-row">${renderFavTiles(favoritesAnime, 'anime')}</div>
                    ` : `<div class="empty-favorites"><p>${isViewMode ? 'Нет избранных аниме' : 'У вас пока нет избранных аниме'}</p></div>`}
                </div>
                <div class="profile-section">
                    <div class="profile-section-header">
                        <h2 class="section-title">${isViewMode ? `Избранная манга ${profileName}` : 'Избранная манга'}</h2>
                        ${!isViewMode ? '<a href="favorites-manga.html" class="btn btn-primary btn-sm">Все избранное</a>' : ''}
                    </div>
                    ${favoritesManga.length > 0 ? `
                        <div class="favorites-tiles-row">${renderFavTiles(favoritesManga, 'manga')}</div>
                    ` : `<div class="empty-favorites"><p>${isViewMode ? 'Нет избранных манг' : 'У вас пока нет избранных манг'}</p></div>`}
                </div>
            </div>

            <div class="profile-tab-content" id="profileTabInfo">
                <div class="profile-section">
                    <h2 class="section-title">Информация</h2>
                    ${!isViewMode && userData.email ? `<div class="profile-info-item">
                        <span class="info-label">Email:</span>
                        <span class="info-value">${userData.email}</span>
                    </div>` : ''}
                    <div class="profile-info-item">
                        <span class="info-label">Дата регистрации:</span>
                        <span class="info-value">${registerDate}</span>
                    </div>
                </div>
            </div>

            ${!isViewMode ? `
            <div class="profile-tab-content" id="profileTabFriends">
                <div class="profile-section">
                    <div class="profile-section-header">
                        <h2 class="section-title">Друзья</h2>
                        <a href="friends.html" class="btn btn-primary btn-sm">Управление</a>
                    </div>
                    ${friendsList.length > 0 ? `
                        <div class="friends-count-info">У вас ${friendsList.length} ${friendsCountWord(friendsList.length)}</div>
                        <div class="profile-friends-grid">
                            ${renderFriendTiles(friendProfiles)}
                        </div>
                    ` : `
                        <div class="empty-favorites">
                            <p>У вас пока нет друзей</p>
                            <a href="friends.html" class="btn btn-primary" style="margin-top: 1rem;">Найти друзей</a>
                        </div>
                    `}
                </div>
            </div>
            ` : ''}
            ${!isViewMode ? `
            <div class="profile-tab-content" id="profileTabServices">
                <div class="profile-section">
                    <h2 class="section-title">Услуги</h2>
                    <div class="vip-cards-grid">
                        <div class="vip-card vip-card-ai">
                            <div class="vip-card-icon">⭐</div>
                            <h3 class="vip-card-title">VIP Minko AI</h3>
                            ${isCreatorAccount ? `
                                <p class="vip-card-desc vip-active-label">Активна навсегда</p>
                                <p class="vip-card-desc" style="font-size:0.88rem;opacity:0.88;">Для учётной записи создателя тариф без срока и без оплаты.</p>
                            ` : aiSubInfo.isVip ? `
                                <p class="vip-card-desc vip-active-label">Подписка активна</p>
                                <a href="https://billing.stripe.com/p/login/dRm00keVF91mfZz1EmcEw00" class="btn btn-danger vip-card-btn" target="_blank">Управление</a>
                            ` : `
                                <p class="vip-card-desc">Полная скорость и точность ответов Minko.</p>
                                <a href="https://buy.stripe.com/5kQ9AUdRB7Xi8x71EmcEw06?client_reference_id=${ownUserId || ''}" class="btn btn-primary vip-card-btn">Купить VIP AI</a>
                            `}
                        </div>
                        <div class="vip-card vip-card-watch">
                            <div class="vip-card-icon">🎬</div>
                            <h3 class="vip-card-title">VIP Смотреть вместе</h3>
                            ${isCreatorAccount ? `
                                <p class="vip-card-desc vip-active-label">Активна навсегда</p>
                                <p class="vip-card-desc" style="font-size:0.88rem;opacity:0.88;">Создание комнат и лимиты для создателя сайта без записи в базе подписок.</p>
                            ` : (vipSubscription && vipSubscription.is_active) ? `
                                <p class="vip-card-desc vip-active-label">Подписка активна</p>
                                <a href="https://billing.stripe.com/p/login/dRm00keVF91mfZz1EmcEw00" class="btn btn-danger vip-card-btn" target="_blank">Управление</a>
                            ` : `
                                <p class="vip-card-desc">Создание комнаты и расширенные лимиты в Watch Together.</p>
                                <a href="https://buy.stripe.com/6oU5kEbJt1yUdRrbeWcEw09?client_reference_id=${ownUserId || ''}" class="btn btn-primary vip-card-btn">Купить VIP Watch</a>
                            `}
                        </div>
                    </div>
                </div>
            </div>
            ` : ''}
        </div>
    `;
    const tabParam = new URLSearchParams(window.location.search).get('tab');
    initProfileTabs(tabParam);
}

function initProfileTabs(defaultTab = null) {
    const buttons = document.querySelectorAll('.profile-tab-btn');
    const tabs = document.querySelectorAll('.profile-tab-content');
    if (!buttons.length || !tabs.length) return;

    const normalizedMap = {
        favorites: 'profileTabFavorites',
        posts: 'profileTabFavorites',
        info: 'profileTabInfo',
        friends: 'profileTabFriends',
        services: 'profileTabServices'
    };
    const resolvedDefault = defaultTab
        ? (normalizedMap[defaultTab.toLowerCase()] || defaultTab)
        : 'profileTabFavorites';

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.tabTarget;
            if (!targetId) return;
            const target = document.getElementById(targetId);
            if (!target) return;

            buttons.forEach(b => b.classList.remove('active'));
            tabs.forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            target.classList.add('active');
        });
    });

    if (resolvedDefault) {
        const targetBtn = Array.from(buttons).find(b => b.dataset.tabTarget === resolvedDefault);
        if (targetBtn) targetBtn.click();
    }
}

// Функции для просмотра вместе
async function createWatchTogetherSession() {
    if (typeof window.watchTogetherService !== 'undefined') {
        const user = await getCurrentUser();
        if (!user) return;
        
        const result = await window.watchTogetherService.createSession(user.id);
        if (result.success) {
            alert(`Сессия создана! Код для друзей: ${result.code}`);
        } else {
            alert(result.message || 'Не удалось создать сессию');
        }
    } else {
        alert('Функция в разработке');
    }
}

async function joinWatchTogetherSession() {
    const code = prompt('Введите код сессии:');
    if (!code) return;
    
    if (typeof window.watchTogetherService !== 'undefined') {
        const user = await getCurrentUser();
        if (!user) return;
        
        const result = await window.watchTogetherService.joinSession(user.id, code);
        if (result.success) {
            alert('Вы присоединились к сессии!');
        } else {
            alert(result.message || 'Не удалось присоединиться к сессии');
        }
    } else {
        alert('Функция в разработке');
    }
}

window.createWatchTogetherSession = createWatchTogetherSession;
window.joinWatchTogetherSession = joinWatchTogetherSession;

async function openAvatarPicker() {
    const modal = document.getElementById('avatarModal');
    if (!modal) return;
    
    const grid = document.getElementById('avatarGrid');
    if (!grid) return;
    
    const user = await getCurrentUser();
    if (!user) return;
    
    let avatarsToShow = availableAvatars;
    
    // Если у нас есть сохраненные данные - используем их, иначе загружаем заново
    if (currentUserAvatars.length > 0) {
        avatarsToShow = currentUserAvatars;
    } else {
        const userData = getUserData(user.id);
        const gender = userData?.gender || 'male';
        // Загружаем ачивки только если ID - UUID (для Supabase)
        const userId = user.id;
        const isUUIDFormat = userId && isUUID(userId.toString());
        let achievements = currentUserAchievements;
        if (achievements.length === 0 && isUUIDFormat && typeof window.achievementsService !== 'undefined') {
            achievements = await window.achievementsService.getUserAchievements(userId);
        }
        avatarsToShow = await getAvailableAvatarsForUser(userId, gender, achievements);
        currentUserAvatars = avatarsToShow;
    }
    
    // Показываем все доступные аватары
    grid.innerHTML = avatarsToShow.map((avatarPath, index) => {
        // Используем путь как data-атрибут для точного соответствия
        const encodedPath = encodeURIComponent(avatarPath);
        const cssUrl =
            typeof reminkoResolveAssetUrl === 'function'
                ? reminkoResolveAssetUrl(avatarPath).replace(/'/g, "\\'")
                : String(avatarPath).replace(/'/g, "\\'");
        return `
            <div class="avatar-option" style="background-image: url('${cssUrl}'); background-size: cover; background-position: center;" data-avatar-path="${encodedPath}" onclick="selectAvatarByPath('${encodedPath}')"></div>
        `;
    }).join('');
    
    modal.classList.add('active');
}

// Выбрать аватар по пути (новая функция)
async function selectAvatarByPath(encodedPath) {
    const user = await getCurrentUser();
    if (!user) return;
    
    const avatarPath = decodeURIComponent(encodedPath);
    const avatarOption = document.querySelector(`[data-avatar-path="${encodedPath}"]`);
    
    if (avatarOption) {
        // Убираем выделение с других
        document.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('selected'));
        avatarOption.classList.add('selected');
        
        // Сохраняем аватар
        updateUserData(user.id, { avatar: avatarPath });
        
        // Обновляем аватар в профиле немедленно
        const profileAvatar = document.getElementById('profileAvatar');
        if (profileAvatar) {
            profileAvatar.style.backgroundImage = `url('${avatarPath}')`;
            profileAvatar.style.backgroundSize = 'cover';
            profileAvatar.style.backgroundPosition = 'center';
            profileAvatar.style.backgroundRepeat = 'no-repeat';
        }
        
        // Закрываем модальное окно через секунду
        setTimeout(() => {
            const modal = document.getElementById('avatarModal');
            if (modal) modal.classList.remove('active');
            if (typeof showSuccess === 'function') {
                showSuccess('Аватар изменён');
            }
        }, 500);
    }
}

// Обратная совместимость - используем новую функцию
function selectAvatarByIndex(index) {
    if (currentUserAvatars.length > 0 && index >= 0 && index < currentUserAvatars.length) {
        const avatarPath = currentUserAvatars[index];
        const encodedPath = encodeURIComponent(avatarPath);
        selectAvatarByPath(encodedPath);
    } else if (index >= 0 && index < availableAvatars.length) {
        const avatarPath = availableAvatars[index];
        const encodedPath = encodeURIComponent(avatarPath);
        selectAvatarByPath(encodedPath);
    }
}

// Обратная совместимость
function selectAvatar(avatarPath) {
    const encodedPath = encodeURIComponent(avatarPath);
    selectAvatarByPath(encodedPath);
}

function initAvatarPicker() {
    const closeBtn = document.getElementById('closeAvatarModal');
    const modal = document.getElementById('avatarModal');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (modal) modal.classList.remove('active');
        });
    }
    
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    }
}

// Функция прокрутки избранного аниме
function scrollAnimeFavorites(direction) {
    const grid = document.getElementById('animeFavoritesPreviewGrid');
    if (!grid) return;
    
    const user = getCurrentUserSync();
    if (!user) return;
    
    const userData = getUserData(user.id);
    if (!userData) return;
    
    const favorites = userData.favorites || [];
    const totalPages = Math.ceil(favorites.length / favoritesPerPage);
    
    if (direction === 'left') {
        if (currentFavoritesPage > 0) {
            currentFavoritesPage--;
        }
    } else {
        if (currentFavoritesPage < totalPages - 1) {
            currentFavoritesPage++;
        }
    }
    
    // Перерисовываем сетку
    renderAnimeFavoritesGrid(grid, favorites, currentFavoritesPage);
    updateAnimeFavoritesScrollButtons(favorites.length);
}

// Функция прокрутки избранного манги
function scrollMangaFavorites(direction) {
    const grid = document.getElementById('mangaFavoritesPreviewGrid');
    if (!grid) return;
    
    const user = getCurrentUserSync();
    if (!user) return;
    
    const userData = getUserData(user.id);
    if (!userData) return;
    
    const mangaFavorites = userData.mangaFavorites || [];
    const totalPages = Math.ceil(mangaFavorites.length / mangaFavoritesPerPage);
    
    if (direction === 'left') {
        if (currentMangaFavoritesPage > 0) {
            currentMangaFavoritesPage--;
        }
    } else {
        if (currentMangaFavoritesPage < totalPages - 1) {
            currentMangaFavoritesPage++;
        }
    }
    
    // Перерисовываем сетку
    renderMangaFavoritesGrid(grid, mangaFavorites, currentMangaFavoritesPage);
    updateMangaFavoritesScrollButtons(mangaFavorites.length);
}

// Рендеринг сетки избранного аниме
function renderAnimeFavoritesGrid(container, favorites, page) {
    const startIndex = page * favoritesPerPage;
    const endIndex = startIndex + favoritesPerPage;
    const pageFavorites = favorites.slice(startIndex, endIndex);
    
    container.innerHTML = pageFavorites.map(animeId => {
        const anime = getAnimeById(animeId);
        if (!anime) return '';
        const gradient = generateGradient(anime.id);
        return `
            <div class="favorite-mini-card" onclick="openAnimePage(${anime.id})" title="${anime.title}">
                <div class="favorite-mini-poster" style="background: ${gradient};">
                    <div class="favorite-mini-year">${anime.year}</div>
                </div>
                <div class="favorite-mini-title">${anime.title.length > 15 ? anime.title.substring(0, 15) + '...' : anime.title}</div>
            </div>
        `;
    }).join('');
    
    // Заполняем пустые ячейки, если нужно
    const emptyCells = favoritesPerPage - pageFavorites.length;
    for (let i = 0; i < emptyCells; i++) {
        container.innerHTML += '<div class="favorite-mini-card" style="visibility: hidden;"></div>';
    }
}

// Рендеринг сетки избранного манги
function renderMangaFavoritesGrid(container, mangaFavorites, page) {
    const startIndex = page * mangaFavoritesPerPage;
    const endIndex = startIndex + mangaFavoritesPerPage;
    const pageFavorites = mangaFavorites.slice(startIndex, endIndex);
    
    container.innerHTML = pageFavorites.map(mangaId => {
        const manga = typeof getMangaById === 'function' ? getMangaById(mangaId) : null;
        if (!manga) return '';
        const gradient = generateGradient(manga.id);
        return `
            <div class="favorite-mini-card" onclick="openMangaPage(${manga.id})" title="${manga.title}">
                <div class="favorite-mini-poster" style="background: ${gradient};">
                    <div class="favorite-mini-year">${manga.year}</div>
                </div>
                <div class="favorite-mini-title">${manga.title.length > 15 ? manga.title.substring(0, 15) + '...' : manga.title}</div>
            </div>
        `;
    }).join('');
    
    // Заполняем пустые ячейки, если нужно
    const emptyCells = mangaFavoritesPerPage - pageFavorites.length;
    for (let i = 0; i < emptyCells; i++) {
        container.innerHTML += '<div class="favorite-mini-card" style="visibility: hidden;"></div>';
    }
}

// Обновление видимости кнопок прокрутки аниме
function updateAnimeFavoritesScrollButtons(totalFavorites) {
    const leftBtn = document.getElementById('animeFavoritesScrollLeft');
    const rightBtn = document.getElementById('animeFavoritesScrollRight');
    
    if (!leftBtn || !rightBtn) return;
    
    const totalPages = Math.ceil(totalFavorites / favoritesPerPage);
    
    if (currentFavoritesPage > 0) {
        leftBtn.style.display = 'flex';
        leftBtn.style.opacity = '1';
    } else {
        leftBtn.style.display = 'none';
    }
    
    if (currentFavoritesPage < totalPages - 1) {
        rightBtn.style.display = 'flex';
        rightBtn.style.opacity = '1';
    } else {
        rightBtn.style.display = 'none';
    }
}

// Обновление видимости кнопок прокрутки манги
function updateMangaFavoritesScrollButtons(totalFavorites) {
    const leftBtn = document.getElementById('mangaFavoritesScrollLeft');
    const rightBtn = document.getElementById('mangaFavoritesScrollRight');
    
    if (!leftBtn || !rightBtn) return;
    
    const totalPages = Math.ceil(totalFavorites / mangaFavoritesPerPage);
    
    if (currentMangaFavoritesPage > 0) {
        leftBtn.style.display = 'flex';
        leftBtn.style.opacity = '1';
    } else {
        leftBtn.style.display = 'none';
    }
    
    if (currentMangaFavoritesPage < totalPages - 1) {
        rightBtn.style.display = 'flex';
        rightBtn.style.opacity = '1';
    } else {
        rightBtn.style.display = 'none';
    }
}

// Сохранение настройки
// options.silent = true — не показывать уведомление «Настройка сохранена» (если вызывающий уже показывает своё)
function saveSetting(key, value, options) {
    const user = getCurrentUserSync();
    if (!user) return;

    const userData =
        typeof ensureUserDataRecord === 'function'
            ? ensureUserDataRecord(user.id)
            : getUserData(user.id);
    if (!userData) return;
    
    if (!userData.settings) {
        userData.settings = {};
    }
    
    userData.settings[key] = value;
    updateUserData(user.id, { settings: userData.settings });
    if (!(options && options.silent) && typeof showSuccess === 'function') showSuccess('Настройка сохранена');
}

function initFavoritesScroll() {
    loadFavoritePosters();
}

async function loadFavoritePosters() {
    const cards = document.querySelectorAll('.favorite-mini-card[data-fav-title]');
    if (!cards.length) return;
    
    for (const card of cards) {
        const title = card.dataset.favTitle;
        const type = card.dataset.favType || 'anime';
        if (!title) continue;
        
        const posterEl = card.querySelector('.favorite-mini-poster');
        if (!posterEl) continue;
        
        try {
            let posterUrl = null;
            if (type === 'anime' && typeof getAnimePosterFast === 'function') {
                posterUrl = await getAnimePosterFast(title);
            } else if (type === 'manga' && typeof getMangaPosterFast === 'function') {
                posterUrl = await getMangaPosterFast(title);
            }
            
            if (posterUrl && posterUrl !== POSTER_PLACEHOLDER) {
                const img = new Image();
                img.onload = () => {
                    posterEl.style.backgroundImage = `url('${posterUrl}')`;
                    posterEl.style.backgroundSize = 'cover';
                    posterEl.style.backgroundPosition = 'center';
                };
                img.src = posterUrl;
            }
        } catch {}
    }
}

// Глобальные функции
window.openAvatarPicker = openAvatarPicker;
window.selectAvatar = selectAvatar;
window.selectAvatarByIndex = selectAvatarByIndex;
window.selectAvatarByPath = selectAvatarByPath;
window.scrollAnimeFavorites = scrollAnimeFavorites;
window.scrollMangaFavorites = scrollMangaFavorites;
window.saveSetting = saveSetting;
window.openSettingsModal = typeof openSettingsModal !== 'undefined' ? openSettingsModal : function() {};
