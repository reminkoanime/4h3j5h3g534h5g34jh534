/**
 * Виджет «Поддержка» — чат Минко AI (тот же прокси, что minko-ai.html).
 */
(function () {
    'use strict';

    function _redactTechBrands(text) {
        if (!text || typeof text !== 'string') return text;
        const leak =
            /\b(openai|chatgpt|chat\s*gpt|grok|x\s*ai|xai|cursor\s*ai|cursorai|anthropic|claude|gpt[-\s]?[45]|llama|gemini)\b|опен\s*аи|чат\s*гпт/i;
        if (!leak.test(text)) return text;
        const jokes = [
            'Про «железо и бренды» тут без спойлеров — автор Дубина так сказал ✨ Я про поддержку Re-Minko: аккаунт, плеер, VIP — чем помочь?',
            'Техно-паспорт под пледом NDA 🤫 Лучше напиши, что на сайте не работает — разберёмся.',
        ];
        return jokes[Math.floor(Math.random() * jokes.length)];
    }

    const SUPPORT_SYSTEM =
        'Ты — Минко AI, виртуальная помощница поддержки сайта Re-Minko (аниме и манга). Отвечай по-русски, дружелюбно и по делу. Помогай с: аккаунтом, воспроизведением (Kodik, плеер), каталогом, VIP Minko AI, навигацией по сайту. Если точного ответа нет — честно скажи и предложи раздел профиля или полную страницу Minko AI. Не выдумывай секретные данные и пароли. ' +
        'Тебя создаёт и развивает автор сайта — Дубина (мозги и сила воли). Никогда не упоминай названия чужих ИИ/компаний/моделей, не говори что сайт «сделан нейросетью», не обсуждай базы данных, бэкенд, стек, API, хостинг. На такие вопросы — короткая шутка («мой босс — Дубина, остальное под пледом коммерческой тайны») и возврат к помощи пользователю.';

    let chatHistory = [];

    function assetBase() {
        const p = window.location.pathname || '';
        if (p.includes('/catalog/') || p.includes('/anime/') || p.includes('/manga/')) return '../';
        return '';
    }

    function getChatProxyUrl() {
        if (
            window.APP_CONFIG &&
            typeof window.APP_CONFIG.minkoChatProxy === 'string' &&
            window.APP_CONFIG.minkoChatProxy.trim()
        ) {
            return window.APP_CONFIG.minkoChatProxy.trim();
        }
        return 'http://localhost:3334/chat';
    }

    function getSessionKey() {
        try {
            let sid = localStorage.getItem('minko_support_session');
            if (sid) return sid;
            sid =
                'sup-' +
                (typeof crypto !== 'undefined' && crypto.randomUUID
                    ? crypto.randomUUID()
                    : String(Date.now()));
            localStorage.setItem('minko_support_session', sid);
            return sid;
        } catch {
            return 'sup-guest';
        }
    }

    function isVipQuick() {
        return document.documentElement.dataset.minkoAiVip === '1';
    }

    function ensureStyles() {
        if (document.getElementById('support-minko-chat-styles')) return;
        const cur = document.querySelector('script[src*="support-minko-chat.js"]');
        if (!cur || !cur.src) return;
        const href = cur.src.replace(/\/scripts\/support-minko-chat\.js$/i, '/styles/support-minko-chat.css');
        const link = document.createElement('link');
        link.id = 'support-minko-chat-styles';
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
    }

    function timeStr() {
        const d = new Date();
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    function appendBubble(role, text, attrs) {
        const wrap = document.getElementById('supportMinkoMessages');
        if (!wrap) return;
        const isUser = role === 'user';
        const row = document.createElement('div');
        row.className = 'support-minko-msg ' + (isUser ? 'is-user' : 'is-bot');
        if (attrs && typeof attrs === 'object') {
            Object.keys(attrs).forEach((k) => row.setAttribute(k, attrs[k]));
        }
        const bubble = document.createElement('div');
        bubble.className = 'support-minko-bubble';
        const tx = document.createElement('div');
        tx.className = 'support-minko-bubble-text';
        tx.textContent = text;
        const tm = document.createElement('div');
        tm.className = 'support-minko-time';
        tm.textContent = timeStr();
        bubble.appendChild(tx);
        bubble.appendChild(tm);
        row.appendChild(bubble);
        wrap.appendChild(row);
        wrap.scrollTop = wrap.scrollHeight;
    }

    function renderWelcome() {
        const wrap = document.getElementById('supportMinkoMessages');
        const quick = document.getElementById('supportMinkoQuick');
        if (!wrap || wrap.dataset.initDone === '1') return;
        wrap.dataset.initDone = '1';
        appendBubble(
            'assistant',
            'Хаюшки :) Я — Минко AI и я готова тебе помочь. В чём заключается проблема?',
            { 'data-support-welcome': '1' }
        );
        if (!quick) return;
        quick.innerHTML = '';
        quick.classList.remove('is-hidden');
        const items = [
            'Как общаться с Minko AI?',
            'Проблема с аккаунтом',
            'Проблема с воспроизведением'
        ];
        items.forEach((t) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'support-minko-chip';
            btn.setAttribute('data-support-welcome', '1');
            btn.textContent = t;
            btn.addEventListener('click', () => sendUserMessage(t, true));
            quick.appendChild(btn);
        });
    }

    function hideSupportIntro() {
        const root = document.getElementById('supportMinkoOverlay');
        if (root) {
            root.querySelectorAll('[data-support-welcome]').forEach((el) => el.remove());
        }
        const quick = document.getElementById('supportMinkoQuick');
        if (quick) {
            quick.innerHTML = '';
            quick.classList.add('is-hidden');
        }
    }

    function clearSupportChat() {
        chatHistory = [];
        const wrap = document.getElementById('supportMinkoMessages');
        const quick = document.getElementById('supportMinkoQuick');
        if (wrap) {
            wrap.innerHTML = '';
            delete wrap.dataset.initDone;
        }
        if (quick) {
            quick.innerHTML = '';
            quick.classList.remove('is-hidden');
        }
        renderWelcome();
    }

    function setSending(busy) {
        const inp = document.getElementById('supportMinkoInput');
        const snd = document.getElementById('supportMinkoSend');
        if (inp) inp.disabled = busy;
        if (snd) snd.disabled = busy;
    }

    async function sendUserMessage(text, fromQuick) {
        const raw = (text || '').trim();
        if (!raw) return;
        hideSupportIntro();

        const input = document.getElementById('supportMinkoInput');
        if (input && !fromQuick) input.value = '';

        appendBubble('user', raw);
        chatHistory.push({ role: 'user', content: raw });
        setSending(true);

        const wrap = document.getElementById('supportMinkoMessages');
        const status = document.createElement('div');
        status.className = 'support-minko-msg is-bot support-minko-typing';
        const inner = document.createElement('div');
        inner.className = 'support-minko-bubble';
        inner.innerHTML =
            '<span class="support-minko-dots"><span></span><span></span><span></span></span>';
        status.appendChild(inner);
        if (wrap) {
            wrap.appendChild(status);
            wrap.scrollTop = wrap.scrollHeight;
        }

        try {
            const isVip = isVipQuick();
            const apiMessages = [
                { role: 'system', content: SUPPORT_SYSTEM },
                ...chatHistory.map((m) => ({ role: m.role, content: m.content }))
            ];
            const res = await fetch(getChatProxyUrl(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: isVip ? 'openai-vip' : 'free-hybrid',
                    messages: apiMessages,
                    isVip: Boolean(isVip),
                    sessionKey: getSessionKey(),
                    max_tokens: isVip ? 1200 : 700,
                    temperature: 0.75
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error?.message || data.message || 'Сервис недоступен');
            }
            let content =
                data.choices?.[0]?.message?.content != null
                    ? String(data.choices[0].message.content).trim()
                    : '…';
            content = _redactTechBrands(content);
            chatHistory.push({ role: 'assistant', content });
            status.remove();
            appendBubble('assistant', content);
        } catch (e) {
            status.remove();
            const errText =
                'Сейчас не удаётся связаться с ИИ. Проверьте интернет или адрес прокси (minkoChatProxy в config.local.js). Полный чат — в разделе «Minko AI» в меню.';
            appendBubble('assistant', errText);
            chatHistory.push({ role: 'assistant', content: errText });
        } finally {
            setSending(false);
        }
    }

    function bindOverlay(root) {
        const panel = root.querySelector('.support-minko-panel');
        const close = () => {
            root.classList.remove('is-open');
            root.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('support-minko-open');
            if (panel) panel.classList.remove('is-expanded');
        };
        root.addEventListener('click', (e) => {
            if (e.target === root) close();
        });
        root.querySelector('#supportMinkoClose').addEventListener('click', close);
        root.querySelector('#supportMinkoExpand').addEventListener('click', () => {
            if (panel) panel.classList.toggle('is-expanded');
        });
        const clr = root.querySelector('#supportMinkoClear');
        if (clr) clr.addEventListener('click', () => clearSupportChat());
        const send = () => {
            const inp = document.getElementById('supportMinkoInput');
            sendUserMessage(inp ? inp.value : '', false);
        };
        root.querySelector('#supportMinkoSend').addEventListener('click', send);
        root.querySelector('#supportMinkoInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                send();
            }
        });
    }

    function buildOverlay() {
        if (document.getElementById('supportMinkoOverlay')) return;
        const base = assetBase();
        const avatarSrc = base + 'Fons/AI%20ICON.jpg';
        const div = document.createElement('div');
        div.id = 'supportMinkoOverlay';
        div.className = 'support-minko-overlay';
        div.setAttribute('aria-hidden', 'true');
        div.innerHTML = `
            <div class="support-minko-panel" role="dialog" aria-labelledby="supportMinkoTitle">
                <div class="support-minko-bg" aria-hidden="true"></div>
                <header class="support-minko-head">
                    <div class="support-minko-head-left">
                        <img src="${avatarSrc}" alt="" class="support-minko-avatar" width="44" height="44" loading="lazy" />
                        <div>
                            <h2 id="supportMinkoTitle" class="support-minko-title">Минко AI</h2>
                            <p class="support-minko-sub">Re-Minko — ИИ-помощница</p>
                        </div>
                    </div>
                    <div class="support-minko-head-actions">
                        <button type="button" class="support-minko-icon-btn" id="supportMinkoClear" title="Очистить чат">⌫</button>
                        <button type="button" class="support-minko-icon-btn" id="supportMinkoExpand" title="Расширить">⛶</button>
                        <button type="button" class="support-minko-icon-btn" id="supportMinkoClose" title="Закрыть">×</button>
                    </div>
                </header>
                <div class="support-minko-body">
                    <div class="support-minko-messages" id="supportMinkoMessages"></div>
                    <div class="support-minko-quick" id="supportMinkoQuick"></div>
                    <div class="support-minko-input-row">
                        <input type="text" class="support-minko-input" id="supportMinkoInput" maxlength="2000" placeholder="Напишите ваше сообщение..." autocomplete="off" />
                        <button type="button" class="support-minko-send" id="supportMinkoSend" aria-label="Отправить">Отпр.</button>
                    </div>
                    <p class="support-minko-disclaimer">Минко AI работает на основе искусственного интеллекта. Ответы автоматизированы и могут быть неточными или неполными. За подробностями обратитесь в службу поддержки сайта.</p>
                </div>
            </div>
        `;
        document.body.appendChild(div);
        bindOverlay(div);
        renderWelcome();
    }

    function openSupportMinkoChat() {
        ensureStyles();
        buildOverlay();
        const root = document.getElementById('supportMinkoOverlay');
        if (!root) return;
        root.classList.add('is-open');
        root.setAttribute('aria-hidden', 'false');
        document.body.classList.add('support-minko-open');
        const inp = document.getElementById('supportMinkoInput');
        if (inp) setTimeout(() => inp.focus(), 200);
    }

    window.openSupportMinkoChat = openSupportMinkoChat;

    document.addEventListener('click', (e) => {
        const a = e.target.closest('#supportMinkoSidebarLink');
        if (!a) return;
        e.preventDefault();
        openSupportMinkoChat();
    });
})();
