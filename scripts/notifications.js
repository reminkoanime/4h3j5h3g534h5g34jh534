// Система уведомлений
/** Корень сайта — иначе на /catalog/ запрашивается /catalog/sound/... (404) */
const NOTIFICATION_SOUND_PATH = '/sound/Rezero Respawn Sound Effect (Clean Perfect).mp3';
const NOTIFICATION_SOUND_VOLUME = 0.25;

class NotificationService {
    constructor() {
        this.notifications = [];
        this.unreadCount = 0;
        this.currentUser = null;
        this._notificationAudio = null;
        /** Антиспам: одинаковые тосты подряд */
        this._toastDedupeKey = '';
        this._toastDedupeAt = 0;
    }

    _playNotificationSound() {
        try {
            if (!this._notificationAudio) {
                this._notificationAudio = new Audio(NOTIFICATION_SOUND_PATH);
            }
            this._notificationAudio.volume = Math.min(1, Math.max(0, NOTIFICATION_SOUND_VOLUME));
            this._notificationAudio.currentTime = 0;
            this._notificationAudio.play().catch(() => {});
        } catch (e) {}
    }

    async init() {
        if (typeof getCurrentUser === 'function') {
            this.currentUser = await getCurrentUser();
            if (this.currentUser) {
                this.loadNotifications();
                this.setupRealtime();
            }
        }
    }

    // Загрузка уведомлений
    async loadNotifications() {
        if (!this.currentUser || !supabaseClient) return;

        try {
            // Проверяем существование таблицы через попытку запроса
            const { data, error } = await supabaseClient
                .from('notifications')
                .select('*')
                .eq('user_id', this.currentUser.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) {
                // Если таблица не существует, просто игнорируем
                if (error.code === 'PGRST205' || error.message?.includes('not found')) {
                    console.warn('Таблица notifications не найдена. Создайте таблицу в Supabase для работы уведомлений.');
                    this.notifications = [];
                    this.unreadCount = 0;
                    return;
                }
                // Не логируем ошибки загрузки уведомлений
                return;
            }

            this.notifications = data || [];
            this.unreadCount = this.notifications.filter(n => !n.read).length;
            this.updateNotificationBadge();
            this.renderNotifications();
        } catch (error) {
            // Не логируем ошибки загрузки уведомлений
        }
    }

    // Настройка realtime подписки
    setupRealtime() {
        if (!this.currentUser || !supabaseClient) return;

        // Пытаемся подписаться, но не падаем, если таблица не существует
        try {
            supabaseClient
                .channel('notifications')
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${this.currentUser.id}`
                }, (payload) => {
                    this.notifications.unshift(payload.new);
                    this.unreadCount++;
                    this.updateNotificationBadge();
                    this.renderNotifications();
                    this.showToast(payload.new);
                })
                .subscribe();
        } catch (error) {
            console.warn('Не удалось настроить realtime подписку для уведомлений:', error);
        }
    }

    // Создать уведомление
    async createNotification(userId, type, title, message, link = null, data = {}) {
        if (!supabaseClient) return { success: false };

        try {
            const { error } = await supabaseClient
                .from('notifications')
                .insert({
                    user_id: userId,
                    type: type,
                    title: title,
                    message: message,
                    link: link,
                    data: data
                });

            if (error) {
                // Если таблица не существует, возвращаем успех (чтобы не ломать функционал)
                if (error.code === 'PGRST205' || error.message?.includes('not found')) {
                    console.warn('Таблица notifications не найдена. Уведомление не создано.');
                    return { success: false, message: 'Таблица notifications не настроена' };
                }
                console.error('Ошибка создания уведомления:', error);
                return { success: false, message: error.message };
            }

            return { success: true };
        } catch (error) {
            console.error('Ошибка создания уведомления:', error);
            return { success: false, message: error.message };
        }
    }

    // Отметить как прочитанное
    async markAsRead(notificationId) {
        if (!supabaseClient) return;

        try {
            await supabaseClient
                .from('notifications')
                .update({ read: true, read_at: new Date().toISOString() })
                .eq('id', notificationId);

            const notification = this.notifications.find(n => n.id === notificationId);
            if (notification && !notification.read) {
                notification.read = true;
                this.unreadCount = Math.max(0, this.unreadCount - 1);
                this.updateNotificationBadge();
            }
        } catch (error) {
            console.error('Ошибка отметки уведомления:', error);
        }
    }

    // Отметить все как прочитанные
    async markAllAsRead() {
        if (!this.currentUser || !supabaseClient) return;

        try {
            await supabaseClient
                .from('notifications')
                .update({ read: true, read_at: new Date().toISOString() })
                .eq('user_id', this.currentUser.id)
                .eq('read', false);

            this.notifications.forEach(n => n.read = true);
            this.unreadCount = 0;
            this.updateNotificationBadge();
            this.renderNotifications();
        } catch (error) {
            console.error('Ошибка отметки всех уведомлений:', error);
        }
    }

    /** Полностью удалить все уведомления пользователя из БД */
    async deleteAllNotifications() {
        if (!this.currentUser || !supabaseClient) return;

        try {
            const { error } = await supabaseClient
                .from('notifications')
                .delete()
                .eq('user_id', this.currentUser.id);

            if (error) {
                if (error.code === 'PGRST205' || error.message?.includes('not found')) {
                    this.notifications = [];
                    this.unreadCount = 0;
                    this.updateNotificationBadge();
                    this.renderNotifications();
                    return;
                }
                console.error('Ошибка удаления уведомлений:', error);
                return;
            }

            this.notifications = [];
            this.unreadCount = 0;
            this.updateNotificationBadge();
            this.renderNotifications();
        } catch (error) {
            console.error('Ошибка удаления уведомлений:', error);
        }
    }

    // Обновить бейдж уведомлений
    updateNotificationBadge() {
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            if (this.unreadCount > 0) {
                badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    _ensureToastShell() {
        let container = document.getElementById('notifications-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notifications-container';
            document.body.appendChild(container);
        }
        let toolbar = container.querySelector('.notifications-stack-toolbar');
        if (!toolbar) {
            toolbar = document.createElement('div');
            toolbar.className = 'notifications-stack-toolbar';
            toolbar.setAttribute('hidden', '');
            const label = document.createElement('span');
            label.className = 'notifications-stack-toolbar-label';
            label.textContent = 'Уведомления';
            const clearBtn = document.createElement('button');
            clearBtn.type = 'button';
            clearBtn.className = 'notifications-clear-all-btn';
            clearBtn.textContent = 'Очистить все';
            clearBtn.addEventListener('click', () => this.clearAllToasts());
            toolbar.appendChild(label);
            toolbar.appendChild(clearBtn);
            container.prepend(toolbar);
        }
        return { container, toolbar };
    }

    /** Не больше max видимых тостов: самый старый внизу стека убирается */
    _capVisibleToasts(container, max = 5) {
        if (!container) return;
        while (container.querySelectorAll(':scope > .notification').length >= max) {
            const all = container.querySelectorAll(':scope > .notification');
            all[all.length - 1]?.remove();
        }
    }

    _syncToastToolbar() {
        const container = document.getElementById('notifications-container');
        if (!container) return;
        const toolbar = container.querySelector('.notifications-stack-toolbar');
        if (!toolbar) return;
        const n = container.querySelectorAll(':scope > .notification').length;
        if (n > 0) toolbar.removeAttribute('hidden');
        else toolbar.setAttribute('hidden', '');
    }

    clearAllToasts() {
        const container = document.getElementById('notifications-container');
        if (!container) return;
        container.querySelectorAll(':scope > .notification').forEach((el) => {
            el.classList.add('hiding');
            setTimeout(() => el.remove(), 280);
        });
        setTimeout(() => this._syncToastToolbar(), 300);
    }

    _dismissToastEl(notificationEl) {
        if (!notificationEl || !notificationEl.parentNode) return;
        notificationEl.classList.add('hiding');
        setTimeout(() => {
            notificationEl.remove();
            this._syncToastToolbar();
        }, 320);
    }

    _attachSwipeToDismiss(notificationEl, onDone) {
        let sx = 0;
        let sy = 0;
        let dx = 0;
        let dy = 0;
        let dragging = false;
        let gestureDone = false;

        const finish = () => {
            if (gestureDone) return;
            gestureDone = true;
            dragging = false;
            const dismiss = Math.abs(dx) > 72 || dy < -56;
            if (dismiss) {
                notificationEl.style.transition = 'opacity 0.22s ease, transform 0.28s ease';
                notificationEl.style.transform = `translateX(${dx > 0 ? '120%' : '-120%'}) translateY(${Math.min(dy, 0)}px)`;
                notificationEl.style.opacity = '0';
                setTimeout(() => {
                    onDone();
                    this._syncToastToolbar();
                }, 280);
            } else {
                gestureDone = false;
                notificationEl.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
                notificationEl.style.transform = '';
                notificationEl.style.opacity = '';
                setTimeout(() => {
                    notificationEl.style.transition = '';
                }, 220);
            }
            dx = 0;
            dy = 0;
        };

        notificationEl.addEventListener(
            'touchstart',
            (e) => {
                if (
                    e.target.closest('.notification-close') ||
                    e.target.closest('.notification-reply-area')
                ) {
                    return;
                }
                gestureDone = false;
                const t = e.changedTouches[0];
                sx = t.clientX;
                sy = t.clientY;
                dragging = true;
                dx = 0;
                dy = 0;
            },
            { passive: true }
        );

        notificationEl.addEventListener(
            'touchmove',
            (e) => {
                if (!dragging) return;
                const t = e.changedTouches[0];
                dx = t.clientX - sx;
                dy = t.clientY - sy;
                if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 6) e.preventDefault();
                notificationEl.style.transition = 'none';
                notificationEl.style.transform = `translateX(${dx}px) translateY(${dy < 0 ? dy * 0.45 : 0}px)`;
                notificationEl.style.opacity = String(Math.max(0.38, 1 - Math.abs(dx) / 200));
            },
            { passive: false }
        );

        notificationEl.addEventListener('touchend', () => {
            if (!dragging) return;
            finish();
        });
        notificationEl.addEventListener('touchcancel', () => {
            if (!dragging) return;
            finish();
        });
    }

    // Показать уведомление (строка, тип или объект из БД; options.link — переход по тапу)
    showNotification(messageOrObject, type = 'info', options = {}) {
        if (typeof options === 'string') {
            options = { link: options };
        }
        let headline;
        let message;
        let notifType;
        let link = '';

        if (typeof messageOrObject === 'object' && messageOrObject !== null) {
            headline = messageOrObject.title || 'Re-Minko';
            message =
                messageOrObject.message != null
                    ? String(messageOrObject.message)
                    : String(messageOrObject.title || '');
            notifType = messageOrObject.type || 'info';
            if (messageOrObject.link) link = String(messageOrObject.link).trim();
        } else {
            message = String(messageOrObject || '');
            notifType = type;
            headline = this.getTypeTitle(notifType);
            if (options && typeof options.link === 'string') link = options.link.trim();
        }

        const dedupeKey = `${notifType}\0${headline}\0${message}\0${link}`;
        const now = Date.now();
        if (dedupeKey === this._toastDedupeKey && now - this._toastDedupeAt < 2000) {
            return;
        }
        this._toastDedupeKey = dedupeKey;
        this._toastDedupeAt = now;

        const { container, toolbar } = this._ensureToastShell();
        this._capVisibleToasts(container, 5);

        const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ', dm: '✉' };
        const icon = icons[notifType] || 'ℹ';

        const notificationEl = document.createElement('div');
        notificationEl.className = `notification notification-${notifType}`;
        if (link) {
            notificationEl.classList.add('notification--has-link');
            notificationEl.dataset.notifLink = link;
        }

        const content = document.createElement('div');
        content.className = 'notification-content';
        content.innerHTML = `
            <div class="notification-icon-circle">${icon}</div>
            <div class="notification-body">
                <div class="notification-app-name"></div>
                <div class="notification-message"></div>
            </div>
            <span class="notification-time-label">сейчас</span>
        `;
        content.querySelector('.notification-app-name').textContent = headline;
        content.querySelector('.notification-message').textContent = message;

        const progress = document.createElement('div');
        progress.className = 'notification-progress';
        const bar = document.createElement('div');
        bar.className = 'notification-progress-bar';
        progress.appendChild(bar);

        notificationEl.appendChild(content);
        notificationEl.appendChild(progress);

        if (toolbar.nextSibling) {
            container.insertBefore(notificationEl, toolbar.nextSibling);
        } else {
            container.appendChild(notificationEl);
        }
        this._syncToastToolbar();

        notificationEl.addEventListener('click', (e) => {
            if (e.target.closest('.notification-close') || e.target.closest('.notification-reply-area')) return;
            const href = notificationEl.dataset.notifLink;
            if (href) {
                window.location.assign(href);
            }
            this._dismissToastEl(notificationEl);
        });

        this._attachSwipeToDismiss(notificationEl, () => {
            notificationEl.remove();
        });

        if (options.withSound) {
            this._playNotificationSound();
        }
        requestAnimationFrame(() => notificationEl.classList.add('show'));

        const hideMs =
            notifType === 'error' ? 7000 : notifType === 'success' ? 3600 : notifType === 'warning' ? 4800 : 5200;
        let autoHideTimer = setTimeout(() => {
            this._dismissToastEl(notificationEl);
        }, hideMs);

        notificationEl.addEventListener('mouseenter', () => clearTimeout(autoHideTimer));
        notificationEl.addEventListener('mouseleave', () => {
            autoHideTimer = setTimeout(() => this._dismissToastEl(notificationEl), 2200);
        });
    }
    
    // Получить заголовок по типу
    getTypeTitle(type) {
        const titles = {
            'success': 'Успешно',
            'error': 'Ошибка',
            'warning': 'Внимание',
            'info': 'Информация'
        };
        return titles[type] || 'Уведомление';
    }
    
    showToast(notification) {
        if (notification && typeof notification === 'object') {
            this.showNotification(notification, notification.type || 'info', { withSound: true });
        } else {
            this.showNotification(notification, 'info', { withSound: true });
        }
    }

    showDmNotification(senderName, message, senderId) {
        const { container, toolbar } = this._ensureToastShell();
        this._capVisibleToasts(container, 5);
        const sid = String(senderId || '').replace(/'/g, '');

        const el = document.createElement('div');
        el.className = 'notification notification-dm notification--has-link';
        el.dataset.notifLink = `messages.html?user=${encodeURIComponent(sid)}`;

        const content = document.createElement('div');
        content.className = 'notification-content';
        const nameEsc = senderName || 'Сообщение';
        content.innerHTML = `
            <div class="notification-icon-circle">✉</div>
            <div class="notification-body">
                <div class="notification-app-name"></div>
                <div class="notification-message"></div>
            </div>
            <span class="notification-time-label">сейчас</span>
        `;
        content.querySelector('.notification-app-name').textContent = nameEsc;
        content.querySelector('.notification-message').textContent = String(message || '');

        const reply = document.createElement('div');
        reply.className = 'notification-reply-area';
        reply.innerHTML = `
            <input class="notification-reply-input" placeholder="Ответить..." maxlength="300">
            <button type="button" class="notification-reply-send">➤</button>
        `;
        const sendBtn = reply.querySelector('.notification-reply-send');
        sendBtn.addEventListener('click', () =>
            window.notificationService._sendQuickReply(sendBtn, sid)
        );
        reply.querySelector('.notification-reply-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                window.notificationService._sendQuickReply(sendBtn, sid);
            }
        });

        const progress = document.createElement('div');
        progress.className = 'notification-progress';
        const bar = document.createElement('div');
        bar.className = 'notification-progress-bar';
        bar.style.animationDuration = '8s';
        progress.appendChild(bar);

        el.appendChild(content);
        el.appendChild(reply);
        el.appendChild(progress);

        if (toolbar.nextSibling) {
            container.insertBefore(el, toolbar.nextSibling);
        } else {
            container.appendChild(el);
        }
        this._syncToastToolbar();

        el.addEventListener('click', (e) => {
            if (e.target.closest('.notification-reply-area')) return;
            window.location.href = `messages.html?user=${encodeURIComponent(sid)}`;
        });

        this._attachSwipeToDismiss(el, () => {
            el.remove();
        });

        this._playNotificationSound();
        requestAnimationFrame(() => el.classList.add('show'));

        let timer = setTimeout(() => {
            el.classList.add('hiding');
            setTimeout(() => {
                el.remove();
                this._syncToastToolbar();
            }, 320);
        }, 8000);

        el.addEventListener('mouseenter', () => clearTimeout(timer));
        el.addEventListener('mouseleave', () => {
            timer = setTimeout(() => {
                el.classList.add('hiding');
                setTimeout(() => {
                    el.remove();
                    this._syncToastToolbar();
                }, 320);
            }, 3000);
        });
    }

    async _sendQuickReply(btn, receiverId) {
        const area = btn.closest('.notification-reply-area');
        const input = area?.querySelector('.notification-reply-input');
        if (!input || !input.value.trim()) return;
        const text = input.value.trim();
        input.value = '';

        if (typeof DirectMessagesService !== 'undefined') {
            const result = await DirectMessagesService.sendMessage(receiverId, text);
            if (result) {
                const el = btn.closest('.notification');
                if (el) {
                    el.classList.add('hiding');
                    setTimeout(() => el.remove(), 350);
                }
                this.showNotification('Ответ отправлен', 'success');
            }
        }
    }

    // Получить иконку для типа уведомления
    getNotificationIcon(type) {
        const icons = {
            'chat_reply': '💬',
            'new_episode': '🎬',
            'admin_message': '📢',
            'friend_request': '👥',
            'friend_accepted': '✅',
            'watch_invite': '🎬',
            'watch_together_invite': '📺',
            'system': '🔔',
            'info': 'ℹ️',
            'warning': '⚠️',
            'error': '❌',
            'success': '✅'
        };
        return icons[type] || '🔔';
    }

    // Отобразить список уведомлений
    renderNotifications() {
        const container = document.getElementById('notificationsList');
        if (!container) return;

        // Скрываем/показываем кнопку "Отметить все как прочитанные"
        const footer = document.getElementById('notificationsFooter');
        if (footer) {
            footer.style.display = this.notifications.length > 0 ? 'flex' : 'none';
        }

        if (this.notifications.length === 0) {
            container.innerHTML =
                '<div class="notifications-empty-hint">Пока пусто — новые события появятся здесь.</div>';
            return;
        }

        container.innerHTML = this.notifications.map(notif => `
            <div class="notification-item ${notif.read ? '' : 'unread'}" onclick="window.notificationService.markAsRead('${notif.id}'); ${notif.link ? `window.location.href='${notif.link}'` : ''}">
                <div class="notification-icon">${this.getNotificationIcon(notif.type)}</div>
                <div class="notification-item-body">
                    <div class="notification-title">${notif.title}</div>
                    <div class="notification-message">${notif.message}</div>
                    <div class="notification-time">${this.formatTime(notif.created_at)}</div>
                </div>
            </div>
        `).join('');
    }

    // Форматирование времени
    formatTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'только что';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч назад`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)} дн назад`;
        
        return date.toLocaleDateString('ru-RU');
    }
}

// Глобальный экземпляр
window.notificationService = new NotificationService();
window.clearAllToastNotifications = () => {
    if (window.notificationService) window.notificationService.clearAllToasts();
};

// Инициализация при загрузке
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.notificationService.init();
    });
} else {
    window.notificationService.init();
}
