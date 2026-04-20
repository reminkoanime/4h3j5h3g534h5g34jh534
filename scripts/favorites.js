// Страница избранного

document.addEventListener('DOMContentLoaded', async () => {
    // Проверка авторизации
    if (!(typeof isAuthenticated === 'function' && await isAuthenticated())) {
        window.location.href = 'index.html';
        return;
    }
    
    await loadFavorites();
});

async function loadFavorites() {
    const user = typeof getCurrentUser === 'function' ? await getCurrentUser() : null;
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    
    const userData = getUserData(user.id);
    if (!userData) {
        window.location.href = 'index.html';
        return;
    }
    
    const favorites = userData.favorites || [];
    
    if (favorites.length === 0) {
        document.getElementById('favoritesGrid').style.display = 'none';
        document.getElementById('emptyFavorites').style.display = 'block';
        return;
    }
    
    document.getElementById('favoritesGrid').style.display = 'grid';
    document.getElementById('emptyFavorites').style.display = 'none';
    
    const container = document.getElementById('favoritesGrid');
    container.innerHTML = '';
    
    favorites.forEach(id => {
        const anime = getAnimeById(id);
        if (anime) {
            const card = createAnimeCard(anime);
            container.appendChild(card);
        }
    });
}

