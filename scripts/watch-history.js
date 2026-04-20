// Функции для управления историей просмотров

function addToWatchHistory(animeId, episodeNumber) {
    if (!isAuthenticatedSync()) return;
    
    const user = getCurrentUserSync();
    if (!user) return;
    
    const userData = getUserData(user.id);
    if (!userData) return;
    
    if (!userData.watchHistory) {
        userData.watchHistory = [];
    }
    
    const animeIdInt = parseInt(animeId);
    const episodeNum = parseInt(episodeNumber);
    
    userData.watchHistory = userData.watchHistory.filter(
        entry => !(entry.animeId === animeIdInt && entry.episodeNumber === episodeNum)
    );
    
    userData.watchHistory.unshift({
        animeId: animeIdInt,
        episodeNumber: episodeNum,
        watchedAt: new Date().toISOString(),
        type: 'anime'
    });
    
    if (userData.watchHistory.length > 500) {
        userData.watchHistory = userData.watchHistory.slice(0, 500);
    }
    
    updateUserData(user.id, { watchHistory: userData.watchHistory });
}

function addToMangaHistory(mangaId, chapterNumber) {
    if (!isAuthenticatedSync()) return;
    
    const user = getCurrentUserSync();
    if (!user) return;
    
    const userData = getUserData(user.id);
    if (!userData) return;
    
    if (!userData.mangaHistory) {
        userData.mangaHistory = [];
    }
    
    const mangaIdInt = parseInt(mangaId);
    const chapterNum = parseInt(chapterNumber);
    
    userData.mangaHistory = userData.mangaHistory.filter(
        entry => !(entry.mangaId === mangaIdInt && entry.chapterNumber === chapterNum)
    );
    
    userData.mangaHistory.unshift({
        mangaId: mangaIdInt,
        chapterNumber: chapterNum,
        watchedAt: new Date().toISOString(),
        type: 'manga'
    });
    
    if (userData.mangaHistory.length > 500) {
        userData.mangaHistory = userData.mangaHistory.slice(0, 500);
    }
    
    updateUserData(user.id, { mangaHistory: userData.mangaHistory });
}

function getWatchHistory(userId) {
    const userData = getUserData(userId);
    if (!userData || !userData.watchHistory) {
        return [];
    }
    return userData.watchHistory;
}

function getMangaHistory(userId) {
    const userData = getUserData(userId);
    if (!userData || !userData.mangaHistory) {
        return [];
    }
    return userData.mangaHistory;
}

function getLastWatchedEpisode(animeId) {
    if (!isAuthenticatedSync()) return null;
    
    const user = getCurrentUserSync();
    if (!user) return null;
    
    const history = getWatchHistory(user.id);
    const animeIdInt = parseInt(animeId);
    
    const entry = history.find(entry => entry.animeId === animeIdInt && entry.type === 'anime');
    return entry ? entry.episodeNumber : null;
}

function getLastReadChapter(mangaId) {
    if (!isAuthenticatedSync()) return null;
    
    const user = getCurrentUserSync();
    if (!user) return null;
    
    const history = getMangaHistory(user.id);
    const mangaIdInt = parseInt(mangaId);
    
    const entry = history.find(entry => entry.mangaId === mangaIdInt && entry.type === 'manga');
    return entry ? entry.chapterNumber : null;
}

function clearWatchHistory() {
    if (!isAuthenticatedSync()) return;
    
    const user = getCurrentUserSync();
    if (!user) return;
    
    updateUserData(user.id, { watchHistory: [] });
}

function clearMangaHistory() {
    if (!isAuthenticatedSync()) return;
    
    const user = getCurrentUserSync();
    if (!user) return;
    
    updateUserData(user.id, { mangaHistory: [] });
}
