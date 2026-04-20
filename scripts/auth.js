// Система авторизации и регистрации

// Проверка валидности email
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Проверка валидности пароля (минимум 6 символов)
function isValidPassword(password) {
    return password && password.length >= 6;
}

/**
 * Человекочитаемое сообщение об ошибке signUp (лимиты, сеть, занятый email).
 * @param {any} authError — объект error из ответа Supabase
 */
function mapSignUpAuthError(authError) {
    const raw = authError?.message || '';
    const msg = String(raw).toLowerCase();
    const status = authError?.status;
    const code = String(authError?.code || '').toLowerCase();

    if (
        status === 429 ||
        msg.includes('rate limit') ||
        msg.includes('too many requests') ||
        msg.includes('too_many_requests') ||
        code.includes('over_request') ||
        msg.includes('only request this after')
    ) {
        const sec = raw.match(/(\d+)\s*seconds?/i)?.[1];
        return sec
            ? `Слишком много запросов. Подождите ${sec} сек. и попробуйте снова. Не нажимайте «Зарегистрироваться» несколько раз подряд — это усиливает лимит Supabase.`
            : `Слишком много попыток регистрации (лимит Supabase). Подождите 1–2 минуты без новых нажатий и попробуйте ещё раз.`;
    }

    if (
        status === 504 ||
        status === 503 ||
        status === 502 ||
        msg.includes('gateway') ||
        msg.includes('timeout') ||
        msg.includes('timed out')
    ) {
        return 'Сервер регистрации временно не ответил (таймаут или перегрузка). Подождите минуту и нажмите кнопку ещё раз один раз.';
    }

    if (
        msg.includes('user already registered') ||
        msg.includes('already registered') ||
        msg.includes('already been registered') ||
        status === 422
    ) {
        return 'Пользователь с таким email уже зарегистрирован. Используйте другой email или войдите в существующий аккаунт.';
    }

    if (
        msg.includes('error sending confirmation email') ||
        msg.includes('confirmation email')
    ) {
        return 'Ошибка отправки письма подтверждения. Проверьте настройки SMTP в Supabase Dashboard (см. SMTP_SETUP_GUIDE.md).';
    }

    return raw || 'Ошибка регистрации';
}

// Регистрация пользователя через Supabase Auth
async function registerUser(email, password, username, avatar, gender = 'male') {
    if (typeof logger !== 'undefined') logger.log('🔵 [REGISTER] Начало регистрации:', { email, username, gender });
    
    if (!isValidEmail(email)) {
        if (typeof logger !== 'undefined') logger.log('❌ [REGISTER] Неверный формат email');
        return { success: false, message: 'Некорректный формат email' };
    }
    
    if (!isValidPassword(password)) {
        if (typeof logger !== 'undefined') logger.log('❌ [REGISTER] Пароль слишком короткий');
        return { success: false, message: 'Пароль должен содержать минимум 6 символов' };
    }
    
    if (!username || username.trim().length < 3) {
        if (typeof logger !== 'undefined') logger.log('❌ [REGISTER] Имя пользователя слишком короткое');
        return { success: false, message: 'Имя пользователя должно содержать минимум 3 символа' };
    }
    
    // Проверяем наличие Supabase клиента
    if (typeof supabaseClient === 'undefined' || !supabaseClient) {
        if (typeof logger !== 'undefined') logger.error('❌ [REGISTER] Supabase клиент не найден! Регистрация через localStorage не поддерживается.');
        return { success: false, message: 'Ошибка подключения к базе данных' };
    }
    
    if (typeof logger !== 'undefined') logger.log('✅ [REGISTER] Supabase клиент найден, продолжаем регистрацию через Supabase Auth');
    
    // Примечание: Проверку существования email оставляем на Supabase
    // Если email уже зарегистрирован, Supabase вернет ошибку при signUp
    // Обработка этой ошибки находится ниже в коде
    
    // Используем переданный аватар или случайный
    const availableAvatars = [
        'Fons/1 b.jpg', 'Fons/2 b.jpg', 'Fons/3 b.jpg', 'Fons/4 b.jpg', 'Fons/5 b.jpg',
        'Fons/1 g.jpg', 'Fons/2 g.jpg', 'Fons/3 g.jpg', 'Fons/4 g.jpg', 'Fons/5 g.jpg'
    ];
    const userAvatar = avatar || availableAvatars[Math.floor(Math.random() * availableAvatars.length)];
    
    try {
        if (typeof logger !== 'undefined') logger.log('🔄 [REGISTER] Вызов supabaseClient.auth.signUp...');
        
        // Регистрируем пользователя через Supabase Auth
        const { data: authData, error: authError } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    username: username,
                    avatar: userAvatar,
                    gender: gender
                }
            }
        });
        
        if (typeof logger !== 'undefined') logger.log('📦 [REGISTER] Ответ от Supabase Auth:', { 
            hasUser: !!authData?.user, 
            hasSession: !!authData?.session,
            error: authError,
            userId: authData?.user?.id 
        });
        
        if (authError) {
            if (typeof logger !== 'undefined') logger.error('❌ [REGISTER] Ошибка регистрации в Supabase:', authError);
            return { success: false, message: mapSignUpAuthError(authError) };
        }
        
        if (!authData.user) {
            if (typeof logger !== 'undefined') logger.error('❌ [REGISTER] Пользователь не создан (authData.user = null)');
            return { success: false, message: 'Не удалось создать пользователя' };
        }
        
        if (typeof logger !== 'undefined') logger.log('✅ [REGISTER] Пользователь создан в Supabase Auth! ID:', authData.user.id);
        if (typeof logger !== 'undefined') logger.log('📝 [REGISTER] Данные пользователя:', {
            id: authData.user.id,
            email: authData.user.email,
            emailConfirmed: authData.user.email_confirmed_at ? 'да' : 'нет',
            hasSession: !!authData.session
        });
        
        // Профиль создается автоматически через триггер handle_new_user
        // Пытаемся обновить его с правильными данными, но не критично если не получится
        // Не логируем ошибки 401, так как это нормально - профиль создастся триггером
        if (authData.session) {
            try {
                const { error: profileError } = await supabaseClient
                    .from('profiles')
                    .upsert({
                        id: authData.user.id,
                        username: username,
                        avatar: userAvatar,
                        gender: gender
                    }, {
                        onConflict: 'id'
                    });
                
                // Ошибка 401 - это нормально, профиль создастся триггером
                // Не логируем, чтобы не засорять консоль
            } catch (profileErr) {
                // Игнорируем ошибки создания профиля - он создастся триггером
            }
        }
        
        // Автоматически входим только если email подтвержден и есть сессия
        // В Supabase по умолчанию email подтверждение может быть включено
        if (authData.session && authData.user.email_confirmed_at) {
            if (typeof logger !== 'undefined') logger.log('✅ [REGISTER] Сессия создана и email подтвержден, сохраняем данные в sessionStorage');
            sessionStorage.setItem('currentUser', JSON.stringify({
                id: authData.user.id,
                email: authData.user.email,
                username: username,
                avatar: userAvatar
            }));
            localStorage.setItem('isAuth', 'true');
            if (typeof ensureUserDataRecord === 'function') {
                ensureUserDataRecord(authData.user.id);
            }
        } else if (authData.session && !authData.user.email_confirmed_at) {
            // Сессия есть, но email не подтвержден - не сохраняем авторизацию
            if (typeof logger !== 'undefined') logger.log('⚠️ [REGISTER] Сессия создана, но email не подтвержден - требуется подтверждение');
        } else {
            // Сессии нет - не пытаемся автоматически входить, так как email не подтвержден
            if (typeof logger !== 'undefined') logger.log('⚠️ [REGISTER] Сессия не создана - требуется подтверждение email');
        }
        
        if (typeof logger !== 'undefined') logger.log('✅ [REGISTER] Регистрация завершена успешно!');
        
        // Если email не подтвержден, возвращаем информацию для показа модального окна
        if (!authData.session && !authData.user.email_confirmed_at) {
            return { 
                success: true, 
                needsEmailConfirmation: true,
                message: 'Регистрация успешна! Проверьте email для подтверждения.',
                user: authData.user,
                email: email
            };
        }
        
        return { 
            success: true, 
            message: 'Регистрация успешна! ' + (authData.session ? 'Добро пожаловать!' : 'Проверьте email для подтверждения.'),
            user: authData.user,
            session: authData.session
        };
    } catch (error) {
        if (typeof logger !== 'undefined') logger.error('❌ [REGISTER] Исключение при регистрации:', error);
        const name = error?.name || '';
        const em = String(error?.message || '');
        if (
            name === 'AuthRetryableFetchError' ||
            em.includes('504') ||
            em.includes('503') ||
            em.includes('502') ||
            em.toLowerCase().includes('timeout') ||
            em.toLowerCase().includes('fetch')
        ) {
            return {
                success: false,
                message:
                    'Не удалось связаться с сервером регистрации (сеть или таймаут). Подождите минуту и нажмите «Зарегистрироваться» один раз.'
            };
        }
        return { success: false, message: em || 'Ошибка регистрации' };
    }
}

// Вход пользователя через Supabase Auth
async function loginUser(email, password, codePassword = null, codePhrase = null) {
    if (typeof logger !== 'undefined') logger.log('🔵 [LOGIN] Начало входа:', { email });
    
    if (!isValidEmail(email)) {
        if (typeof logger !== 'undefined') logger.log('❌ [LOGIN] Неверный формат email');
        return { success: false, message: 'Некорректный формат email' };
    }
    
    if (!isValidPassword(password)) {
        if (typeof logger !== 'undefined') logger.log('❌ [LOGIN] Пароль слишком короткий');
        return { success: false, message: 'Пароль должен содержать минимум 6 символов' };
    }
    
    // Специальная логика для входа создателя удалена - теперь роль определяется из базы данных
    
    // Проверяем наличие Supabase клиента
    if (typeof supabaseClient === 'undefined' || !supabaseClient) {
        if (typeof logger !== 'undefined') logger.error('❌ [LOGIN] Supabase клиент не найден!');
        return { success: false, message: 'Ошибка подключения к базе данных' };
    }
    
    if (typeof logger !== 'undefined') logger.log('✅ [LOGIN] Supabase клиент найден, продолжаем вход через Supabase Auth');
    
    try {
        if (typeof logger !== 'undefined') logger.log('🔄 [LOGIN] Вызов supabaseClient.auth.signInWithPassword...');
        
        // Входим через Supabase Auth (используем пароль, который ввел пользователь)
        if (typeof logger !== 'undefined') logger.log('🔑 [LOGIN] Попытка входа с паролем (длина:', password.length, 'символов)');
        const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (typeof logger !== 'undefined') logger.log('📦 [LOGIN] Ответ от Supabase Auth:', { 
            hasUser: !!authData?.user, 
            hasSession: !!authData?.session,
            error: authError,
            errorMessage: authError?.message,
            userId: authData?.user?.id 
        });
        
        if (authError) {
            if (typeof logger !== 'undefined') logger.error('❌ [LOGIN] Ошибка входа в Supabase:', authError);
            
            // Обработка ошибки "Email not confirmed"
            if (authError.message?.toLowerCase().includes('email not confirmed') || 
                authError.message?.toLowerCase().includes('email_not_confirmed')) {
                return { 
                    success: false, 
                    message: 'Email не подтвержден. Проверьте почту или подтвердите email в настройках Supabase.' 
                };
            }
            
            // Обработка ошибки "Invalid login credentials"
            if (authError.message?.toLowerCase().includes('invalid login credentials') ||
                authError.message?.toLowerCase().includes('invalid_credentials')) {
                return { 
                    success: false, 
                    message: 'Неверный email или пароль. Проверьте правильность введенных данных.' 
                };
            }
            
            return { success: false, message: authError.message || 'Неверный email или пароль' };
        }
        
        if (!authData.user || !authData.session) {
            if (typeof logger !== 'undefined') logger.error('❌ [LOGIN] Пользователь или сессия не найдены');
            return { success: false, message: 'Ошибка входа' };
        }
        
        if (typeof logger !== 'undefined') logger.log('✅ [LOGIN] Вход выполнен! ID пользователя:', authData.user.id);
        
        // Получаем профиль пользователя
        if (typeof logger !== 'undefined') logger.log('🔄 [LOGIN] Загрузка профиля из таблицы profiles...');
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('username, avatar, gender')
            .eq('id', authData.user.id)
            .single();
        
        if (profileError && profileError.code !== 'PGRST116') { // PGRST116 = not found
            if (typeof logger !== 'undefined') logger.error('⚠️ [LOGIN] Ошибка загрузки профиля:', profileError);
        } else if (profile) {
            if (typeof logger !== 'undefined') logger.log('✅ [LOGIN] Профиль загружен:', profile);
        } else {
            if (typeof logger !== 'undefined') logger.log('⚠️ [LOGIN] Профиль не найден');
        }
        
        // Сохраняем данные пользователя
        const userData = {
            id: authData.user.id,
            email: authData.user.email,
            username: profile?.username || authData.user.email?.split('@')[0] || 'Пользователь',
            avatar: profile?.avatar || 'Fons/1 b.jpg'
        };
        
        // Обновляем кэш
        currentUserCache = userData;
        currentUserCacheTime = Date.now();
        
        if (typeof logger !== 'undefined') logger.log('💾 [LOGIN] Сохранение данных пользователя в sessionStorage:', userData);
        sessionStorage.setItem('currentUser', JSON.stringify(userData));
        localStorage.setItem('isAuth', 'true');
        if (typeof ensureUserDataRecord === 'function') {
            ensureUserDataRecord(userData.id);
        }

        if (typeof logger !== 'undefined') logger.log('✅ [LOGIN] Вход завершен успешно!');
        return { 
            success: true, 
            message: 'Вход выполнен успешно!',
            user: userData
        };
    } catch (error) {
        if (typeof logger !== 'undefined') logger.error('❌ [LOGIN] Исключение при входе:', error);
        return { success: false, message: error.message || 'Ошибка входа' };
    }
}

// Выход пользователя
async function logoutUser() {
    if (typeof logger !== 'undefined') logger.log('🔴 [LOGOUT] Начало выхода');
    
    // Очищаем кэш
    clearUserCache();
    
    // Выходим из Supabase Auth
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        try {
            const { error } = await supabaseClient.auth.signOut();
            // Не логируем ошибки выхода
        } catch (error) {
            // Игнорируем ошибки
        }
    }
    
    sessionStorage.removeItem('currentUser');
    localStorage.removeItem('isAuth');
    localStorage.removeItem('userId');
    
    if (typeof logger !== 'undefined') logger.log('✅ [LOGOUT] Выход завершен');
    return { success: true, message: 'Выход выполнен' };
}

// Кэш для текущего пользователя (обновляется при изменениях)
let currentUserCache = null;
let currentUserCacheTime = 0;
const USER_CACHE_DURATION = 30000; // 30 секунд

// Получить текущего пользователя
async function getCurrentUser(forceRefresh = false) {
    // Проверяем кэш (если не принудительное обновление)
    if (!forceRefresh && currentUserCache && (Date.now() - currentUserCacheTime) < USER_CACHE_DURATION) {
        return currentUserCache;
    }
    
    // Сначала проверяем Supabase сессию
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        try {
            const { data: { session }, error } = await supabaseClient.auth.getSession();
            if (session && session.user) {
                // Получаем профиль (только нужные поля)
                const { data: profile } = await supabaseClient
                    .from('profiles')
                    .select('username, avatar, gender')
                    .eq('id', session.user.id)
                    .maybeSingle();
                
                const userData = {
                    id: session.user.id,
                    email: session.user.email,
                    username: profile?.username || session.user.email?.split('@')[0] || 'Пользователь',
                    avatar: profile?.avatar || 'Fons/1 b.jpg'
                };
                
                // Обновляем кэш
                currentUserCache = userData;
                currentUserCacheTime = Date.now();
                if (typeof ensureUserDataRecord === 'function') {
                    ensureUserDataRecord(userData.id);
                }
                return userData;
            }
        } catch (error) {
            // Не логируем ошибки, чтобы не засорять консоль
        }
    }
    
    // Fallback на sessionStorage (для обратной совместимости)
    const userStr = sessionStorage.getItem('currentUser');
    if (userStr) {
        try {
            const userData = JSON.parse(userStr);
            // Обновляем кэш
            currentUserCache = userData;
            currentUserCacheTime = Date.now();
            if (typeof ensureUserDataRecord === 'function') {
                ensureUserDataRecord(userData.id);
            }
            return userData;
        } catch (e) {
            // Игнорируем ошибки парсинга
        }
    }
    
    currentUserCache = null;
    return null;
}

// Очистить кэш пользователя (вызывать при выходе или изменении данных)
function clearUserCache() {
    currentUserCache = null;
    currentUserCacheTime = 0;
}

// Экспортируем для использования в других модулях
window.clearUserCache = clearUserCache;

// Синхронная версия getCurrentUser (использует кэш/sessionStorage)
function getCurrentUserSync() {
    // Сначала проверяем кэш
    if (currentUserCache) {
        return currentUserCache;
    }
    
    // Fallback на sessionStorage
    const userStr = sessionStorage.getItem('currentUser');
    if (userStr) {
        try {
            return JSON.parse(userStr);
        } catch (e) {
            return null;
        }
    }
    
    return null;
}

// Синхронная проверка авторизации (использует localStorage/sessionStorage)
function isAuthenticatedSync() {
    return localStorage.getItem('isAuth') === 'true' && sessionStorage.getItem('currentUser') !== null;
}

// Экспортируем синхронные версии
window.getCurrentUserSync = getCurrentUserSync;
window.isAuthenticatedSync = isAuthenticatedSync;

// Проверка авторизации
async function isAuthenticated() {
    // Проверяем Supabase сессию
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (session && session.user) {
                return true;
            }
        } catch (error) {
            if (typeof logger !== 'undefined') logger.error('Ошибка проверки сессии:', error);
        }
    }
    
    // Fallback на localStorage
    return localStorage.getItem('isAuth') === 'true' && sessionStorage.getItem('currentUser') !== null;
}

// Получить полную информацию о пользователе
function getUserData(userId) {
    if (!userId) return null;
    
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    // Поддержка строковых UUID и числовых ID
    return users.find(u => u.id === userId || u.id === String(userId) || u.id === parseInt(userId));
}

// Обновить данные пользователя
function updateUserData(userId, data) {
    if (!userId) return { success: false };
    
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const userIndex = users.findIndex(u => u.id === userId || u.id === String(userId) || u.id === parseInt(userId));
    
    if (userIndex !== -1) {
        users[userIndex] = { ...users[userIndex], ...data };
        localStorage.setItem('users', JSON.stringify(users));
        
        const currentUser = getCurrentUserSync();
        if (currentUser && (currentUser.id === userId || currentUser.id === String(userId))) {
            sessionStorage.setItem('currentUser', JSON.stringify({
                ...currentUser,
                ...data
            }));
        }
        
        return { success: true };
    }
    
    // Если пользователь не найден - создаём новую запись
    users.push({ id: userId, ...data });
    localStorage.setItem('users', JSON.stringify(users));
    return { success: true };
}

/**
 * Для пользователей Supabase запись в localStorage `users` часто отсутствует —
 * настройки сайта и saveSetting опираются на getUserData. Создаём зеркальную запись.
 */
function ensureUserDataRecord(userId) {
    if (!userId) return null;
    const existing = getUserData(userId);
    if (existing) return existing;
    const sync = getCurrentUserSync();
    if (!sync || String(sync.id) !== String(userId)) return null;
    const defaults = {
        email: sync.email || '',
        username:
            sync.username || (sync.email && sync.email.split('@')[0]) || 'Пользователь',
        avatar: sync.avatar || 'Fons/1 b.jpg',
        settings: {
            adsEnabled: true,
            notificationsEnabled: true,
            showRecommendations: true,
            theme: 'dark'
        }
    };
    updateUserData(userId, defaults);
    return getUserData(userId);
}
window.ensureUserDataRecord = ensureUserDataRecord;

window.addEventListener('pageshow', (event) => {
    if (!event.persisted || typeof supabaseClient === 'undefined' || !supabaseClient) return;
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
        if (session && session.user && typeof window.reminkoSyncAuthStorage === 'function') {
            window.reminkoSyncAuthStorage(session);
        }
    });
});

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || typeof supabaseClient === 'undefined' || !supabaseClient) {
        return;
    }
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
        if (session && session.user && typeof window.reminkoSyncAuthStorage === 'function') {
            window.reminkoSyncAuthStorage(session);
        }
    });
});
