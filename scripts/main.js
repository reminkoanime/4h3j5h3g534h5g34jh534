// Открытие/закрытие модального окна входа

// Проверка авторизации
async function checkAuth() {
    const isAuth = await isAuthenticated();
    // Старые элементы (для обратной совместимости)
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const profileLink = document.getElementById('profileLink');
    // Новые элементы верхней панели
    const topLoginBtn = document.getElementById('topLoginBtn');
    const topRegisterBtn = document.getElementById('topRegisterBtn');
    const topProfileLink = document.getElementById('topProfileLink');
    
    // Инициализируем обработчики для кнопок входа/регистрации (если они есть)
    initLoginRegisterHandlers();
    
    // Определяем, на странице профиля ли мы
    const isProfilePage = window.location.pathname.includes('profile.html');
    
    const updateAuthUI = (btn, regBtn, profLink) => {
        if (!btn) return;
        
        if (isAuth) {
            btn.textContent = 'Выйти';
            if (regBtn) {
                regBtn.style.display = 'none';
            }
            if (profLink) {
                profLink.style.display = 'flex';
                let basePath = '';
                // Проверяем, нужно ли добавлять ../ для пути к профилю
                if (window.location.pathname.includes('/catalog/') || window.location.pathname.includes('/anime/') || window.location.pathname.includes('/manga/')) {
                    basePath = '../';
                }
                profLink.href = basePath + 'profile.html';
            }
        } else {
            btn.textContent = 'Войти';
            if (regBtn) {
                regBtn.style.display = 'flex';
            }
            if (profLink) {
                profLink.style.display = 'none';
            }
        }
    };
    
    // Обновляем старые элементы
    updateAuthUI(loginBtn, registerBtn, profileLink);
    // Обновляем новые элементы верхней панели
    updateAuthUI(topLoginBtn, topRegisterBtn, topProfileLink);
}



// Функция обработки входа/выхода
async function handleLoginLogout(btn, modal) {
    if (!btn) return;
    
    // Удаляем старый обработчик, если есть
    if (btn._logoutHandler) {
        btn.removeEventListener('click', btn._logoutHandler, true);
    }
    
    const handler = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation(); // Останавливаем дальнейшую обработку
        const isAuth = await isAuthenticated();
        
        if (isAuth) {
            // Выход
            if (typeof logoutUser === 'function') {
                await logoutUser();
                checkAuth();
                window.location.reload();
            }
        } else {
            // Вход - открываем модальное окно БЕЗ загрузки
            if (modal) {
                modal.classList.add('active');
            }
        }
    };
    
    btn._logoutHandler = handler;
    btn.addEventListener('click', handler, true); // Используем capture phase
}

// Функция инициализации обработчиков входа/регистрации
function initLoginRegisterHandlers() {
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const topLoginBtn = document.getElementById('topLoginBtn');
    const topRegisterBtn = document.getElementById('topRegisterBtn');
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    
    // Удаляем старые обработчики перед добавлением новых (если они есть)
    const removeOldListeners = (btn) => {
        if (btn && btn._oldHandler) {
            btn.removeEventListener('click', btn._oldHandler);
        }
    };
    
    // Кнопки входа/выхода (старые и новые)
    if (loginBtn && !loginBtn._handlerAdded) {
        handleLoginLogout(loginBtn, loginModal);
        loginBtn._handlerAdded = true;
    }
    if (topLoginBtn && !topLoginBtn._handlerAdded) {
        handleLoginLogout(topLoginBtn, loginModal);
        topLoginBtn._handlerAdded = true;
    }
    
    // Кнопки регистрации (старые и новые)
    if (registerBtn && !registerBtn._handlerAdded) {
        registerBtn._handlerAdded = true;
        registerBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation(); // Останавливаем дальнейшую обработку
            if (registerModal) {
                registerModal.classList.add('active');
            }
        }, true); // Используем capture phase
    }
    if (topRegisterBtn && !topRegisterBtn._handlerAdded) {
        topRegisterBtn._handlerAdded = true;
        topRegisterBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation(); // Останавливаем дальнейшую обработку
            if (registerModal) {
                registerModal.classList.add('active');
            }
        }, true); // Используем capture phase
    }
}

// Открытие модальных окон
document.addEventListener('DOMContentLoaded', () => {
    // Инициализируем обработчики для кнопок входа/регистрации
    initLoginRegisterHandlers();
    
    // Повторяем инициализацию через небольшую задержку (на случай, если навигация еще не применена)
    setTimeout(() => {
        initLoginRegisterHandlers();
    }, 500);
    
    // Делегирование событий для кнопок входа/регистрации (гарантированно работает на всех страницах)
    document.addEventListener('click', async (e) => {
        // Проверяем клик по кнопке входа
        const clickedLoginBtn = e.target.closest('#topLoginBtn, #loginBtn, .btn-top-login, .btn-login');
        if (clickedLoginBtn) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation(); // Останавливаем дальнейшую обработку
            
            // Убеждаемся, что модальные окна существуют (создаем если нужно)
            if (window.navigationManager && typeof window.navigationManager.ensureModalsExist === 'function') {
                window.navigationManager.ensureModalsExist();
            }
            
            // Проверяем, авторизован ли пользователь
            const isAuth = await isAuthenticated();
            const btnText = clickedLoginBtn.textContent.trim();
            
            if (isAuth || btnText === 'Выйти') {
                // Это выход
                if (typeof logoutUser === 'function') {
                    await logoutUser();
                    checkAuth();
                    window.location.reload();
                }
            } else {
                // Это вход - открываем модальное окно БЕЗ загрузки
                const loginModal = document.getElementById('loginModal');
                if (loginModal) {
                    loginModal.classList.add('active');
                } else {
                    console.error('Модальное окно входа не найдено!');
                }
            }
            return false;
        }
        
        // Проверяем клик по кнопке регистрации
        const clickedRegisterBtn = e.target.closest('#topRegisterBtn, #registerBtn, .btn-top-register, .btn-register');
        if (clickedRegisterBtn) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation(); // Останавливаем дальнейшую обработку
            
            // Убеждаемся, что модальные окна существуют (создаем если нужно)
            if (window.navigationManager && typeof window.navigationManager.ensureModalsExist === 'function') {
                window.navigationManager.ensureModalsExist();
            }
            
            const registerModal = document.getElementById('registerModal');
            if (registerModal) {
                registerModal.classList.add('active');
            } else {
                console.error('Модальное окно регистрации не найдено!');
            }
            return false;
        }
    }, true); // Используем capture phase для перехвата (до других обработчиков)
    
    // Просмотр пароля (глазок)
    const toggleLoginPassword = document.getElementById('toggleLoginPassword');
    const loginPassword = document.getElementById('loginPassword');
    const loginPasswordEyeIcon = document.getElementById('loginPasswordEyeIcon');
    
    if (toggleLoginPassword && loginPassword && loginPasswordEyeIcon) {
        toggleLoginPassword.addEventListener('click', () => {
            if (loginPassword.type === 'password') {
                loginPassword.type = 'text';
                loginPasswordEyeIcon.innerHTML = `
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                `;
            } else {
                loginPassword.type = 'password';
                loginPasswordEyeIcon.innerHTML = `
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                `;
            }
        });
    }
});

// Обработка входа через делегирование событий
document.addEventListener('click', async (e) => {
    if (e.target.id === 'loginSubmit') {
        e.preventDefault();
        
        const loginForm = document.getElementById('loginForm');
        const errorDiv = document.getElementById('loginError');
        const loginModal = document.getElementById('loginModal');
        
        // Валидация формы
        if (typeof validateLoginForm === 'function') {
            const validation = validateLoginForm(loginForm);
            if (!validation.valid) {
                if (errorDiv) {
                    errorDiv.textContent = 'Пожалуйста, исправьте ошибки в форме';
                    errorDiv.style.display = 'block';
                }
                return;
            }
            
            // Используем данные из валидации
            const { email, password } = validation.data;
            
            // Очищаем общую ошибку
            if (errorDiv) {
                errorDiv.textContent = '';
                errorDiv.style.display = 'none';
            }
            
            const result = await loginUser(email, password);
            if (result.success) {
                if (errorDiv) {
                    errorDiv.textContent = '';
                    errorDiv.style.display = 'none';
                }
                
                if (typeof showSuccess === 'function') {
                    showSuccess(result.message);
                } else {
                    if (typeof logger !== 'undefined') logger.log('✅', result.message);
                }
                if (loginModal) loginModal.classList.remove('active');
                
                // Очистка формы
                if (loginForm) loginForm.reset();
                // Очищаем ошибки полей
                if (typeof hideFieldError === 'function') {
                    loginForm.querySelectorAll('input').forEach(input => hideFieldError(input));
                }
                
                // Обновляем UI асинхронно
                if (typeof checkAuth === 'function') {
                    await checkAuth();
                }
                
                // Обновляем ссылки навигации
                if (window.navigationManager && typeof window.navigationManager.updateAuthLinks === 'function') {
                    await window.navigationManager.updateAuthLinks();
                }
                
                await new Promise(resolve => setTimeout(resolve, 200));
                window.location.reload();
            } else {
                if (errorDiv) {
                    errorDiv.textContent = result.message;
                    errorDiv.style.display = 'block';
                }
            }
            return;
        }
        
        // Fallback для старых версий без валидации
        const email = document.getElementById('loginEmail')?.value.trim();
        const password = document.getElementById('loginPassword')?.value;
        
        if (!email || !password) {
            if (errorDiv) {
                errorDiv.textContent = 'Заполните все поля';
                errorDiv.style.display = 'block';
            }
            return;
        }
        
        const result = await loginUser(email, password);
        if (result.success) {
            if (errorDiv) {
                errorDiv.textContent = '';
                errorDiv.style.display = 'none';
            }
            
            if (typeof showSuccess === 'function') {
                showSuccess(result.message);
            } else {
                console.log('✅', result.message);
            }
            if (loginModal) loginModal.classList.remove('active');
            
            // Очистка формы
            const loginEmail = document.getElementById('loginEmail');
            const loginPassword = document.getElementById('loginPassword');
            if (loginEmail) loginEmail.value = '';
            if (loginPassword) loginPassword.value = '';
            
            // Обновляем UI асинхронно
            if (typeof checkAuth === 'function') {
                await checkAuth();
            }
            
            // Обновляем ссылки навигации (админ панель и т.д.)
            if (window.navigationManager && typeof window.navigationManager.updateAuthLinks === 'function') {
                await window.navigationManager.updateAuthLinks();
            }
            
            // Ждем немного чтобы все обновилось
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Перезагружаем страницу для полного обновления UI
            window.location.reload();
        } else {
            if (errorDiv) {
                errorDiv.textContent = result.message;
                errorDiv.style.display = 'block';
            }
        }
    }
    
    // Вход через Google (заглушка)
    if (e.target.id === 'googleLogin') {
        e.preventDefault();
        showInfo('Вход через Google (Заглушка)<br>В будущем здесь будет интеграция с Google OAuth');
    }
    
    // Вход через Telegram обрабатывается в telegram-auth.js
    // Обработчик удален, так как теперь используется telegram-auth.js
    
    // Обработка переключения видимости пароля
    if (e.target.id === 'toggleLoginPassword' || e.target.closest('#toggleLoginPassword')) {
        e.preventDefault();
        const loginPassword = document.getElementById('loginPassword');
        const loginPasswordEyeIcon = document.getElementById('loginPasswordEyeIcon');
        
        if (loginPassword && loginPasswordEyeIcon) {
            if (loginPassword.type === 'password') {
                loginPassword.type = 'text';
                loginPasswordEyeIcon.innerHTML = `
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                `;
            } else {
                loginPassword.type = 'password';
                loginPasswordEyeIcon.innerHTML = `
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                `;
            }
        }
    }
});


// Закрытие модальных окон при клике вне их (обработка в navigation.js через делегирование)

// Обработка входа
document.addEventListener('DOMContentLoaded', () => {
    const loginSubmit = document.getElementById('loginSubmit');
    const googleLogin = document.getElementById('googleLogin');
    const loginModal = document.getElementById('loginModal');
});

// Мобильное меню для боковой панели
document.addEventListener('DOMContentLoaded', () => {
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.sidebar');
    const mainLayout = document.querySelector('.main-layout');
    
    // Показываем кнопку на мобильных устройствах
    if (sidebarToggle) {
        const checkMobile = () => {
            if (window.innerWidth <= 768) {
                sidebarToggle.style.display = 'flex';
            } else {
                sidebarToggle.style.display = 'none';
                if (sidebar) sidebar.classList.remove('active');
                if (mainLayout) mainLayout.classList.remove('sidebar-open');
            }
        };
        
        checkMobile();
        window.addEventListener('resize', checkMobile);
        
        if (sidebarToggle && sidebar && mainLayout) {
            sidebarToggle.addEventListener('click', () => {
                sidebar.classList.toggle('active');
                mainLayout.classList.toggle('sidebar-open');
            });
            
            // Закрытие при клике вне панели
            mainLayout.addEventListener('click', (e) => {
                if (window.innerWidth <= 768 && 
                    sidebar.classList.contains('active') && 
                    !sidebar.contains(e.target) && 
                    !sidebarToggle.contains(e.target)) {
                    sidebar.classList.remove('active');
                    mainLayout.classList.remove('sidebar-open');
                }
            });
        }
    }
    
    // Старое мобильное меню (для обратной совместимости)
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            hamburger.classList.toggle('active');
        });

        // Закрытие мобильного меню при клике на ссылку
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
                hamburger.classList.remove('active');
            });
        });
    }
    
    // Инициализация проверки авторизации
    checkAuth();
});
