// UI для панели Создателя
let currentUsersPage = 1;
const usersPerPage = 25;

// Вспомогательная функция для показа ошибок
function showErrorSafe(message) {
    if (typeof showError === 'function') {
        showError(message);
    } else {
        console.error('❌ [ERROR]', message);
        alert('Ошибка: ' + message);
    }
}

function adminPanelEscapeHtml(text) {
    if (text == null) return '';
    const d = document.createElement('div');
    d.textContent = String(text);
    return d.innerHTML;
}

/** Как в navigation.js: от корня сайта или из вложенных папок */
function adminContentBasePath() {
    const nav = typeof window !== 'undefined' ? window.navigationManager : null;
    if (nav && typeof nav.basePath === 'string') {
        return nav.basePath;
    }
    const path = typeof window !== 'undefined' ? window.location.pathname || '' : '';
    if (path.includes('/catalog/') || path.includes('/anime/') || path.includes('/manga/')) {
        return '../';
    }
    return '';
}

let creatorMalSearchBusy = false;

function creatorMalDisplayTitle(j) {
    if (!j) return '—';
    const en = j.title_english ? String(j.title_english).trim() : '';
    const def = j.title ? String(j.title).trim() : '';
    return en || def || (j.title_japanese ? String(j.title_japanese).trim() : '—');
}

function hideAdminPageLoading() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) loadingScreen.style.display = 'none';
    if (typeof hideLoading === 'function') hideLoading();
}

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    if (!supabaseClient) {
        showErrorSafe('Supabase не инициализирован');
        hideAdminPageLoading();
        return;
    }

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
        hideAdminPageLoading();
        window.location.href = 'index.html';
        return;
    }

    // Проверяем роль Создателя
    const isCreator = await window.creatorAdminPanel.checkCreatorStatus(user.id);
    if (!isCreator) {
        showErrorSafe('Доступ запрещен. Только для Создателя.');
        hideAdminPageLoading();
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        return;
    }

    window.creatorAdminPanel.currentUser = user;

    // Инициализация табов
    initTabs();
    
    // Загрузка дашборда
    loadDashboard();
    
    // Инициализация всех секций
    initUsersSection();
    initContentSection();
    initModerationSection();
    initNotificationsSection();
    initMaintenanceSettingsSection();

    hideAdminPageLoading();
});

// Инициализация табов
function initTabs() {
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchTab(tabName);
        });
    });
}

// Переключение табов
function switchTab(tabName) {
    // Обновляем активный таб
    document.querySelectorAll('.admin-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabName);
    });
    
    // Обновляем активный контент
    document.querySelectorAll('.admin-tab-content').forEach(c => {
        c.classList.toggle('active', c.id === `tab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
    });
    
    window.creatorAdminPanel.currentTab = tabName;
    
    // Загружаем данные для таба
    if (tabName === 'dashboard') {
        loadDashboard();
    } else if (tabName === 'users') {
        loadUsersAdvanced();
    } else if (tabName === 'content') {
        loadAnimeList();
    } else if (tabName === 'moderation') {
        loadChatMessagesMod();
    } else if (tabName === 'notifications') {
        loadNotificationsManagement();
    } else if (tabName === 'settings') {
        loadMaintenanceSettings();
    }
}

// Загрузка дашборда
async function loadDashboard() {
    const stats = await window.creatorAdminPanel.getAdvancedStats();

    // Обновляем статистику
    const statsContainer = document.getElementById('adminStats');
    if (statsContainer) {
        if (!stats) {
            statsContainer.innerHTML =
                '<div class="stat-card stat-card--wide"><p class="admin-inline-hint">Не удалось загрузить статистику. Проверьте сессию и доступ к базе.</p></div>';
        } else {
            statsContainer.innerHTML = `
            <div class="stat-card">
                <h3>👥 Пользователи</h3>
                <div class="stat-value">${stats.users}</div>
                <div class="stat-change positive">+${stats.newUsersToday} сегодня</div>
            </div>
            <div class="stat-card">
                <h3>💬 Сообщения в чате</h3>
                <div class="stat-value">${stats.chatMessages}</div>
                <div class="stat-change positive">+${stats.chatMessagesToday} сегодня</div>
            </div>
            <div class="stat-card">
                <h3>💎 VIP подписки</h3>
                <div class="stat-value">${stats.vipSubscriptions}</div>
                <div class="stat-change">Активные</div>
            </div>
            <div class="stat-card">
                <h3>🤖 ИИ подписки</h3>
                <div class="stat-value">${stats.premiumAISubscriptions}</div>
                <div class="stat-change">Premium / Unlimited</div>
            </div>
            <div class="stat-card">
                <h3>🚫 Забанены</h3>
                <div class="stat-value">${stats.bannedUsers}</div>
                <div class="stat-change">Пользователей</div>
            </div>
            <div class="stat-card">
                <h3>📊 Активные</h3>
                <div class="stat-value">${stats.activeUsers}</div>
                <div class="stat-change">За 7 дней</div>
            </div>
        `;
        }
    }

    // Быстрая статистика
    const quickStats = document.getElementById('quickStats');
    if (quickStats) {
        if (!stats) {
            quickStats.innerHTML = '';
        } else {
            quickStats.innerHTML = `
            <div class="quick-stat-item">
                <div class="quick-stat-label">Новых пользователей за неделю</div>
                <div class="quick-stat-value">${Math.floor(stats.newUsersToday * 7)}</div>
            </div>
            <div class="quick-stat-item">
                <div class="quick-stat-label">Сообщений в час (среднее)</div>
                <div class="quick-stat-value">${Math.floor(stats.chatMessagesToday / 24)}</div>
            </div>
            <div class="quick-stat-item">
                <div class="quick-stat-label">Сообщений в чате (всего)</div>
                <div class="quick-stat-value">${stats.chatMessages}</div>
            </div>
        `;
        }
    }

    const recentEl = document.getElementById('recentActivity');
    if (recentEl && window.creatorAdminPanel) {
        const rows = await window.creatorAdminPanel.getRecentDashboardActivity(12);
        if (!rows.length) {
            recentEl.innerHTML =
                '<p class="activity-empty">Пока нет недавних событий. Здесь появятся сообщения глобального чата и регистрации пользователей.</p>';
        } else {
            recentEl.innerHTML = rows
                .map((r) => {
                    const dt = r.at
                        ? new Date(r.at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
                        : '—';
                    return `<div class="activity-item activity-item--${r.type}">
                        <div class="activity-item-head">
                            <span class="activity-item-title">${r.title}</span>
                            <time class="activity-item-time" datetime="${r.at || ''}">${dt}</time>
                        </div>
                        ${r.body ? `<div class="activity-item-body">${r.body}</div>` : ''}
                    </div>`;
                })
                .join('');
        }
    }

    await loadVisitorAnalyticsPanel();
}

function bindVisitorAnalyticsOnce() {
    if (window.__reminkoVisitorAnalyticsBound) return;
    window.__reminkoVisitorAnalyticsBound = true;
    const btn = document.getElementById('visitorAnalyticsRefresh');
    const sel = document.getElementById('visitorAnalyticsPeriod');
    if (btn) btn.addEventListener('click', () => void loadVisitorAnalyticsPanel());
    if (sel) sel.addEventListener('change', () => void loadVisitorAnalyticsPanel());
}

async function loadVisitorAnalyticsPanel() {
    const el = document.getElementById('visitorAnalyticsContent');
    if (!el || !window.creatorAdminPanel) return;
    bindVisitorAnalyticsOnce();
    const daysSel = document.getElementById('visitorAnalyticsPeriod');
    const days = daysSel ? parseInt(daysSel.value, 10) || 7 : 7;
    el.innerHTML = '<p class="admin-inline-hint">Загрузка…</p>';
    const { bundle, recent, error } = await window.creatorAdminPanel.getSiteVisitAnalytics(days);
    if (error) {
        el.innerHTML = `<p class="admin-inline-hint" style="color:#f87171;">${adminPanelEscapeHtml(error)}</p>`;
        return;
    }
    const s = bundle && bundle.summary ? bundle.summary : {};
    const topPaths = Array.isArray(bundle && bundle.top_paths) ? bundle.top_paths : [];
    const byDay = Array.isArray(bundle && bundle.by_day) ? bundle.by_day : [];

    let html = '';
    html += '<div class="visitor-analytics-grid">';
    html += `<div class="visitor-analytics-card"><h4>Уникальные посетители</h4><div class="vac-value">${Number(
        s.unique_visitors || 0
    )}</div><div class="admin-inline-hint" style="margin-top:0.35rem;font-size:0.8rem;">по id в браузере</div></div>`;
    html += `<div class="visitor-analytics-card"><h4>Просмотры страниц</h4><div class="vac-value">${Number(
        s.pageviews || 0
    )}</div></div>`;
    html += `<div class="visitor-analytics-card"><h4>Событий всего</h4><div class="vac-value">${Number(
        s.total_events || 0
    )}</div><div class="admin-inline-hint" style="margin-top:0.35rem;font-size:0.8rem;">страницы и действия</div></div>`;
    html += `<div class="visitor-analytics-card"><h4>Уникальных аккаунтов</h4><div class="vac-value">${Number(
        s.unique_logged_accounts || 0
    )}</div><div class="admin-inline-hint" style="margin-top:0.35rem;font-size:0.8rem;">хотя бы раз с логином</div></div>`;
    html += `<div class="visitor-analytics-card"><h4>Событий с логином</h4><div class="vac-value">${Number(
        s.events_by_logged_in || 0
    )}</div></div>`;
    html += '</div>';

    if (byDay.length) {
        html += '<h3 class="visitor-analytics-subh">По дням (UTC)</h3><div class="visitor-analytics-byday">';
        byDay.forEach((row) => {
            const day = row.day !== undefined && row.day !== null ? row.day : '—';
            const cnt = row.cnt !== undefined && row.cnt !== null ? row.cnt : 0;
            html += `<span><strong>${adminPanelEscapeHtml(String(day))}</strong>: ${Number(cnt)}</span>`;
        });
        html += '</div>';
    }

    if (topPaths.length) {
        html += '<h3 class="visitor-analytics-subh">Популярные страницы</h3>';
        html +=
            '<div class="visitor-analytics-table-wrap"><table class="visitor-analytics-table"><thead><tr><th>Путь</th><th>Счётчик</th></tr></thead><tbody>';
        topPaths.forEach((row) => {
            const p = row.path != null ? row.path : '—';
            const c = row.cnt !== undefined && row.cnt !== null ? row.cnt : 0;
            html += `<tr><td class="vac-mono">${adminPanelEscapeHtml(String(p))}</td><td>${Number(c)}</td></tr>`;
        });
        html += '</tbody></table></div>';
    }

    html += '<h3 class="visitor-analytics-subh">Лента событий</h3>';
    html +=
        '<div class="visitor-analytics-table-wrap"><table class="visitor-analytics-table"><thead><tr><th>Время</th><th>Тип</th><th>Путь</th><th>Заголовок вкладки</th><th>User id</th><th>Гость</th><th>Referrer</th><th>UA / meta</th></tr></thead><tbody>';
    if (!recent || !recent.length) {
        html += '<tr><td colspan="8">За выбранный период записей нет — откройте сайт с другого браузера или подождите сбор.</td></tr>';
    } else {
        recent.forEach((r) => {
            const dt = r.created_at
                ? new Date(r.created_at).toLocaleString('ru-RU', {
                      dateStyle: 'short',
                      timeStyle: 'medium'
                  })
                : '—';
            const acc = r.user_id
                ? `${adminPanelEscapeHtml(String(r.user_id).slice(0, 10))}…`
                : '—';
            const vid = r.visitor_id
                ? `${adminPanelEscapeHtml(String(r.visitor_id).slice(0, 12))}…`
                : '—';
            const refRaw = r.referrer ? String(r.referrer) : '';
            const ref = refRaw
                ? `${adminPanelEscapeHtml(refRaw.slice(0, 56))}${refRaw.length > 56 ? '…' : ''}`
                : '—';
            let kind =
                r.event_kind === 'action'
                    ? 'action' +
                      (r.event_label
                          ? ': ' + adminPanelEscapeHtml(String(r.event_label).slice(0, 120))
                          : '')
                    : adminPanelEscapeHtml(String(r.event_kind || 'pageview'));
            let ua = r.user_agent ? String(r.user_agent).slice(0, 96) : '';
            if (r.meta != null) {
                try {
                    const mj = JSON.stringify(r.meta).slice(0, 96);
                    ua = ua ? `${ua} · ${mj}` : mj;
                } catch (_) {
                    /* ignore */
                }
            }
            html += `<tr><td>${adminPanelEscapeHtml(dt)}</td><td>${kind}</td><td class="vac-mono">${adminPanelEscapeHtml(
                String(r.path || '—').slice(0, 120)
            )}</td><td>${adminPanelEscapeHtml(
                String(r.page_title || '—').slice(0, 72)
            )}</td><td class="vac-mono">${acc}</td><td class="vac-mono">${vid}</td><td class="vac-mono">${ref}</td><td class="vac-mono">${adminPanelEscapeHtml(
                ua
            )}</td></tr>`;
        });
    }
    html += '</tbody></table></div>';

    el.innerHTML = html;
}

// Инициализация секции пользователей
function initUsersSection() {
    // Поиск и фильтры уже есть в HTML
}

// Загрузка пользователей с фильтрами
async function loadUsersAdvanced(page = 1) {
    currentUsersPage = page;
    const search = document.getElementById('usersSearchInput')?.value || '';
    const banFilter = document.getElementById('usersBanFilter')?.value || '';
    
    const filters = {
        search: search,
        banned: banFilter ? banFilter === 'true' : undefined,
        excludeUserId: window.creatorAdminPanel.currentUser?.id || undefined
    };
    
    const result = await window.creatorAdminPanel.getUsersAdvanced(page, usersPerPage, filters);
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    if (result.users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">Пользователи не найдены</td></tr>';
        return;
    }
    
    tbody.innerHTML = result.users.map(u => `
        <tr>
            <td style="font-family: monospace; font-size: 0.85rem;">${u.id.substring(0, 8)}...</td>
            <td>${u.email || 'Не указан'}</td>
            <td>${u.username || 'Без имени'}</td>
            <td>
                ${
                    u.is_site_creator_account
                        ? '<span style="color:#e9d5ff;font-weight:700;">Навсегда (создатель)</span>'
                        : u.vip
                          ? `<span style="color: #ffd700;">VIP до ${
                                u.vip.expires_at
                                    ? new Date(u.vip.expires_at).toLocaleDateString('ru-RU')
                                    : '—'
                            }</span>`
                          : 'Нет'
                }
            </td>
            <td>
                ${
                    u.is_site_creator_account
                        ? '<span style="color:#e9d5ff;font-weight:700;">Unlimited (создатель)</span>'
                        : `<span style="text-transform: capitalize;">${u.ai_subscription?.type || 'free'}</span>`
                }
            </td>
            <td>
                ${u.is_banned ? `<span style="color: #ef4444;">Забанен</span>` : '<span style="color: #10b981;">Активен</span>'}
            </td>
            <td>
                <small>💬 ${u.activity?.chat_messages || 0}</small>
            </td>
            <td>
                <button class="admin-btn" onclick="showUserActions('${u.id}')" style="padding: 0.5rem; font-size: 0.85rem;">⚙️</button>
            </td>
        </tr>
    `).join('');
    
    // Пагинация
    updateUsersPagination(result.total, page);
}

// Обновление пагинации пользователей
function updateUsersPagination(total, currentPage) {
    const pagination = document.getElementById('usersPagination');
    if (!pagination) return;
    
    const totalPages = Math.ceil(total / usersPerPage);
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    let html = '';
    if (currentPage > 1) {
        html += `<button class="pagination-btn" onclick="loadUsersAdvanced(${currentPage - 1})">← Назад</button>`;
    }
    
    for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
        html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="loadUsersAdvanced(${i})">${i}</button>`;
    }
    
    if (currentPage < totalPages) {
        html += `<button class="pagination-btn" onclick="loadUsersAdvanced(${currentPage + 1})">Вперёд →</button>`;
    }
    
    pagination.innerHTML = html;
}

// Показать действия с пользователем
async function showUserActions(userId) {
    const { data: user } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    
    if (!user) return;

    let targetCreator = false;
    try {
        const { data: userEmail } = await supabaseClient.rpc('get_user_email', { user_id: userId });
        targetCreator =
            typeof isSiteCreatorEmail === 'function' && isSiteCreatorEmail(userEmail);
    } catch (_) {}
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2 class="modal-title">Действия с пользователем</h2>
                <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <p><strong>Имя:</strong> ${user.username || 'Без имени'}</p>
                <p><strong>ID:</strong> <code>${userId}</code></p>
                <p><strong>Статус:</strong> ${user.is_banned ? 'Забанен' : 'Активен'}</p>
                ${
                    targetCreator
                        ? '<p style="margin-top:0.75rem;color:var(--text-secondary);">Учётная запись создателя: VIP «Вместе» и Minko AI без срока — выдавать или снимать не требуется.</p>'
                        : ''
                }
                
                <div style="margin-top: 1.5rem;">
                    <h3>Быстрые действия:</h3>
                    <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 1rem;">
                        ${user.is_banned ? 
                            `<button class="admin-btn" onclick="toggleBan('${userId}', false)">✅ Разбанить</button>` :
                            `<button class="admin-btn admin-btn-danger" onclick="toggleBan('${userId}', true)">🚫 Забанить</button>`
                        }
                        ${
                            targetCreator
                                ? ''
                                : `<button class="admin-btn" onclick="showEditSubscriptions('${userId}')">💎 Услуги: VIP и ИИ</button>`
                        }
                        <button class="admin-btn" onclick="showUserActivity('${userId}')">📊 Статистика активности</button>
                        <button class="admin-btn" onclick="sendNotificationToUser('${userId}')">🔔 Отправить уведомление</button>
                        <button class="admin-btn" onclick="muteUserChatAction('${userId}')">🔇 Мут в чате</button>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="admin-btn admin-btn-secondary" onclick="this.closest('.modal').remove()">Закрыть</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Бан/разбан пользователя
async function toggleBan(userId, ban) {
    const reason = ban ? prompt('Причина бана:') : '';
    if (ban && !reason) {
        showErrorSafe('Укажите причину бана');
        return;
    }
    
    const result = await window.creatorAdminPanel.toggleUserBan(userId, ban, reason);
    if (result.success) {
        showSuccess(result.message);
        document.querySelector('.modal.active')?.remove();
        loadUsersAdvanced(currentUsersPage);
    } else {
        showErrorSafe(result.message || 'Ошибка');
    }
}

// Мут в чате
async function muteUserChatAction(userId) {
    const hours = prompt('Количество часов мута:', '24');
    if (!hours) return;
    
    const reason = prompt('Причина мута:', 'Нарушение правил');
    if (!reason) return;
    
    const result = await window.creatorAdminPanel.muteUserChat(userId, parseInt(hours), reason);
    if (result.success) {
        showSuccess(result.message);
        document.querySelector('.modal.active')?.remove();
    } else {
        showErrorSafe(result.message || 'Ошибка');
    }
}

// Инициализация секции контента
function initContentSection() {
    // Табы контента
    document.querySelectorAll('.content-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const contentType = btn.dataset.content;
            document.querySelectorAll('.content-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`content${contentType.charAt(0).toUpperCase() + contentType.slice(1)}`).classList.add('active');
            
            if (contentType === 'anime') loadAnimeList();
            else if (contentType === 'manga') loadMangaList();
            else if (contentType === 'music') loadMusicTracks();
        });
    });
}

// Список аниме, добавленных в глобальный каталог (Supabase catalog_site_anime)
async function loadAnimeList() {
    const container = document.getElementById('animeList');
    if (!container || !window.creatorAdminPanel) return;

    container.innerHTML = '<div style="text-align: center; padding: 2rem;">Загрузка каталога…</div>';

    const res = await window.creatorAdminPanel.listCatalogSiteAnime();
    if (!res.success) {
        container.innerHTML = `<div style="padding: 1.5rem; color: var(--error, #e74c3c);">${adminPanelEscapeHtml(
            res.message || 'Ошибка'
        )}</div>`;
        showErrorSafe(
            res.message ||
                'Проверьте таблицу catalog_site_anime и политики RLS (файл database.sql на проекте Supabase).'
        );
        return;
    }

    const q = (document.getElementById('animeSearch')?.value || '').trim().toLowerCase();
    let rows = res.rows || [];
    if (q) {
        rows = rows.filter((r) => {
            const j = r.jikan || {};
            const t = `${r.title_ru || ''} ${j.title || ''} ${j.title_english || ''} ${j.title_japanese || ''}`.toLowerCase();
            return t.includes(q);
        });
    }

    if (!rows.length) {
        container.innerHTML =
            '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">Пока нет записей. Нажмите «Добавить по названию (MAL)» — данные загрузятся из Jikan и появятся в каталоге сайта у всех пользователей.</div>';
        return;
    }

    container.innerHTML = rows
        .map((r) => {
            const j = r.jikan || {};
            const title =
                (r.title_ru && String(r.title_ru).trim()) || j.title_english || j.title || '—';
            const mid = parseInt(r.mal_id, 10);
            const virtualId = 10000000 + (Number.isNaN(mid) ? 0 : mid);
            const poster = j.images?.jpg?.small_image_url || j.images?.jpg?.image_url || '';
            const year = j.year ? ` • ${j.year}` : '';
            const viewUrl = `${adminContentBasePath()}anime/view.html?id=${virtualId}`;
            const posterHtml = poster
                ? `<img src="${String(poster).replace(/"/g, '&quot;')}" alt="" width="52" height="74" style="object-fit:cover;border-radius:8px;flex-shrink:0;" loading="lazy" referrerpolicy="no-referrer">`
                : '';
            return `
            <div class="content-item">
                <div class="content-item-header" style="display:flex;gap:14px;align-items:flex-start;">
                    ${posterHtml}
                    <div style="flex:1;min-width:0;">
                        <div class="content-item-title">${adminPanelEscapeHtml(title)}</div>
                        <div class="content-item-meta">MAL #${mid}${year} • id на сайте: ${virtualId}</div>
                    </div>
                </div>
                <div class="content-item-actions">
                    <a class="admin-btn" href="${viewUrl}" target="_blank" rel="noopener">Страница аниме</a>
                    <button type="button" class="admin-btn admin-btn-danger" onclick="deleteSiteCatalogAnimeConfirm(${mid})">Удалить из каталога</button>
                </div>
            </div>`;
        })
        .join('');
}

async function deleteSiteCatalogAnimeConfirm(malId) {
    if (!confirm(`Удалить MAL #${malId} из глобального каталога сайта?`)) return;
    const r = await window.creatorAdminPanel.deleteCatalogSiteAnime(malId);
    if (r.success) {
        if (typeof showSuccess === 'function') showSuccess(r.message);
        else if (typeof showInfo === 'function') showInfo(r.message);
        if (typeof window.refreshSiteCatalogJikanFromSupabase === 'function') {
            await window.refreshSiteCatalogJikanFromSupabase();
        }
        loadAnimeList();
    } else {
        showErrorSafe(r.message || 'Ошибка удаления');
    }
}

// Загрузка списка манги
async function loadMangaList() {
    const container = document.getElementById('mangaList');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align: center; padding: 2rem;">Загрузка...</div>';
    
    if (typeof mangaDatabase !== 'undefined') {
        const mangaList = mangaDatabase.all || [];
        container.innerHTML = mangaList.map(manga => `
            <div class="content-item">
                <div class="content-item-header">
                    <div>
                        <div class="content-item-title">${manga.title}</div>
                        <div class="content-item-meta">${manga.year} • ${manga.type} • Рейтинг: ${manga.rating}</div>
                    </div>
                </div>
                <div class="content-item-actions">
                    <button class="admin-btn" onclick="editManga(${manga.id})">✏️ Редактировать</button>
                    <button class="admin-btn admin-btn-danger" onclick="deleteManga(${manga.id})">🗑️ Удалить</button>
                </div>
            </div>
        `).join('');
    } else {
        container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">База данных манги не загружена</div>';
    }
}

// Загрузка музыки
async function loadMusicTracks() {
    const container = document.getElementById('musicTracksList');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align: center; padding: 2rem;">Загрузка...</div>';
    
    try {
        const response = await (typeof safeFetch !== 'undefined' 
            ? safeFetch('music/tracks.json')
            : fetch('music/tracks.json'));
        if (response.ok) {
            const tracks = await response.json();
            container.innerHTML = `
                <div style="margin-bottom: 1rem; color: var(--text-secondary);">Найдено треков: ${tracks.length}</div>
                <div class="music-tracks-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem;">
                    ${tracks.map(track => `
                        <div class="music-track-item">
                            <div class="music-track-name">${track.name}</div>
                            <div class="music-track-file">${track.file}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">Не удалось загрузить список треков</div>';
        }
    } catch (error) {
        console.error('Ошибка загрузки треков:', error);
        container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">Ошибка загрузки</div>';
    }
}

function showUploadMusicModal() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2 class="modal-title">🎵 Загрузить трек</h2>
                <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <p style="color: var(--text-secondary); margin-bottom: 1rem;">Для загрузки трека поместите MP3 файл в папку music/ и нажмите "Обновить список треков"</p>
                <div style="padding: 1rem; background: rgba(168, 85, 247, 0.1); border-radius: 8px;">
                    <p><strong>Инструкция:</strong></p>
                    <ol style="margin-left: 1.5rem; color: var(--text-secondary);">
                        <li>Поместите MP3 файл в папку <code>music/</code></li>
                        <li>Вернитесь в панель управления</li>
                        <li>Нажмите "🔄 Обновить список треков"</li>
                        <li>Трек автоматически появится в плейлисте</li>
                    </ol>
                </div>
            </div>
            <div class="modal-footer">
                <button class="admin-btn" onclick="this.closest('.modal').remove()">Закрыть</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Инициализация модерации
function initModerationSection() {
    document.querySelectorAll('.mod-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const modType = btn.dataset.mod;
            document.querySelectorAll('.mod-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.mod-section').forEach(s => s.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`mod${modType.charAt(0).toUpperCase() + modType.slice(1)}`).classList.add('active');
            
            if (modType === 'chat') loadChatMessagesMod();
        });
    });
}

// Загрузка сообщений чата для модерации
async function loadChatMessagesMod() {
    const container = document.getElementById('chatMessagesMod');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align: center; padding: 2rem;">Загрузка...</div>';
    
    const search = document.getElementById('chatSearchInput')?.value || '';
    const dateFrom = document.getElementById('chatDateFrom')?.value || '';
    const dateTo = document.getElementById('chatDateTo')?.value || '';
    
    const filters = {
        search: search,
        fromDate: dateFrom ? new Date(dateFrom).toISOString() : undefined,
        toDate: dateTo ? new Date(dateTo).toISOString() : undefined,
        limit: 100
    };
    
    const messages = await window.creatorAdminPanel.getChatMessages(filters);
    
    if (messages.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">Сообщения не найдены</div>';
        return;
    }
    
    container.innerHTML = messages.map(msg => `
        <div class="message-item">
            <div class="message-item-header">
                <div>
                    <div class="message-item-user">${msg.user?.username || 'Неизвестный'}</div>
                    <div class="message-item-time">${new Date(msg.created_at).toLocaleString('ru-RU')}</div>
                </div>
            </div>
            <div style="color: var(--text-color); margin: 0.5rem 0;">${msg.message}</div>
            <div class="message-item-actions">
                <button class="admin-btn admin-btn-danger" style="padding: 0.5rem; font-size: 0.85rem;" onclick="deleteChatMessage('${msg.id}')">🗑️ Удалить</button>
                <button class="admin-btn" style="padding: 0.5rem; font-size: 0.85rem;" onclick="muteUserChatAction('${msg.user_id}')">🔇 Мут</button>
            </div>
        </div>
    `).join('');
}

// Удаление сообщения чата
async function deleteChatMessage(messageId) {
    if (!confirm('Удалить сообщение?')) return;
    
    const reason = prompt('Причина удаления (необязательно):', '');
    const result = await window.creatorAdminPanel.deleteChatMessage(messageId, reason);
    
    if (result.success) {
        showSuccess(result.message);
        loadChatMessagesMod();
    } else {
        showErrorSafe(result.message || 'Ошибка удаления');
    }
}

// Инициализация уведомлений
function initNotificationsSection() {
    // Уже есть кнопки в HTML
}

function showSendNotificationModal(type) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2 class="modal-title">🔔 Отправить уведомление</h2>
                <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                ${type === 'single' ? `
                    <div class="setting-item">
                        <label>ID пользователя:</label>
                        <input type="text" class="setting-input" id="notifUserId" placeholder="UUID пользователя">
                    </div>
                ` : type === 'bulk' ? `
                    <div class="setting-item">
                        <label>ID пользователей (через запятую):</label>
                        <textarea class="setting-textarea" id="notifUserIds" placeholder="uuid1, uuid2, uuid3"></textarea>
                    </div>
                ` : ''}
                <div class="setting-item">
                    <label>Тип уведомления:</label>
                    <select class="setting-select" id="notifType">
                        <option value="system">Система</option>
                        <option value="admin_message">Сообщение от админа</option>
                        <option value="new_episode">Новая серия</option>
                        <option value="chat_reply">Ответ в чате</option>
                    </select>
                </div>
                <div class="setting-item">
                    <label>Заголовок:</label>
                    <input type="text" class="setting-input" id="notifTitle" placeholder="Заголовок уведомления">
                </div>
                <div class="setting-item">
                    <label>Сообщение:</label>
                    <textarea class="setting-textarea" id="notifMessage" placeholder="Текст уведомления"></textarea>
                </div>
                <div class="setting-item">
                    <label>Ссылка (необязательно):</label>
                    <input type="text" class="setting-input" id="notifLink" placeholder="/page.html">
                </div>
            </div>
            <div class="modal-footer">
                <button class="admin-btn" onclick="sendNotification('${type}')">Отправить</button>
                <button class="admin-btn admin-btn-secondary" onclick="this.closest('.modal').remove()">Отмена</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function sendNotification(type) {
    const title = document.getElementById('notifTitle')?.value;
    const message = document.getElementById('notifMessage')?.value;
    const notifType = document.getElementById('notifType')?.value;
    const link = document.getElementById('notifLink')?.value || null;
    
    if (!title || !message) {
        showErrorSafe('Заполните заголовок и сообщение');
        return;
    }
    
    let result;
    if (type === 'single') {
        const userId = document.getElementById('notifUserId')?.value;
        if (!userId) {
            showErrorSafe('Введите ID пользователя');
            return;
        }
        result = await window.creatorAdminPanel.sendNotificationToUser(userId, title, message, notifType, link);
    } else if (type === 'bulk') {
        const userIdsText = document.getElementById('notifUserIds')?.value;
        if (!userIdsText) {
            showErrorSafe('Введите ID пользователей');
            return;
        }
        const userIds = userIdsText.split(',').map(id => id.trim()).filter(id => id);
        result = await window.creatorAdminPanel.sendBulkNotifications(userIds, title, message, notifType, link);
    } else if (type === 'all') {
        if (!confirm('Отправить уведомление ВСЕМ пользователям?')) return;
        // Получаем всех пользователей
        const { data: profiles } = await supabaseClient.from('profiles').select('id');
        if (profiles) {
            const userIds = profiles.map(p => p.id);
            result = await window.creatorAdminPanel.sendBulkNotifications(userIds, title, message, notifType, link);
        } else {
            showErrorSafe('Ошибка получения списка пользователей');
            return;
        }
    }
    
    if (result && result.success) {
        showSuccess(result.message);
        document.querySelector('.modal.active')?.remove();
    } else {
        showErrorSafe(result?.message || 'Ошибка отправки');
    }
}

async function loadNotificationsManagement() {
    const container = document.getElementById('notificationsManagement');
    if (!container) return;
    
    container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Используйте кнопки выше для отправки уведомлений</p>';
}

// Добавление аниме в глобальный каталог (Jikan + Shikimori → Supabase → сайт)
function showAddAnimeModal() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:560px;" onclick="event.stopPropagation()">
            <div class="modal-header">
                <h2 class="modal-title">Добавить аниме в каталог сайта</h2>
            </div>
            <p style="font-size:0.88rem;opacity:0.88;margin:0 0 10px;line-height:1.45;">
                Поиск: <strong>Jikan</strong> (англ./яп.) и <strong>Shikimori</strong> (в т.ч. русское имя). Карточка MAL сохраняется в Supabase; на странице и в каталоге по умолчанию подставляются русские название и описание с Shikimori (если не заполните вручную ниже).
            </p>
            <div style="margin-bottom:10px;display:grid;gap:6px;">
                <label style="font-size:0.8rem;opacity:0.9;" for="creatorCatTitleRu">Русское название (необязательно)</label>
                <input type="text" id="creatorCatTitleRu" class="filter-input" placeholder="Если пусто — возьмём с Shikimori" autocomplete="off">
                <label style="font-size:0.8rem;opacity:0.9;" for="creatorCatDescRu">Описание на русском (необязательно)</label>
                <textarea id="creatorCatDescRu" class="filter-input" rows="2" style="resize:vertical;min-height:54px;" placeholder="Если пусто — текст с Shikimori"></textarea>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
                <input type="text" id="creatorMalQuery" class="filter-input" style="flex:1;min-width:200px;" placeholder="Поиск: русский, английский или японский..." autocomplete="off">
                <button type="button" class="admin-btn" id="creatorMalSearchBtn">Найти</button>
            </div>
            <div id="creatorMalResults" style="max-height:300px;overflow-y:auto;margin-bottom:12px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);"></div>
            <button type="button" class="admin-btn admin-btn-secondary" id="creatorMalCloseBtn">Закрыть</button>
        </div>`;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.addEventListener('click', close);
    modal.querySelector('.modal-content').addEventListener('click', (e) => e.stopPropagation());
    modal.querySelector('#creatorMalCloseBtn').addEventListener('click', close);

    async function ruOverridesForUpsert(malId, full) {
        let titleRu = modal.querySelector('#creatorCatTitleRu')?.value?.trim() || '';
        let descRu = modal.querySelector('#creatorCatDescRu')?.value?.trim() || '';
        if ((!titleRu || !descRu) && window.shikimoriApi?.enqueueFetchShikimoriByMalId) {
            try {
                const sh = await window.shikimoriApi.enqueueFetchShikimoriByMalId(
                    malId,
                    (full && (full.title_english || full.title)) || ''
                );
                if (!titleRu && sh?.russian) titleRu = String(sh.russian).trim();
                if (!descRu && sh && window.shikimoriApi.stripHtml) {
                    const d = window.shikimoriApi.stripHtml(sh.description_html || sh.description || '');
                    if (d) descRu = d;
                }
            } catch (_) {
                /* ignore */
            }
        }
        return {
            title_ru: titleRu || null,
            description_ru: descRu || null
        };
    }

    async function runSearch() {
        const input = modal.querySelector('#creatorMalQuery');
        const box = modal.querySelector('#creatorMalResults');
        const btn = modal.querySelector('#creatorMalSearchBtn');
        const raw = (input?.value || '').trim();
        if (!raw) {
            showErrorSafe('Введите название');
            return;
        }
        if (typeof window.jikanSearchAnimeMany !== 'function') {
            showErrorSafe('Не подключён scripts/jikan-api.js');
            return;
        }
        if (creatorMalSearchBusy) return;
        creatorMalSearchBusy = true;
        const label = btn.textContent;
        btn.disabled = true;
        btn.textContent = '…';
        box.innerHTML = '<div style="padding:12px;opacity:0.85;">Запрос к Jikan и Shikimori…</div>';
        try {
            let jList = await window.jikanSearchAnimeMany(raw, 12);
            jList = jList || [];
            const adultOk =
                typeof window.isAdultContentEnabled === 'function' && window.isAdultContentEnabled();
            if (!adultOk && typeof window.jikanItemHasRestrictedGenre === 'function') {
                jList = jList.filter((j) => !window.jikanItemHasRestrictedGenre(j));
            }

            const byMal = new Map();
            for (const j of jList) {
                if (j && j.mal_id) byMal.set(j.mal_id, { kind: 'jikan', jikan: j });
            }
            if (window.shikimoriApi?.searchAnimesByQuery) {
                try {
                    const sList = await window.shikimoriApi.searchAnimesByQuery(raw, 15);
                    for (const s of sList || []) {
                        const mal = s && s.myanimelist_id;
                        if (!mal) continue;
                        if (!byMal.has(mal)) {
                            byMal.set(mal, { kind: 'shiki', shiki: s });
                        }
                    }
                } catch (_) {
                    /* ignore */
                }
            }

            if (!byMal.size) {
                box.innerHTML =
                    '<div style="padding:12px;">Ничего не найдено. Попробуйте другое написание или подождите (лимит API).</div>';
                return;
            }

            box.innerHTML = '';
            for (const [malId, item] of byMal) {
                const row = document.createElement('div');
                row.style.cssText =
                    'display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.06);';

                let displayTitle = '';
                let poster = '';
                let jikanLite = null;
                if (item.kind === 'jikan') {
                    jikanLite = item.jikan;
                    displayTitle = creatorMalDisplayTitle(jikanLite);
                    poster =
                        jikanLite.images?.jpg?.small_image_url || jikanLite.images?.jpg?.image_url || '';
                } else {
                    const s = item.shiki;
                    displayTitle =
                        (s.russian && String(s.russian).trim()) ||
                        s.name ||
                        `MAL #${malId}`;
                    poster = (s.image && (s.image.preview || s.image.original)) || '';
                }

                const srcEsc = String(poster).replace(/"/g, '&quot;');
                row.innerHTML = `
                    <img src="${srcEsc}" alt="" width="44" height="62" style="object-fit:cover;border-radius:6px;flex-shrink:0;background:rgba(255,255,255,0.06);" loading="lazy" referrerpolicy="no-referrer">
                    <div style="flex:1;min-width:0;font-size:0.9rem;font-weight:600;">${adminPanelEscapeHtml(displayTitle)}</div>
                    <button type="button" class="admin-btn" data-mal="${malId}">В каталог</button>`;
                const img = row.querySelector('img');
                if (img && !poster) img.style.visibility = 'hidden';
                if (img)
                    img.addEventListener('error', () => {
                        img.style.visibility = 'hidden';
                    });

                row.querySelector('button').addEventListener('click', async () => {
                    const btnAdd = row.querySelector('button');
                    btnAdd.disabled = true;
                    let full = jikanLite;
                    if (typeof window.jikanFetchAnimeFullByMalId === 'function') {
                        const fd = await window.jikanFetchAnimeFullByMalId(malId);
                        if (fd) full = fd;
                    }
                    if (!full || !full.mal_id) {
                        showErrorSafe('Не удалось загрузить карточку с MyAnimeList (Jikan).');
                        btnAdd.disabled = false;
                        return;
                    }
                    const opts = await ruOverridesForUpsert(malId, full);
                    const result = await window.creatorAdminPanel.upsertCatalogSiteAnime(full, opts);
                    if (result.success) {
                        if (typeof showSuccess === 'function') showSuccess(result.message || 'Готово');
                        if (typeof window.refreshSiteCatalogJikanFromSupabase === 'function') {
                            await window.refreshSiteCatalogJikanFromSupabase();
                        }
                        loadAnimeList();
                        close();
                    } else {
                        showErrorSafe(result.message || 'Ошибка записи');
                        btnAdd.disabled = false;
                    }
                });
                box.appendChild(row);
            }
        } catch (e) {
            box.innerHTML =
                '<div style="padding:12px;color:var(--error,#e74c3c);">Ошибка или лимит API — подождите минуту и повторите.</div>';
        } finally {
            creatorMalSearchBusy = false;
            btn.disabled = false;
            btn.textContent = label;
        }
    }

    modal.querySelector('#creatorMalSearchBtn').addEventListener('click', () => void runSearch());
    const qEl = modal.querySelector('#creatorMalQuery');
    qEl?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            void runSearch();
        }
    });
    setTimeout(() => qEl?.focus(), 50);
}

function showAddMangaModal() {
    showInfo('Добавление манги будет реализовано в будущем');
}

function editAnime(id) {
    showInfo(
        `Встроенная база в data.js правится вручную в коде. Глобальные карточки MAL — во вкладке «Контент» (список catalog_site_anime). #${id}`
    );
}

function deleteAnime(id) {
    showInfo(`Удаление из встроенной базы data.js — вручную. Для каталога сайта используйте кнопку «Удалить из каталога». id: ${id}`);
}

function editManga(id) {
    showInfo(`Редактирование манги #${id} будет реализовано в будущем`);
}

function deleteManga(id) {
    if (confirm('Удалить мангу? (Это действие нельзя отменить)')) {
        showInfo('Удаление манги будет реализовано в будущем');
    }
}

async function showUserActivity(userId) {
    const activity = await window.creatorAdminPanel.getUserActivity(userId, 7);
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2 class="modal-title">📊 Активность пользователя</h2>
                <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                ${activity ? `
                    <p><strong>За последние 7 дней:</strong></p>
                    <ul>
                        <li>Сообщений в общем чате за период: ${activity.chat_messages}</li>
                    </ul>
                ` : '<p>Ошибка загрузки статистики</p>'}
            </div>
            <div class="modal-footer">
                <button class="admin-btn" onclick="this.closest('.modal').remove()">Закрыть</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function showEditSubscriptions(userId) {
    try {
        const { data: em } = await supabaseClient.rpc('get_user_email', { user_id: userId });
        if (typeof isSiteCreatorEmail === 'function' && isSiteCreatorEmail(em)) {
            showErrorSafe(
                'Учётная запись создателя не настраивается здесь — услуги включены без записи в базе.'
            );
            return;
        }
    } catch (_) {}

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 520px;">
            <div class="modal-header">
                <h2 class="modal-title">Услуги пользователя</h2>
                <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <p style="font-size:0.86rem;color:var(--text-secondary);line-height:1.5;margin:0 0 1.25rem;">
                    Два независимых продукта: <strong>«Смотреть вместе»</strong> и <strong>Minko AI</strong>.
                    Срок задаётся в днях от сегодняшней даты.
                </p>

                <div style="border:1px solid rgba(255,215,0,0.35);border-radius:10px;padding:1rem;margin-bottom:1.25rem;background:rgba(255,215,0,0.06);">
                    <h3 style="margin:0 0 0.65rem;font-size:1rem;color:#ffd700;">🎬 VIP «Смотреть вместе»</h3>
                    <p style="font-size:0.82rem;color:var(--text-secondary);margin:0 0 0.75rem;line-height:1.45;">
                        Комнаты, лимиты гостей. Не связано с Minko AI.
                    </p>
                    <label style="font-size:0.88rem;">Срок после выдачи (дней):</label>
                    <input type="number" class="setting-input" id="editVIPDays" placeholder="30" min="1" value="30" style="margin-top:0.35rem;">
                    <div style="display:flex;gap:0.5rem;margin-top:0.75rem;flex-wrap:wrap;">
                        <button type="button" class="admin-btn" onclick="grantVIPForUser('${userId}')" style="flex:1;min-width:130px;">Выдать VIP</button>
                        <button type="button" class="admin-btn admin-btn-danger" onclick="revokeVIPForUser('${userId}')" style="flex:1;min-width:130px;">Снять VIP</button>
                    </div>
                </div>

                <div style="border:1px solid rgba(147,197,253,0.4);border-radius:10px;padding:1rem;background:rgba(147,197,253,0.07);">
                    <h3 style="margin:0 0 0.65rem;font-size:1rem;color:#93c5fd;">⭐ Minko AI (тариф)</h3>
                    <p style="font-size:0.82rem;color:var(--text-secondary);margin:0 0 0.75rem;line-height:1.45;">
                        Premium / Unlimited с датой окончания. «Снять» — перевести в Free без оплаты.
                    </p>
                    <label style="font-size:0.88rem;">Тариф:</label>
                    <select class="setting-select" id="editAIType" style="margin-top:0.35rem;">
                        <option value="premium">Premium</option>
                        <option value="unlimited">Unlimited</option>
                    </select>
                    <label style="margin-top:0.65rem;display:block;font-size:0.88rem;">Срок (дней):</label>
                    <input type="number" class="setting-input" id="editAIDays" placeholder="30" min="1" value="30" style="margin-top:0.35rem;">
                    <button type="button" class="admin-btn" onclick="grantAIForUser('${userId}')" style="margin-top:0.75rem;width:100%;">Выдать / продлить тариф ИИ</button>
                    <button type="button" class="admin-btn admin-btn-danger" onclick="revokeAIForUser('${userId}')" style="margin-top:0.5rem;width:100%;">Снять VIP Minko AI (Free)</button>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="admin-btn" onclick="this.closest('.modal').remove()">Закрыть</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function grantVIPForUser(userId) {
    const days = parseInt(document.getElementById('editVIPDays')?.value || '30', 10);
    if (!days || days < 1) {
        showErrorSafe('Укажите число дней (от 1)');
        return;
    }
    const result = await window.creatorAdminPanel.manageVIPSubscription(userId, 'grant', days);
    if (result.success) {
        showSuccess(result.message);
        document.querySelector('.modal.active')?.remove();
        loadUsersAdvanced(currentUsersPage);
    } else {
        showErrorSafe(result.message || 'Ошибка');
    }
}

async function revokeVIPForUser(userId) {
    if (!confirm('Снять VIP «Смотреть вместе» у этого пользователя?')) return;
    const result = await window.creatorAdminPanel.manageVIPSubscription(userId, 'revoke');
    if (result.success) {
        showSuccess(result.message);
        document.querySelector('.modal.active')?.remove();
        loadUsersAdvanced(currentUsersPage);
    } else {
        showErrorSafe(result.message || 'Ошибка');
    }
}

async function grantAIForUser(userId) {
    const type = document.getElementById('editAIType')?.value || 'premium';
    const daysRaw = document.getElementById('editAIDays')?.value;
    const days = parseInt(daysRaw || '30', 10);
    if (!days || days < 1) {
        showErrorSafe('Укажите срок в днях (от 1)');
        return;
    }
    const result = await window.creatorAdminPanel.manageAISubscription(userId, type, days);
    if (result.success) {
        showSuccess(result.message);
        document.querySelector('.modal.active')?.remove();
        loadUsersAdvanced(currentUsersPage);
    } else {
        showErrorSafe(result.message || 'Ошибка');
    }
}

async function revokeAIForUser(userId) {
    if (!confirm('Снять платный доступ Minko AI и перевести пользователя на Free?')) return;
    const result = await window.creatorAdminPanel.manageAISubscription(userId, 'free', null);
    if (result.success) {
        showSuccess(result.message || 'Тариф ИИ снят (Free)');
        document.querySelector('.modal.active')?.remove();
        loadUsersAdvanced(currentUsersPage);
    } else {
        showErrorSafe(result.message || 'Ошибка');
    }
}

async function sendNotificationToUser(userId) {
    showSendNotificationModal('single');
    setTimeout(() => {
        const input = document.getElementById('notifUserId');
        if (input) input.value = userId;
    }, 100);
}

const MAINT_ROUTE_OPTIONS = [
    ['home', 'Главная'],
    ['register', 'Регистрация (кнопка в шапке)'],
    ['chat', 'Общий чат'],
    ['messages', 'Личные сообщения'],
    ['friends', 'Друзья'],
    ['watch_together', 'Смотреть вместе'],
    ['profile', 'Профиль'],
    ['favorites', 'Избранное (аниме)'],
    ['info', 'Страница «Инфо» (бонусы, реклама)'],
    ['history', 'История просмотра'],
    ['favorites-manga', 'Избранное (манга)'],
    ['manga_catalog', 'Каталог манги'],
    ['minko_ai', 'Minko AI'],
    ['admin', 'Панель создателя'],
    ['support', 'Чат поддержки'],
    ['reader', 'Читалка манги']
];

function initMaintenanceSettingsSection() {
    const box = document.getElementById('maintExtraRoutes');
    const btn = document.getElementById('maintSaveBtn');
    if (!box || box.dataset.wired === '1') return;
    box.dataset.wired = '1';
    MAINT_ROUTE_OPTIONS.forEach(([key, label]) => {
        const id = `maintRoute_${key.replace(/[^a-z0-9_-]/gi, '_')}`;
        const wrap = document.createElement('label');
        wrap.className = 'setting-item';
        wrap.style.cssText = 'display:flex;align-items:center;gap:0.5rem;cursor:pointer;margin:0;';
        wrap.innerHTML = `<input type="checkbox" id="${id}" data-maint-route="${adminPanelEscapeHtml(key)}" /> <span>${adminPanelEscapeHtml(label)}</span>`;
        box.appendChild(wrap);
    });
    btn?.addEventListener('click', () => void saveMaintenanceSettings());
}

async function loadMaintenanceSettings() {
    initMaintenanceSettingsSection();
    const statusEl = document.getElementById('maintSaveStatus');
    const enabledEl = document.getElementById('maintEnabled');
    if (!supabaseClient || !enabledEl) return;
    const { data, error } = await supabaseClient.from('site_maintenance_config').select('*').eq('id', 1).maybeSingle();
    if (error) {
        if (statusEl) {
            statusEl.textContent =
                'Не удалось загрузить конфиг. Убедитесь, что в Supabase выполнен фрагмент database.sql для site_maintenance_config.';
        }
        return;
    }
    enabledEl.checked = !!(data && data.maintenance_enabled);
    const extras = new Set((data && data.extra_allowed_routes) || []);
    document.querySelectorAll('[data-maint-route]').forEach((cb) => {
        cb.checked = extras.has(cb.getAttribute('data-maint-route'));
    });
    if (statusEl) statusEl.textContent = '';
}

async function saveMaintenanceSettings() {
    const statusEl = document.getElementById('maintSaveStatus');
    if (!supabaseClient) {
        showErrorSafe('Нет подключения к Supabase');
        return;
    }
    const enabled = !!document.getElementById('maintEnabled')?.checked;
    const routes = [];
    document.querySelectorAll('[data-maint-route]:checked').forEach((cb) => {
        const k = cb.getAttribute('data-maint-route');
        if (k) routes.push(k);
    });
    const { error } = await supabaseClient.from('site_maintenance_config').upsert(
        {
            id: 1,
            maintenance_enabled: enabled,
            extra_allowed_routes: routes
        },
        { onConflict: 'id' }
    );
    if (error) {
        showErrorSafe(error.message || 'Не сохранено');
        return;
    }
    try {
        localStorage.setItem(
            'reminko_maintenance_v1',
            JSON.stringify({
                maintenance_enabled: enabled,
                extra_allowed_routes: routes
            })
        );
    } catch (_) {
        /* ignore */
    }
    if (statusEl) statusEl.textContent = 'Сохранено.';
    if (typeof showSuccess === 'function') showSuccess('Режим обновлён');
}
