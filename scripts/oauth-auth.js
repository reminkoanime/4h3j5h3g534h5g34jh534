// OAuth авторизация (Google, Facebook, Discord)
// Кнопки входа создаются динамически в navigation.js — обработчики через делегирование на document.

/**
 * URL редиректа после OAuth (должен совпадать с Redirect URLs в Supabase Dashboard).
 * Берём «каталог» текущей страницы: /repo/page.html → https://host/repo/
 */
function reminkoOAuthRedirectUrl() {
    const { origin, pathname } = window.location;
    if (!pathname || pathname === '/') {
        return origin + '/';
    }
    const idx = pathname.lastIndexOf('/');
    const base = idx <= 0 ? '/' : pathname.slice(0, idx + 1);
    return origin + base;
}

const REMINKO_OAUTH_PENDING_KEY = 'reminko_oauth_pending';

function reminkoMarkOAuthRedirectPending() {
    try {
        sessionStorage.setItem(REMINKO_OAUTH_PENDING_KEY, '1');
    } catch (_) {
        /* ignore */
    }
}

function reminkoConsumeOAuthRedirectPending() {
    try {
        const v = sessionStorage.getItem(REMINKO_OAUTH_PENDING_KEY);
        if (v) {
            sessionStorage.removeItem(REMINKO_OAUTH_PENDING_KEY);
            return true;
        }
    } catch (_) {
        /* ignore */
    }
    return false;
}

// Авторизация через Google
async function signInWithGoogle() {
    if (!supabaseClient) {
        if (typeof showError === 'function') showError('Supabase не инициализирован');
        return;
    }

    try {
        reminkoMarkOAuthRedirectPending();
        const redirectTo = reminkoOAuthRedirectUrl();
        const { error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo
            }
        });

        if (error) {
            console.error('Ошибка Google авторизации:', error);
            if (typeof showError === 'function') {
                showError(error.message || 'Не удалось войти через Google');
            }
        }
    } catch (error) {
        console.error('Ошибка Google авторизации:', error);
        if (typeof showError === 'function') showError('Ошибка авторизации');
    }
}

// Авторизация через Facebook
async function signInWithFacebook() {
    if (!supabaseClient) {
        if (typeof showError === 'function') showError('Supabase не инициализирован');
        return;
    }

    try {
        reminkoMarkOAuthRedirectPending();
        const { error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'facebook',
            options: {
                redirectTo: reminkoOAuthRedirectUrl()
            }
        });

        if (error) {
            console.error('Ошибка Facebook авторизации:', error);
            if (typeof showError === 'function') showError('Не удалось войти через Facebook');
        }
    } catch (error) {
        console.error('Ошибка Facebook авторизации:', error);
        if (typeof showError === 'function') showError('Ошибка авторизации');
    }
}

// Авторизация через Discord
async function signInWithDiscord() {
    if (!supabaseClient) {
        if (typeof showError === 'function') showError('Supabase не инициализирован');
        return;
    }

    try {
        reminkoMarkOAuthRedirectPending();
        const { error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'discord',
            options: {
                redirectTo: reminkoOAuthRedirectUrl()
            }
        });

        if (error) {
            console.error('Ошибка Discord авторизации:', error);
            if (typeof showError === 'function') showError('Не удалось войти через Discord');
        }
    } catch (error) {
        console.error('Ошибка Discord авторизации:', error);
        if (typeof showError === 'function') showError('Ошибка авторизации');
    }
}

/** После OAuth: профиль в БД и закрытие модалки входа */
async function handleOAuthCallback() {
    if (!supabaseClient) return;

    try {
        const {
            data: { session },
            error
        } = await supabaseClient.auth.getSession();

        if (error) {
            console.error('Ошибка получения сессии:', error);
            return;
        }

        if (!session || !session.user) {
            try {
                sessionStorage.removeItem(REMINKO_OAUTH_PENDING_KEY);
            } catch (_) {
                /* ignore */
            }
            return;
        }

        const showOAuthToast = reminkoConsumeOAuthRedirectPending();

        const user = session.user;
        const meta = user.user_metadata || {};
        const email = user.email || '';
        const avatarUrl =
            meta.avatar_url ||
            meta.picture ||
            meta.picture_url ||
            '';
        const displayName =
            meta.full_name ||
            meta.name ||
            meta.user_name ||
            (email ? email.split('@')[0] : '') ||
            `user_${user.id.slice(0, 8)}`;

        try {
            const { data: profile } = await supabaseClient
                .from('profiles')
                .select('id, username, avatar')
                .eq('id', user.id)
                .maybeSingle();

            const username = profile?.username || displayName;
            const avatar = profile?.avatar || avatarUrl || 'Fons/1 b.jpg';

            if (!profile) {
                const { error: upsertErr } = await supabaseClient.from('profiles').upsert(
                    {
                        id: user.id,
                        username,
                        avatar: avatar || 'Fons/1 b.jpg',
                        gender: 'male'
                    },
                    { onConflict: 'id' }
                );
                if (upsertErr) {
                    console.warn('[OAuth] Профиль:', upsertErr);
                }
            } else if (avatarUrl && (!profile.avatar || profile.avatar === '')) {
                await supabaseClient
                    .from('profiles')
                    .update({ avatar: avatarUrl })
                    .eq('id', user.id);
            }
        } catch (profileErr) {
            console.warn('[OAuth] Ошибка профиля:', profileErr);
        }

        if (typeof window.reminkoSyncAuthStorage === 'function') {
            window.reminkoSyncAuthStorage(session);
        }

        const loginModal = document.getElementById('loginModal');
        if (loginModal) {
            loginModal.classList.remove('active');
        }

        if (showOAuthToast && typeof showSuccess === 'function') {
            showSuccess('Вход выполнен');
        }
    } catch (error) {
        console.error('Ошибка обработки OAuth callback:', error);
    }
}

function initOAuthHandlers() {
    document.addEventListener('click', (e) => {
        if (e.target.closest('#googleLogin')) {
            e.preventDefault();
            void signInWithGoogle();
            return;
        }
        if (e.target.closest('#facebookLogin')) {
            e.preventDefault();
            void signInWithFacebook();
            return;
        }
        if (e.target.closest('#discordLogin')) {
            e.preventDefault();
            void signInWithDiscord();
            return;
        }
    });

    window.addEventListener('load', () => {
        void handleOAuthCallback();
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOAuthHandlers);
} else {
    initOAuthHandlers();
}
