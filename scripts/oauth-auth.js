// OAuth авторизация (Google, Facebook, Discord)

// Авторизация через Google
async function signInWithGoogle() {
    if (!supabaseClient) {
        showError('Supabase не инициализирован');
        return;
    }

    try {
        // Динамический URL для OAuth редиректа (работает на любом домене, включая GitHub Pages)
        const redirectPath = window.location.pathname.replace(/\/[^/]*$/, '') || '';
        const redirectUrl = window.location.origin + redirectPath;
        
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl
            }
        });

        if (error) {
            console.error('Ошибка Google авторизации:', error);
            showError('Не удалось войти через Google');
        }
    } catch (error) {
        console.error('Ошибка Google авторизации:', error);
        showError('Ошибка авторизации');
    }
}

// Авторизация через Facebook
async function signInWithFacebook() {
    if (!supabaseClient) {
        showError('Supabase не инициализирован');
        return;
    }

    try {
        // Динамический URL для OAuth редиректа (работает на любом домене, включая GitHub Pages)
        const redirectPath = window.location.pathname.replace(/\/[^/]*$/, '') || '';
        const redirectUrl = window.location.origin + redirectPath;
        
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'facebook',
            options: {
                redirectTo: redirectUrl
            }
        });

        if (error) {
            console.error('Ошибка Facebook авторизации:', error);
            showError('Не удалось войти через Facebook');
        }
    } catch (error) {
        console.error('Ошибка Facebook авторизации:', error);
        showError('Ошибка авторизации');
    }
}

// Авторизация через Discord
async function signInWithDiscord() {
    if (!supabaseClient) {
        showError('Supabase не инициализирован');
        return;
    }

    try {
        // Динамический URL для OAuth редиректа (работает на любом домене, включая GitHub Pages)
        const redirectPath = window.location.pathname.replace(/\/[^/]*$/, '') || '';
        const redirectUrl = window.location.origin + redirectPath;
        
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'discord',
            options: {
                redirectTo: redirectUrl
            }
        });

        if (error) {
            console.error('Ошибка Discord авторизации:', error);
            showError('Не удалось войти через Discord');
        }
    } catch (error) {
        console.error('Ошибка Discord авторизации:', error);
        showError('Ошибка авторизации');
    }
}

// Авторизация через Telegram обрабатывается в telegram-auth.js
// Старая функция удалена

// Обработка OAuth callback
async function handleOAuthCallback() {
    if (!supabaseClient) return;

    try {
        const { data, error } = await supabaseClient.auth.getSession();
        
        if (error) {
            console.error('Ошибка получения сессии:', error);
            return;
        }

        if (data.session) {
            // Пользователь успешно авторизован
            const user = data.session.user;
            
            // Проверяем существует ли профиль
            const { data: profile } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            // Если профиля нет - создаем
            if (!profile) {
                const email = user.email || '';
                const username = user.user_metadata?.full_name || 
                               email.split('@')[0] || 
                               `user_${user.id.slice(0, 8)}`;
                
                await supabaseClient
                    .from('profiles')
                    .insert({
                        id: user.id,
                        username: username,
                        avatar: user.user_metadata?.avatar_url || ''
                    });
            }

            // Обновляем состояние авторизации
            if (typeof updateAuthState === 'function') {
                updateAuthState();
            }

            // Редирект на главную или закрытие модалки
            const loginModal = document.getElementById('loginModal');
            if (loginModal) {
                loginModal.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Ошибка обработки OAuth callback:', error);
    }
}

// Инициализация OAuth обработчиков
function initOAuthHandlers() {
    // Обработчик для Google кнопки
    const googleLoginBtn = document.getElementById('googleLogin');
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', signInWithGoogle);
    }

    // Обработчик для Facebook кнопки
    const facebookLoginBtn = document.getElementById('facebookLogin');
    if (facebookLoginBtn) {
        facebookLoginBtn.addEventListener('click', signInWithFacebook);
    }

    // Обработчик для Discord кнопки
    const discordLoginBtn = document.getElementById('discordLogin');
    if (discordLoginBtn) {
        discordLoginBtn.addEventListener('click', signInWithDiscord);
    }

    // Обработка callback при загрузке страницы
    window.addEventListener('load', handleOAuthCallback);
    
    // Слушаем изменения авторизации
    if (supabaseClient) {
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                handleOAuthCallback();
            }
        });
    }
}

// Инициализация при загрузке DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOAuthHandlers);
} else {
    initOAuthHandlers();
}

