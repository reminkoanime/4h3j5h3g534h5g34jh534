// Общий чат на сайте
const CHAT_DEBUG = false;
const chatLog = (...args) => CHAT_DEBUG && console.log(...args);
const chatWarn = (...args) => CHAT_DEBUG && console.warn(...args);

const GC_BLOCKED_STORAGE_KEY = 'reminko_gc_blocked_v1';
const GC_MAX_MESSAGE_LEN = 300;
const GC_THROTTLE_LIMIT = 5;
const GC_THROTTLE_WINDOW_MS = 10000;

const GC_SVG = {
    send: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/></svg>',
    ban: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
    alert: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    reply: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 7.5 7.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
    smile: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>'
};

class GlobalChat {
    constructor() {
        this.messages = [];
        this.isInitialized = false;
        this.messageLimit = 50;
        this.realtimeChannel = null;
        this.presenceChannel = null;
        this.profilesCache = new Map();
        this.pollTimer = null;
        this.pendingMessages = new Set();
        this.replyToMessage = null;
        this.blockedUserIds = new Set();
        this.messageSendTimes = [];
        this.isThrottled = false;
        this.replyModalMsgId = null;
        this.reactionModalMsgId = null;
        this.blockModalUserId = null;
    }

    loadBlockedFromStorage() {
        try {
            const raw = localStorage.getItem(GC_BLOCKED_STORAGE_KEY);
            const arr = raw ? JSON.parse(raw) : [];
            this.blockedUserIds = new Set(Array.isArray(arr) ? arr.filter(Boolean).map(String) : []);
        } catch {
            this.blockedUserIds = new Set();
        }
    }

    saveBlockedToStorage() {
        localStorage.setItem(GC_BLOCKED_STORAGE_KEY, JSON.stringify([...this.blockedUserIds]));
    }

    isUserBlocked(userId) {
        return userId && this.blockedUserIds.has(String(userId));
    }

    gcToast(msg) {
        if (typeof showSuccess === 'function') {
            showSuccess(msg);
            return;
        }
        const el = document.getElementById('gcToast');
        if (!el) return;
        el.textContent = msg;
        el.classList.add('gc-toast--show');
        setTimeout(() => el.classList.remove('gc-toast--show'), 2500);
    }

    updateCharCounter() {
        const input = document.getElementById('globalChatInput');
        const counter = document.getElementById('gcCharCounter');
        if (!input || !counter) return;
        const count = input.value.length;
        counter.textContent = `${count} / ${GC_MAX_MESSAGE_LEN}`;
        counter.classList.toggle('warning', count > 250 && count < GC_MAX_MESSAGE_LEN);
        counter.classList.toggle('max', count === GC_MAX_MESSAGE_LEN);
    }

    async init(containerId) {
        if (this.isInitialized) return;

        const container = document.getElementById(containerId);
        if (!container) {
            console.error('Контейнер чата не найден:', containerId);
            return;
        }

        this.container = container;
        this.loadBlockedFromStorage();
        this.createChatUI();

        await this.loadMessages();
        this.setupPresence();
        this.setupRealtime();
        this.isInitialized = true;
    }

    createChatUI() {
        this.container.innerHTML = `
<div class="gc-app">
  <header class="gc-header" id="gcHeader">
    <div class="gc-header-inner">
      <div>
        <h1 class="gc-title" id="gcChatTitle">💬 Общий чат</h1>
        <div class="gc-subtitle"><span>👥</span> <span id="gcOnlineCount">0</span> <span>онлайн</span></div>
      </div>
      <div class="gc-header-actions">
        <button type="button" class="gc-btn-icon gc-btn-icon--warn" id="gcBtnModerate" title="Вызвать модерацию">${GC_SVG.alert}</button>
        <button type="button" class="gc-btn-icon" id="gcBtnBlocked" title="Заблокированные пользователи">${GC_SVG.ban}</button>
      </div>
    </div>
  </header>
  <div class="gc-main">
    <div class="gc-glow-card">
      <div class="gc-messages" id="globalChatMessages"></div>
      <div id="gcThrottleWarn" class="gc-throttle-warn" hidden>⏱️ Слишком быстро! Подождите перед отправкой нового сообщения</div>
      <form id="globalChatForm" class="gc-form">
        <div class="gc-input-row">
          <textarea id="globalChatInput" class="gc-input" placeholder="Напишите сообщение (макс ${GC_MAX_MESSAGE_LEN} символов)..." maxlength="${GC_MAX_MESSAGE_LEN}" rows="1" autocomplete="off"></textarea>
          <button type="submit" id="globalChatSend" class="gc-btn-primary">${GC_SVG.send}<span>Отправить</span></button>
        </div>
        <div id="gcCharCounter" class="gc-char-counter">0 / ${GC_MAX_MESSAGE_LEN}</div>
      </form>
    </div>
  </div>
</div>

<div id="gcReplyModal" class="gc-modal" role="dialog" aria-modal="true">
  <div class="gc-modal-box">
    <div class="gc-modal-head">
      <h2 class="gc-modal-title">Ответить на сообщение</h2>
      <button type="button" class="gc-btn-icon" id="gcReplyClose" style="width:32px;height:32px;">${GC_SVG.x}</button>
    </div>
    <div id="gcReplyPreview" style="background:rgba(227,0,255,0.06);padding:12px;border-radius:8px;margin-bottom:16px;border-left:3px solid #e300ff;"></div>
    <form id="gcReplyForm">
      <input type="text" id="gcReplyInput" class="gc-field" placeholder="Напишите ответ..." maxlength="${GC_MAX_MESSAGE_LEN}" autocomplete="off">
      <div style="display:flex;gap:8px;">
        <button type="button" class="gc-btn-outline" style="flex:1;" id="gcReplyCancel">Отменить</button>
        <button type="submit" class="gc-btn-primary" style="flex:1;">Отправить ответ</button>
      </div>
    </form>
  </div>
</div>

<div id="gcReactionsModal" class="gc-modal" role="dialog" aria-modal="true">
  <div class="gc-modal-box gc-modal-box--narrow">
    <h3 class="gc-modal-title" style="margin:0 0 12px;">Лайк и реакции</h3>
    <p style="font-size:11px;color:rgba(232,224,236,0.5);margin:0 0 12px;">В базе сохраняется лайк ❤️; эмодзи — для настроения.</p>
    <div class="gc-reaction-grid" id="gcReactionButtons"></div>
  </div>
</div>

<div id="gcBlockModal" class="gc-modal" role="dialog" aria-modal="true">
  <div class="gc-modal-box" style="max-width:400px;">
    <h2 class="gc-modal-title" style="margin:0 0 12px;">Блокировать пользователя</h2>
    <p style="color:rgba(232,224,236,0.6);font-size:12px;margin-bottom:16px;">Вы не будете видеть сообщения <strong id="gcBlockUsername"></strong> в чате.</p>
    <div style="display:flex;gap:8px;">
      <button type="button" class="gc-btn-outline" style="flex:1;" id="gcBlockCancel">Отменить</button>
      <button type="button" class="gc-btn-primary" style="flex:1;background:#ff6b5b;" id="gcBlockConfirm">Блокировать</button>
    </div>
  </div>
</div>

<div id="gcModerateModal" class="gc-modal" role="dialog" aria-modal="true">
  <div class="gc-modal-box">
    <h2 class="gc-modal-title" style="margin:0 0 12px;">Вызвать модерацию</h2>
    <p style="color:rgba(232,224,236,0.6);font-size:12px;margin-bottom:12px;">Опишите причину обращения</p>
    <form id="gcModerateForm">
      <select id="gcModerateReason" class="gc-field">
        <option value="">Выберите причину</option>
        <option value="spam">Спам</option>
        <option value="inappropriate">Неуместный контент</option>
        <option value="harassment">Оскорбления</option>
        <option value="other">Другое</option>
      </select>
      <textarea id="gcModerateText" placeholder="Дополнительная информация..." maxlength="500"></textarea>
      <div style="display:flex;gap:8px;">
        <button type="button" class="gc-btn-outline" style="flex:1;" id="gcModerateCancel">Отменить</button>
        <button type="submit" class="gc-btn-primary" style="flex:1;">Отправить отчёт</button>
      </div>
    </form>
  </div>
</div>

<div id="gcBlockedModal" class="gc-modal" role="dialog" aria-modal="true">
  <div class="gc-modal-box">
    <div class="gc-modal-head">
      <h2 class="gc-modal-title" style="margin:0;">🚫 Заблокированные</h2>
      <button type="button" class="gc-btn-icon" id="gcBlockedClose" style="width:32px;height:32px;">${GC_SVG.x}</button>
    </div>
    <div id="gcBlockedList" style="max-height:400px;overflow-y:auto;"></div>
  </div>
</div>

<div id="gcToast" class="gc-toast" aria-live="polite"></div>
`;

        const emojis = ['👍', '❤️', '😂', '🔥', '😍', '😱', '🎉', '💯'];
        const grid = this.container.querySelector('#gcReactionButtons');
        if (grid) {
            grid.innerHTML = emojis.map((e) => `<button type="button" data-emoji="${e}">${e}</button>`).join('');
        }

        const form = document.getElementById('globalChatForm');
        const input = document.getElementById('globalChatInput');
        const sendBtn = document.getElementById('globalChatSend');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.sendMessage();
            });
        }

        if (sendBtn) {
            sendBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (!input?.value?.trim()) return;
                this.sendMessage();
            });
        }

        if (form && input) {
            form.addEventListener('click', (e) => {
                if (!e.target.closest('.gc-btn-primary') && !input.disabled) input.focus();
            });
        }

        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
            input.addEventListener('input', () => {
                input.style.height = 'auto';
                input.style.height = Math.min(input.scrollHeight, 120) + 'px';
                this.updateCharCounter();
            });
        }

        this.updateCharCounter();

        this.container.addEventListener('click', (e) => this.onContainerClick(e));

        document.getElementById('gcBtnModerate')?.addEventListener('click', () => this.openModerationModal());
        document.getElementById('gcBtnBlocked')?.addEventListener('click', () => this.openBlockedModal());
        document.getElementById('gcReplyClose')?.addEventListener('click', () => this.closeReplyModal());
        document.getElementById('gcReplyCancel')?.addEventListener('click', () => this.closeReplyModal());
        document.getElementById('gcReplyForm')?.addEventListener('submit', (e) => this.submitReplyModal(e));
        document.getElementById('gcBlockCancel')?.addEventListener('click', () => this.closeBlockModal());
        document.getElementById('gcBlockConfirm')?.addEventListener('click', () => this.confirmBlockUser());
        document.getElementById('gcModerateCancel')?.addEventListener('click', () => this.closeModerationModal());
        document.getElementById('gcModerateForm')?.addEventListener('submit', (e) => this.submitModeration(e));
        document.getElementById('gcBlockedClose')?.addEventListener('click', () => this.closeBlockedModal());
        document.getElementById('gcBlockedList')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-gc-unblock]');
            if (btn) this.unblockUser(btn.getAttribute('data-gc-unblock'));
        });

        document.getElementById('gcReactionButtons')?.addEventListener('click', (e) => {
            const b = e.target.closest('button[data-emoji]');
            if (b) this.addReactionFromModal(b.getAttribute('data-emoji'));
        });

        const bindOverlay = (id, closeFn) => {
            const el = document.getElementById(id);
            el?.addEventListener('click', (e) => {
                if (e.target === el) closeFn.call(this);
            });
        };
        bindOverlay('gcReplyModal', this.closeReplyModal);
        bindOverlay('gcReactionsModal', this.closeReactionsModal);
        bindOverlay('gcBlockModal', this.closeBlockModal);
        bindOverlay('gcModerateModal', this.closeModerationModal);
        bindOverlay('gcBlockedModal', this.closeBlockedModal);
    }

    async onContainerClick(e) {
        const replyBtn = e.target.closest('.reply-btn');
        if (replyBtn) {
            e.preventDefault();
            e.stopPropagation();
            const msgId = replyBtn.getAttribute('data-msg-id');
            if (msgId) await this.openReplyModal(msgId);
            return;
        }

        const reactBtn = e.target.closest('.gc-react-btn');
        if (reactBtn) {
            e.preventDefault();
            e.stopPropagation();
            this.openReactionsModal(reactBtn.getAttribute('data-msg-id'));
            return;
        }

        const blockBtn = e.target.closest('.gc-block-btn');
        if (blockBtn) {
            e.preventDefault();
            e.stopPropagation();
            const uid = blockBtn.getAttribute('data-user-id');
            const msgForBlock = this.messages.find((m) => String(m.user_id) === String(uid));
            const uname = msgForBlock?.profiles?.username || 'Пользователь';
            this.openBlockModal(uid, uname);
            return;
        }

        if (e.target.closest('#cancelReply')) {
            e.preventDefault();
            this.cancelReply();
            return;
        }

        const usernameEl = e.target.closest('.gc-msg-user');
        if (usernameEl) {
            e.preventDefault();
            e.stopPropagation();
            const userId = usernameEl.getAttribute('data-user-id');
            if (userId) {
                let basePath = '';
                if (window.location.pathname.includes('/catalog/') ||
                    window.location.pathname.includes('/anime/') ||
                    window.location.pathname.includes('/manga/') ||
                    window.location.pathname.includes('/chat.html')) {
                    basePath = '../';
                }
                window.location.href = `${basePath}profile.html?user=${userId}`;
            }
            return;
        }

        if (e.target.closest('.like-btn')) {
            e.preventDefault();
            e.stopPropagation();
            const btn = e.target.closest('.like-btn');
            const msgId = btn.getAttribute('data-msg-id');
            await this.toggleLike(msgId);
        }
    }

    async openReplyModal(msgId) {
        const msg = this.messages.find((m) => String(m.id) === String(msgId));
        if (!msg) return;

        try {
            if (supabaseClient) {
                const { data: { user: currentUser } } = await supabaseClient.auth.getUser();
                if (currentUser && currentUser.id === msg.user_id) {
                    if (typeof showWarning === 'function') showWarning('Нельзя отвечать на свои сообщения');
                    else this.gcToast('Нельзя отвечать на свои сообщения');
                    return;
                }
            }
        } catch (err) {
            console.error(err);
        }

        if (this.isUserBlocked(msg.user_id)) return;

        const user = msg.profiles || {};
        const username = user.username || 'Аноним';
        this.replyModalMsgId = msg.id;
        const preview = document.getElementById('gcReplyPreview');
        const inp = document.getElementById('gcReplyInput');
        if (preview) {
            preview.innerHTML = `
        <div style="font-weight:700;color:#e300ff;font-size:12px;margin-bottom:6px;">${this.escapeHtml(username)}</div>
        <div style="color:rgba(232,224,236,0.85);font-size:12px;">${this.escapeHtml(msg.message)}</div>`;
        }
        if (inp) inp.value = '';
        document.getElementById('gcReplyModal')?.classList.add('show');
        inp?.focus();
    }

    closeReplyModal() {
        document.getElementById('gcReplyModal')?.classList.remove('show');
        this.replyModalMsgId = null;
    }

    async submitReplyModal(e) {
        e.preventDefault();
        const inp = document.getElementById('gcReplyInput');
        const text = (inp?.value || '').trim();
        if (!text) {
            this.gcToast('Ответ не может быть пустым');
            return;
        }
        const msg = this.messages.find((m) => String(m.id) === String(this.replyModalMsgId));
        if (!msg) {
            this.closeReplyModal();
            return;
        }
        this.replyToMessage = msg;
        const mainInput = document.getElementById('globalChatInput');
        if (mainInput) mainInput.value = text;
        this.closeReplyModal();
        this.updateCharCounter();
        await this.sendMessage();
    }

    cancelReply() {
        this.replyToMessage = null;
    }

    openReactionsModal(msgId) {
        this.reactionModalMsgId = msgId;
        document.getElementById('gcReactionsModal')?.classList.add('show');
    }

    closeReactionsModal() {
        document.getElementById('gcReactionsModal')?.classList.remove('show');
        this.reactionModalMsgId = null;
    }

    async addReactionFromModal(emoji) {
        const msgId = this.reactionModalMsgId;
        this.closeReactionsModal();
        if (!msgId) return;
        const msg = this.messages.find((m) => String(m.id) === String(msgId));
        if (!msg) return;
        if (msg.user_liked) {
            this.gcToast('Вы уже поставили лайк');
            return;
        }
        await this.toggleLike(String(msgId));
        if (msg.user_liked) this.gcToast(`${emoji} Лайк отправлен`);
    }

    openBlockModal(userId, username) {
        if (!userId) return;
        this.blockModalUserId = String(userId);
        const el = document.getElementById('gcBlockUsername');
        if (el) el.textContent = username || 'Пользователь';
        document.getElementById('gcBlockModal')?.classList.add('show');
    }

    closeBlockModal() {
        document.getElementById('gcBlockModal')?.classList.remove('show');
        this.blockModalUserId = null;
    }

    confirmBlockUser() {
        if (!this.blockModalUserId) return;
        this.blockedUserIds.add(this.blockModalUserId);
        this.saveBlockedToStorage();
        this.renderMessages();
        this.closeBlockModal();
        this.gcToast('Пользователь скрыт из чата');
    }

    unblockUser(userId) {
        if (!userId) return;
        this.blockedUserIds.delete(String(userId));
        this.saveBlockedToStorage();
        this.renderMessages();
        this.renderBlockedList();
        this.gcToast('Пользователь разблокирован');
    }

    openBlockedModal() {
        this.renderBlockedList();
        document.getElementById('gcBlockedModal')?.classList.add('show');
    }

    closeBlockedModal() {
        document.getElementById('gcBlockedModal')?.classList.remove('show');
    }

    renderBlockedList() {
        const list = document.getElementById('gcBlockedList');
        if (!list) return;
        if (this.blockedUserIds.size === 0) {
            list.innerHTML = '<div style="text-align:center;color:rgba(232,224,236,0.35);padding:24px;">Нет заблокированных</div>';
            return;
        }
        const rows = [...this.blockedUserIds].map((id) => {
            const p = this.profilesCache.get(id);
            const name = p?.username || 'Пользователь';
            return `
        <div class="gc-blocked-item">
          <div>
            <div style="font-weight:700;font-size:13px;">${this.escapeHtml(name)}</div>
            <div style="font-size:11px;color:rgba(232,224,236,0.4);">Не показывается в ленте</div>
          </div>
          <button type="button" class="gc-btn-primary" style="padding:6px 12px;font-size:11px;" data-gc-unblock="${this.escapeHtml(id)}">Разбанить</button>
        </div>`;
        });
        list.innerHTML = rows.join('');
    }

    openModerationModal() {
        document.getElementById('gcModerateModal')?.classList.add('show');
    }

    closeModerationModal() {
        document.getElementById('gcModerateModal')?.classList.remove('show');
        const r = document.getElementById('gcModerateReason');
        const t = document.getElementById('gcModerateText');
        if (r) r.value = '';
        if (t) t.value = '';
    }

    submitModeration(e) {
        e.preventDefault();
        const reason = document.getElementById('gcModerateReason')?.value;
        if (!reason) {
            this.gcToast('Выберите причину');
            return;
        }
        this.gcToast('✓ Спасибо, отчёт принят');
        this.closeModerationModal();
    }

    checkThrottle() {
        const warnEl = document.getElementById('gcThrottleWarn');
        if (this.isThrottled) {
            this.gcToast('⏱️ Слишком быстро! Подождите...');
            return false;
        }
        const now = Date.now();
        this.messageSendTimes.push(now);
        this.messageSendTimes = this.messageSendTimes.filter((t) => now - t < GC_THROTTLE_WINDOW_MS);
        if (this.messageSendTimes.length >= GC_THROTTLE_LIMIT) {
            this.isThrottled = true;
            if (warnEl) warnEl.hidden = false;
            this.gcToast('🚫 Лимит сообщений превышен! Подождите...');
            setTimeout(() => {
                this.messageSendTimes = [];
                this.isThrottled = false;
                if (warnEl) warnEl.hidden = true;
            }, GC_THROTTLE_WINDOW_MS);
            return false;
        }
        return true;
    }

    getLastPersistedMessage() {
        for (let i = this.messages.length - 1; i >= 0; i--) {
            const m = this.messages[i];
            if (m && m.id && String(m.id).startsWith('temp_')) continue;
            return m;
        }
        return null;
    }

    async setupPresence() {
        if (!supabaseClient) {
            console.error('❌ [CHAT] Supabase клиент не найден');
            return;
        }

        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            chatLog('⚠️ [CHAT] Пользователь не авторизован, Presence не настроен');
            return;
        }

        if (this.presenceChannel) {
            await supabaseClient.removeChannel(this.presenceChannel);
            this.presenceChannel = null;
        }

        chatLog('🔄 [CHAT] Настройка Presence...');

        this.presenceChannel = supabaseClient
            .channel('global_chat_presence', {
                config: { presence: { key: user.id } }
            })
            .on('presence', { event: 'sync' }, () => this.updateOnlineCount())
            .on('presence', { event: 'join' }, () => this.updateOnlineCount())
            .on('presence', { event: 'leave' }, () => this.updateOnlineCount())
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await this.presenceChannel.track({
                        user_id: user.id,
                        online_at: new Date().toISOString(),
                        status: 'online'
                    });
                    chatLog('✅ [CHAT] Presence подписка активирована');
                    setTimeout(() => this.updateOnlineCount(), 500);
                }
            });

        setInterval(() => {
            if (this.presenceChannel && this.presenceChannel.state === 'joined') {
                this.presenceChannel.track({
                    user_id: user.id,
                    online_at: new Date().toISOString(),
                    status: 'online'
                });
                this.updateOnlineCount();
            }
        }, 30000);
    }

    updateOnlineCount() {
        const onlineCountEl = document.getElementById('gcOnlineCount');
        if (!this.presenceChannel) {
            if (onlineCountEl) onlineCountEl.textContent = '0';
            return;
        }
        try {
            const state = this.presenceChannel.presenceState();
            const onlineUsers = new Set();
            Object.keys(state).forEach((userId) => {
                const presences = state[userId];
                if (Array.isArray(presences) && presences.length > 0) {
                    const activePresence = presences.find((p) => p && p.user_id);
                    if (activePresence) onlineUsers.add(userId);
                }
            });
            if (onlineCountEl) onlineCountEl.textContent = String(onlineUsers.size);
        } catch (err) {
            console.error('❌ [CHAT] Ошибка обновления счетчика онлайна:', err);
            if (onlineCountEl) onlineCountEl.textContent = '0';
        }
    }

    async loadMessages() {
        if (!supabaseClient) return;

        try {
            const { data, error } = await supabaseClient
                .from('global_chat_messages')
                .select('*')
                .is('deleted_at', null)
                .order('created_at', { ascending: false })
                .limit(this.messageLimit);

            if (error) {
                console.error('Ошибка загрузки сообщений:', error);
                return;
            }

            if (data && data.length > 0) {
                const userIds = [...new Set(data.map((msg) => msg.user_id))];
                const { data: profiles } = await supabaseClient
                    .from('profiles')
                    .select('id, username, avatar')
                    .in('id', userIds);

                const messageIds = data.map((msg) => msg.id);
                const { data: { user: currentUser } } = await supabaseClient.auth.getUser();

                const { data: allLikes } = await supabaseClient
                    .from('global_chat_likes')
                    .select('message_id, user_id')
                    .in('message_id', messageIds);

                const likesCountMap = {};
                const userLikedMap = {};

                if (allLikes) {
                    allLikes.forEach((like) => {
                        if (!likesCountMap[like.message_id]) likesCountMap[like.message_id] = 0;
                        likesCountMap[like.message_id]++;
                        if (currentUser && like.user_id === currentUser.id) {
                            userLikedMap[like.message_id] = true;
                        }
                    });
                }

                const profilesMap = {};
                if (profiles) {
                    profiles.forEach((profile) => {
                        profilesMap[profile.id] = profile;
                        this.profilesCache.set(profile.id, profile);
                    });
                }

                data.forEach((msg) => {
                    msg.profiles = profilesMap[msg.user_id] || { username: 'Пользователь', avatar: null };
                    msg.likes_count = likesCountMap[msg.id] || 0;
                    msg.user_liked = userLikedMap[msg.id] || false;
                });
            }

            this.messages = (data || []).reverse();
            this.renderMessages();
        } catch (err) {
            console.error('Ошибка загрузки сообщений:', err);
        }
    }

    renderMessages() {
        const messagesContainer = document.getElementById('globalChatMessages');
        if (!messagesContainer) return;

        messagesContainer.innerHTML = '';

        (async () => {
            for (const msg of this.messages) {
                if (this.isUserBlocked(msg.user_id)) continue;
                const messageEl = await this.createMessageElement(msg);
                messagesContainer.appendChild(messageEl);
            }
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        })();
    }

    async createMessageElement(msg) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'gc-msg global-chat-message';
        if (String(msg.id).startsWith('temp_')) messageDiv.classList.add('gc-msg--pending');
        messageDiv.setAttribute('data-msg-id', msg.id);

        const user = msg.profiles || {};
        const username = user.username || 'Аноним';
        const avatar = user.avatar || '';
        const time = new Date(msg.created_at).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });

        let isOwnMessage = false;
        let currentUserId = null;
        try {
            if (supabaseClient) {
                const { data: { user: currentUser } } = await supabaseClient.auth.getUser();
                if (currentUser) {
                    currentUserId = currentUser.id;
                    if (currentUser.id === msg.user_id) isOwnMessage = true;
                }
            }
        } catch (e) { /* ignore */ }

        let likesCount = msg.likes_count || 0;
        let hasLiked = msg.user_liked || false;

        if (msg.likes_count === undefined && msg.id && !String(msg.id).startsWith('temp_')) {
            try {
                const { data: likesData } = await supabaseClient
                    .from('global_chat_likes')
                    .select('user_id')
                    .eq('message_id', msg.id);

                if (likesData) {
                    likesCount = likesData.length;
                    hasLiked = currentUserId ? likesData.some((like) => like.user_id === currentUserId) : false;
                }
            } catch (e) {
                chatLog('⚠️ [CHAT] Не удалось загрузить лайки для сообщения:', msg.id);
            }
        }

        const safeUser = this.escapeHtml(username);
        const uid = this.escapeHtml(String(msg.user_id));

        messageDiv.innerHTML = `
            <div class="gc-avatar global-chat-message-avatar">
                ${avatar ? `<img src="${this.escapeHtml(avatar)}" alt="">` : this.escapeHtml(username.charAt(0).toUpperCase())}
            </div>
            <div class="gc-msg-body global-chat-message-content">
                <div class="gc-msg-head global-chat-message-header">
                    <span class="gc-msg-user global-chat-message-username" data-user-id="${uid}">${safeUser}</span>
                    <span class="gc-msg-time global-chat-message-time">${this.escapeHtml(time)}</span>
                </div>
                <div class="gc-bubble global-chat-message-text">${this.escapeHtml(msg.message)}</div>
                ${likesCount > 0 || !isOwnMessage ? `
                <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:4px;">
                    ${!isOwnMessage ? `<button type="button" class="gc-like like-btn" data-msg-id="${this.escapeHtml(String(msg.id))}" title="Лайк">
                        <span>${hasLiked ? '❤️' : '🤍'}</span><span>${likesCount || 0}</span>
                    </button>` : `<span class="gc-like" style="cursor:default;opacity:0.85;"><span>❤️</span><span>${likesCount || 0}</span></span>`}
                </div>` : ''}
                <div class="gc-msg-actions global-chat-message-actions">
                    ${!isOwnMessage ? `
                    <button type="button" class="gc-btn-icon reply-btn" data-msg-id="${this.escapeHtml(String(msg.id))}" title="Ответить">${GC_SVG.reply}</button>
                    <button type="button" class="gc-btn-icon gc-react-btn" data-msg-id="${this.escapeHtml(String(msg.id))}" title="Реакция / лайк">${GC_SVG.smile}</button>
                    <button type="button" class="gc-btn-icon gc-block-btn gc-btn-icon--warn" data-user-id="${uid}" title="Скрыть пользователя">${GC_SVG.ban}</button>
                    ` : ''}
                </div>
            </div>
        `;

        return messageDiv;
    }

    async sendMessage() {
        chatLog('🔵 [CHAT] sendMessage вызвана');

        const input = document.getElementById('globalChatInput');
        if (!input) {
            console.error('❌ [CHAT] Поле ввода не найдено');
            return;
        }

        const message = input.value.trim();
        if (!message) {
            chatLog('⚠️ [CHAT] Пустое сообщение');
            return;
        }

        if (message.length > GC_MAX_MESSAGE_LEN) {
            this.gcToast(`Максимум ${GC_MAX_MESSAGE_LEN} символов`);
            return;
        }

        if (!this.checkThrottle()) return;

        if (!supabaseClient) {
            if (typeof showWarning === 'function') showWarning('Необходимо войти для отправки сообщений');
            return;
        }

        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            if (typeof showWarning === 'function') showWarning('Необходимо войти для отправки сообщений');
            return;
        }

        input.disabled = true;

        const messagesContainer = document.getElementById('globalChatMessages');

        let currentProfile = this.profilesCache.get(user.id);
        if (!currentProfile) {
            try {
                const { data: profileData } = await supabaseClient
                    .from('profiles')
                    .select('id, username, avatar')
                    .eq('id', user.id)
                    .single();

                if (profileData) {
                    currentProfile = profileData;
                    this.profilesCache.set(user.id, currentProfile);
                } else {
                    currentProfile = { username: user.email?.split('@')[0] || 'Вы', avatar: null };
                }
            } catch (err) {
                currentProfile = { username: user.email?.split('@')[0] || 'Вы', avatar: null };
            }
        }

        let finalMessage = message;
        if (this.replyToMessage) {
            const replyUser = this.replyToMessage.profiles || {};
            const replyUsername = replyUser.username || 'Пользователь';
            finalMessage = `@${replyUsername} ${message}`;
        }

        const tempMessage = {
            id: 'temp_' + Date.now(),
            user_id: user.id,
            message: finalMessage,
            created_at: new Date().toISOString(),
            profiles: currentProfile,
            likes_count: 0,
            user_liked: false
        };

        this.messages.push(tempMessage);
        if (messagesContainer) {
            const messageEl = await this.createMessageElement(tempMessage);
            messageEl.classList.add('message-pending');
            messagesContainer.appendChild(messageEl);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        try {
            const insertData = { user_id: user.id, message: finalMessage };
            if (this.replyToMessage) {
                insertData.reply_to = this.replyToMessage.id;
            }

            const { data, error } = await supabaseClient
                .from('global_chat_messages')
                .insert(insertData)
                .select()
                .single();

            if (error) {
                console.error('❌ [CHAT] Ошибка отправки сообщения:', error);
                const tempIndex = this.messages.findIndex((m) => m.id === tempMessage.id);
                if (tempIndex !== -1) this.messages.splice(tempIndex, 1);
                const tempEl = messagesContainer?.querySelector(`[data-msg-id="${tempMessage.id}"]`);
                tempEl?.remove();
                if (typeof showError === 'function') showError('Не удалось отправить сообщение');
                else this.gcToast('Не удалось отправить сообщение');
                input.disabled = false;
                return;
            }

            let profile = this.profilesCache.get(user.id);
            if (!profile) {
                try {
                    const { data: profileData } = await supabaseClient
                        .from('profiles')
                        .select('id, username, avatar')
                        .eq('id', user.id)
                        .single();

                    if (profileData) {
                        profile = profileData;
                        this.profilesCache.set(user.id, profile);
                    } else {
                        profile = { username: user.email?.split('@')[0] || 'Вы', avatar: null };
                    }
                } catch (err) {
                    profile = { username: user.email?.split('@')[0] || 'Вы', avatar: null };
                }
            }

            const realMessage = { ...data, profiles: profile, likes_count: 0, user_liked: false };

            const tempIndex = this.messages.findIndex((m) => m.id === tempMessage.id);
            if (tempIndex !== -1) this.messages[tempIndex] = realMessage;

            const tempEl = messagesContainer?.querySelector(`[data-msg-id="${tempMessage.id}"]`);
            if (tempEl) {
                const realEl = await this.createMessageElement(realMessage);
                tempEl.replaceWith(realEl);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            } else if (messagesContainer) {
                const realEl = await this.createMessageElement(realMessage);
                messagesContainer.appendChild(realEl);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }

            input.value = '';
            input.style.height = 'auto';
            input.disabled = false;
            this.cancelReply();
            this.updateCharCounter();
            this.gcToast('✓ Сообщение отправлено');
        } catch (err) {
            console.error('❌ [CHAT] Исключение при отправке:', err);
            const tempIndex = this.messages.findIndex((m) => m.id === tempMessage.id);
            if (tempIndex !== -1) this.messages.splice(tempIndex, 1);
            const tempEl = messagesContainer?.querySelector(`[data-msg-id="${tempMessage.id}"]`);
            tempEl?.remove();
            if (typeof showError === 'function') showError('Не удалось отправить сообщение');
            else this.gcToast('Не удалось отправить сообщение');
        } finally {
            input.disabled = false;
            input.focus();
            const sendBtn = document.getElementById('globalChatSend');
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.removeAttribute('disabled');
            }
        }
    }

    async toggleLike(msgId) {
        if (!supabaseClient || !msgId) return;

        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            if (typeof showWarning === 'function') showWarning('Необходимо войти для лайка сообщений');
            return;
        }

        try {
            const { data: existingLike } = await supabaseClient
                .from('global_chat_likes')
                .select('id')
                .eq('message_id', msgId)
                .eq('user_id', user.id)
                .maybeSingle();

            const msg = this.messages.find((m) => String(m.id) === String(msgId));
            if (!msg) return;

            if (msg.user_id === user.id) {
                if (typeof showWarning === 'function') showWarning('Нельзя лайкать свои сообщения');
                return;
            }

            if (existingLike) {
                const { error } = await supabaseClient
                    .from('global_chat_likes')
                    .delete()
                    .eq('message_id', msgId)
                    .eq('user_id', user.id);

                if (error) throw error;

                msg.user_liked = false;
                msg.likes_count = Math.max(0, (msg.likes_count || 1) - 1);

                const likeBtn = document.querySelector(`.like-btn[data-msg-id="${msgId}"]`);
                if (likeBtn) {
                    const spans = likeBtn.querySelectorAll('span');
                    if (spans[0]) spans[0].textContent = '🤍';
                    if (spans[1]) spans[1].textContent = String(msg.likes_count);
                }
            } else {
                const { error } = await supabaseClient
                    .from('global_chat_likes')
                    .insert({ message_id: msgId, user_id: user.id });

                if (error) throw error;

                msg.user_liked = true;
                msg.likes_count = (msg.likes_count || 0) + 1;

                const likeBtn = document.querySelector(`.like-btn[data-msg-id="${msgId}"]`);
                if (likeBtn) {
                    const spans = likeBtn.querySelectorAll('span');
                    if (spans[0]) spans[0].textContent = '❤️';
                    if (spans[1]) spans[1].textContent = String(msg.likes_count);
                }
            }
        } catch (error) {
            console.error('❌ [CHAT] Ошибка лайка сообщения:', error);
            if (typeof showError === 'function') showError('Не удалось поставить лайк');
        }
    }

    setupRealtime() {
        if (!supabaseClient) {
            console.error('❌ [CHAT] Supabase клиент не найден');
            return;
        }

        if (this.realtimeChannel) {
            supabaseClient.removeChannel(this.realtimeChannel);
            this.realtimeChannel = null;
        }

        chatLog('🔄 [CHAT] Настройка Realtime подписки...');

        this.realtimeChannel = supabaseClient
            .channel('global_chat_messages_realtime', {
                config: { broadcast: { self: true } }
            })
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'global_chat_messages',
                filter: 'deleted_at=is.null'
            }, async (payload) => {
                const newMessage = payload.new;
                if (this.isUserBlocked(newMessage.user_id)) return;

                const exists = this.messages.some((m) => m.id === newMessage.id);
                if (exists) return;

                let profile = this.profilesCache.get(newMessage.user_id);
                if (!profile) {
                    try {
                        const { data } = await supabaseClient
                            .from('profiles')
                            .select('id, username, avatar')
                            .eq('id', newMessage.user_id)
                            .single();

                        if (data) {
                            profile = data;
                            this.profilesCache.set(newMessage.user_id, profile);
                        } else {
                            profile = { username: 'Пользователь', avatar: null };
                        }
                    } catch (err) {
                        chatWarn('⚠️ [CHAT] Ошибка загрузки профиля:', err);
                        profile = { username: 'Пользователь', avatar: null };
                    }
                }

                const enrichedMessage = {
                    ...newMessage,
                    profiles: profile,
                    likes_count: 0,
                    user_liked: false
                };

                this.messages.push(enrichedMessage);

                const messagesContainer = document.getElementById('globalChatMessages');
                if (messagesContainer) {
                    const messageEl = await this.createMessageElement(enrichedMessage);
                    messagesContainer.appendChild(messageEl);
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }

                if (this.messages.length > this.messageLimit) {
                    this.messages = this.messages.slice(-this.messageLimit);
                    this.renderMessages();
                }
            })
            .subscribe((status, err) => {
                chatLog('📡 [CHAT] Статус Realtime подписки:', status, err);
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                    chatWarn('⚠️ [CHAT] Переключаемся на polling');
                    this.startPollingFallback();
                } else {
                    setTimeout(() => {
                        if (this.realtimeChannel?.state !== 'joined' && !this.pollTimer) {
                            this.startPollingFallback();
                        }
                    }, 2000);
                }
            });

        setTimeout(() => {
            if (!this.pollTimer) this.startPollingFallback();
        }, 3000);
    }

    startPollingFallback() {
        if (this.pollTimer) return;
        chatLog('🔄 [CHAT] Polling fallback...');
        this.checkNewMessagesPolling();
        this.pollTimer = setInterval(() => this.checkNewMessagesPolling(), 1000);
    }

    async checkNewMessagesPolling() {
        if (!supabaseClient) return;

        const lastMessage = this.getLastPersistedMessage();
        if (!lastMessage) return;

        try {
            const lastMessageTime = new Date(lastMessage.created_at).toISOString();

            const { data: newMessages, error } = await supabaseClient
                .from('global_chat_messages')
                .select('*')
                .is('deleted_at', null)
                .gt('created_at', lastMessageTime)
                .order('created_at', { ascending: true });

            if (error || !newMessages || newMessages.length === 0) return;

            const userIds = [...new Set(newMessages.map((msg) => msg.user_id))];
            const { data: profiles } = await supabaseClient
                .from('profiles')
                .select('id, username, avatar')
                .in('id', userIds);

            const profilesMap = new Map();
            if (profiles) {
                profiles.forEach((profile) => {
                    profilesMap.set(profile.id, profile);
                    this.profilesCache.set(profile.id, profile);
                });
            }

            const messagesContainer = document.getElementById('globalChatMessages');

            for (const msg of newMessages) {
                if (this.isUserBlocked(msg.user_id)) continue;
                const exists = this.messages.some((m) => m.id === msg.id);
                if (!exists) {
                    const enrichedMessage = {
                        ...msg,
                        profiles: profilesMap.get(msg.user_id) || { username: 'Пользователь', avatar: null },
                        likes_count: 0,
                        user_liked: false
                    };
                    this.messages.push(enrichedMessage);
                    if (messagesContainer) {
                        const messageEl = await this.createMessageElement(enrichedMessage);
                        messagesContainer.appendChild(messageEl);
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    }
                }
            }

            if (this.messages.length > this.messageLimit) {
                this.messages = this.messages.slice(-this.messageLimit);
                this.renderMessages();
            }
        } catch (err) {
            console.error('❌ [CHAT] Ошибка polling:', err);
        }
    }

    stopRealtime() {
        if (this.realtimeChannel && supabaseClient) {
            supabaseClient.removeChannel(this.realtimeChannel);
            this.realtimeChannel = null;
        }
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }
}
