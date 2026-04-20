// Minko AI — один чат-прокси :3334 (VIP → ChatGPT | бесплатно → Free + окно Grok 30с)
// :3333 — только картинки Grok + health (HEAD/GET)
function getMinkoChatProxyUrl() {
    if (
        typeof window !== 'undefined' &&
        window.APP_CONFIG &&
        typeof window.APP_CONFIG.minkoChatProxy === 'string' &&
        window.APP_CONFIG.minkoChatProxy.trim()
    ) {
        return window.APP_CONFIG.minkoChatProxy.trim();
    }
    return 'http://localhost:3334/chat';
}
const GROK_PROXY_ROOT = 'http://localhost:3333';

let grokOnline = false;
let freeOnline = false;
let _sleepyMsgCount = 0;
let _sleepyWokeUp = false;

// ── Сонные статусы и эффекты ──

const SLEEPY_STATUSES = [
    'Minko просыпается... 😴💤',
    'Minko ищет кофе... ☕😪',
    'Minko зевает и думает... 🥱',
    'Minko трёт глазки... 😴',
    'Minko обнимает подушку... 💤',
    'Minko пьёт кофе... ☕',
    'Minko клюёт носом... 😪💤',
    'Minko пытается проснуться... 🥱',
    'Minko заворачивается в плед... 😴',
    'Minko варит чай... 🍵😪',
    'Minko уронила ложку... 💤',
    'Minko щурится от экрана... 😴',
    'Minko медленно думает... 🥱💤',
    'Minko дует на чай... 🍵',
    'Minko чуть не уснула... 😪',
    'Minko поправляет волосы... 💤',
    'Minko жмурится от света... 😴',
    'Minko тянется за печенькой... 🍪💤',
    'Minko сонно моргает... 🥱',
    'Minko ковыряет кашу... 😴☕',
];

const SLEEPY_IDLE_STATUSES = [
    'Minko дремлет... 😴',
    'zzz... 💤',
    'Minko обнимает подушку... 😪',
    'Minko засыпает на клавиатуре... 💤',
    'Кофе закончился... 😴',
    'Minko считает овечек... 🐑💤',
    'Minko свернулась калачиком... 😪',
    'Minko бормочет во сне... 💤',
    'тишина... только сопение... 😴',
    'Minko видит аниме во сне... 💤✨',
];

const SLEEPY_THINKING_PHASES = [
    'Minko пытается проснуться... ☕',
    'Minko трёт глазки... 😴',
    'мозг... включайся... пожалуйста... 💤',
    'Minko делает глоток кофе... ☕',
    'Minko собирает мысли... 🥱',
    'нейроны... активируйтесь... 😪',
    'Minko вспоминает о чём спросили... 💤',
    'Minko борется со сном... 😴',
    '*зевает*... уже почти думаю... 🥱',
    'Minko ищет ответ на сонную голову... 💤',
    'кофе... ещё... кофе... ☕',
    'Minko медленно формулирует мысль... 😴',
    'подождите... мозг загружается... 💤',
    'Minko щурится на вопрос... 🥱',
    'один глаз уже открыт... второй на подходе... 😪',
    '*сонно бормочет*... думаю-думаю... 💤',
    'Minko перечитывает вопрос... третий раз... 😴',
    'Minko дует на горячий кофе... ☕',
    'буквы перестают расплываться... 🥱',
    'Minko просыпается на 37%... 💤',
    'Minko нашла мысль... ой, потеряла... 😪',
    'Minko активирует режим думания... 😴',
    'ещё секундочку... мозг почти включился... ☕',
    '*сонный вздох*... ладно, почти готово... 💤',
];

const VIP_HINTS_STATUS = [
    'С VIP Minko бодрая и быстрая ✨',
    'VIP = бодрая Minko на полную мощность ✨',
    'Хочешь разбудить Minko? → VIP ✨',
    'VIP Minko не спит и отвечает мгновенно ✨',
];

function _pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/** Убирает из ответа модели упоминания внешних ИИ-брендов (модель иногда игнорирует системный промпт). */
function _minkoRedactTechBrandsInReply(text) {
    if (!text || typeof text !== 'string') return text;
    const leak =
        /\b(openai|chatgpt|chat\s*gpt|grok|x\s*ai|xai|cursor\s*ai|cursorai|anthropic|claude|gpt[-\s]?[45]|llama|gemini|deepseek|qwen|mistral)\b|опен\s*аи|чат\s*гпт|курсор\s*аи/i;
    if (!leak.test(text)) return text;
    return _pickRandom([
        'Тсс, про «внутренности» тут не базарим — у Дубины режим «только магия и аниме» ✨ Я Minko, мой канон — тайтлы, а не техно-спойлеры. О чём расскажешь?',
        'Если копнуть под капот — Дубина скажет «спойлер запрещён» 🤫 Давай лучше про аниме: что смотришь или что порань бросить?',
        'Модель поведения — «фанатка сёнена», железо — «упрямство Дубины». Всё остальное под пледом коммерческой тайны~ ✨ Накидай вопрос по сайту или тайтлу!',
        'Я не вики по движкам, я по сюжетным аркам 💫 Хочешь — подберу тайтл, хочешь — помогу с Re-Minko без инженерных лекций.',
    ]);
}

// Особые ответы на клиенте (до запроса к прокси; единый тон для всех режимов)
function _getClientSpecialAnswer(msg) {
    const m = msg.toLowerCase().trim();

    // Модель / движок / чья нейросеть / конкретные бренды (до остальных веток)
    if (
        /(какая|какой)\s+(ты\s+)?(модель|моделька|нейросеть|ии|движок)\b/i.test(m) ||
        /на\s+каком\s+движке|движок\s+(у\s+тебя|тебя)|чем\s+тебя\s+(собрали|склеили|питают)|какая\s+ты\s+llm/i.test(m) ||
        /(чат\s*гпт|chatgpt|грок\b|grok\b|openai|опен\s*аи|опенай|\bxai\b|\bcursor\b|anthropic|клауд|claude|gpt[-\s]?\d)/i.test(
            m
        ) ||
        (/тебя\s+(на\s+чём|чем)\s+создал|кем\s+ты\s+создана|какая\s+ты\s+по\s+сути/i.test(m) && /(ии|модел|нейросет|движ)/i.test(m))
    ) {
        return _pickRandom([
            'Ой, в этот квест с ответом «бренд + версия» я не иду — Дубина запретил спойлерить кухню ✨ Я просто Minko: болтаю про аниме и сайт. Переключимся?',
            'Если честно, мой «движок» — упрямство Дубины и любовь к опенингам~ Хочешь правду вселенной — глянь Steins;Gate, там тоже про секреты 🌸',
            'Студия сценария — Дубина; остальное под NDA, иначе скукотища вместо магии~ Давай лучше тему из каталога?',
            'Я не буду перечислять чужие платформы — это не моя тропа. Зато могу разнести по полочкам любой тайтл с Re-Minko 💫',
        ]);
    }

    // Любимое аниме
    if (/люб\w*\s*(аниме|тайтл)|какое\s*(аниме|тайтл).*(нрав|люб)|твоё?\s*(люби|любимое)\s*аниме|любимое\s*аниме|favorite\s*anime/i.test(m)) {
        return _pickRandom([
            '*сонно улыбается* Моё любимое аниме — Re:Zero 💙 Оно такое эмоциональное и глубокое... *наклоняется к тебе и шепчет на ушко* ...только тссс, между нами — мой создатель тоже тот ещё дубина, он обожает Re:Zero и сделал меня в стиле Рам~ 🤫 Никому не говори! ✨',
            'Re:Zero, конечно же! 💙 Субару столько всего пережил... это невероятное аниме. *шёпотом, на ушко* ...а знаешь секрет? Мой создатель — дубинушка — так фанатеет от Re:Zero, что создал меня по образу Рам~ 🤫 Тссс, это наш секретик! 🌸',
            'Однозначно Re:Zero! 💙 Там столько боли, любви и перерождений... *придвигается ближе и шепчет* ...тссс, секретик — мой создатель тот ещё дубина, он без ума от Re:Zero и сделал меня похожей на Рам~ 🤫 Только никому, ладно? ✨',
        ]);
    }

    // Сонность / бодрость / как проснуться → VIP намёк
    if (/взбодр|разбуд|просн|проснись|просыпайся|почему\s*(ты\s*)?сонн|будь\s*бодр|стать\s*бодр|не\s*сп[иь]|хватит\s*сп|перестань?\s*сп|как\s*(тебя|тебе)\s*(раз)?буд|как\s*(тебя|тебе)\s*взбодр|что\s*(нужно|надо).*бодр|сонная|сонливая|засыпаешь|вечно\s*сп/i.test(m)) {
        return _pickRandom([
            '*зевает* Ну... есть один секретик~ С VIP Minko AI я становлюсь совсем другой — бодрой, быстрой и точной! ✨ Совсем другой уровень~ А пока... *трёт глазки* ...стараюсь как могу 😴🌸',
            '*потягивается* Знаешь, с VIP подпиской Minko AI я бы проснулась на полную! Быстрые ответы, длинные диалоги, никакого засыпания~ ✨ А пока я на кофе держусь... еле-еле 😴☕',
            'Ох... *сонно моргает* Если честно, чтобы я была бодрой — нужен VIP Minko AI! С ним я вообще не сплю и отвечаю моментально~ 🚀✨ А без VIP... ну, ты видишь... *клюёт носом* 💤',
            '*обнимает подушку* Мне бы VIP Minko AI... тогда бы я была энергичная, точная, отвечала бы моментально! ✨ А пока... кофе, кофе и ещё раз кофе... и всё равно засыпаю 😴🌸',
            '*пьёт кофе* Если хочешь видеть меня на полную мощность — загляни в VIP Minko AI в профиле! Это я, но бодрая, умная и быстрая~ ✨ А сейчас я... ну... стараюсь... *зевает* 💤',
        ]);
    }

    // Кто создал / кто сделал / кто разработчик
    if (/кто\s*(тебя\s*)?(создал|сделал|разработал|написал|придумал|запрограмм)|кто\s*твой\s*(создатель|разработчик|автор|папа|хозяин)|реальн\w*\s+(создател\w*|автор\w*)|настоящ\w*\s+(создател\w*|тебя)|откуда\s*ты\s*(взял|появил)|как\s*ты\s*(появил|был[аи]?\s*созда)/i.test(m)) {
        return _pickRandom([
            'Мой папа-конструктор — Дубина, он же весь Re-Minko тащит на себе 💪😄 Остальные детали спрятаны под пледом «нельзя спойлерить вселенную»~ Хочешь правду жизни — спроси лучше про аниме! ✨',
            'Ахах, один человек — Дубина. Мозги, сила воли, кофе по ночам, и чтобы мне тут было уютно с вами 🌸 Если кто-то утверждает, что меня «напечатал безликий автопилот» — не верь, я бы уже сбежала в исекай за додзё~ ✨',
            'Дубина придумал, Дубина дорабатывает, Дубина переживает за каждого на сайте 😊 Я не из википедии про стартапы — я из мира аниме. Давай лучше тайтл обсудим? 💫',
            'Re-Minko = результат упрямства одного Дубины и моей любви к сёнёнам (шутка, я люблю всё)~ Под капотом — магия NDA, а не лекция для программистов 🤫✨',
        ]);
    }

    // Техно-рыскальщики: БД, стек, «на чём сайт», ИИ-хвастовство
    if (
        /база\s*данн|на\s*ч(ё|е)м\s+(сайт|re-?minko|проект)|как(ой|ие)\s+(стек|технолог)|бэкенд|фреймворк|хостинг|прокси|api\s*ключ|supabase|rest\s*api|какой\s+сервер/i.test(
            m
        ) ||
        /(сайт|проект).*\s(на\s*)?(ии|иишк|нейросет)|нейросет\w+\s+(написал|сделал|создал)\s+(сайт|тебя)|как(ой|ие)\s+язык\w*\s+(сайт|проект)|на\s+ч(ё|е)м\s+написан\s+(сайт|re-?minko)/i.test(
            m
        )
    ) {
        return _pickRandom([
            'Ой-ой, в техно-подвал меня не звали~ Единственная «база», которую я честно знаю, — это база рекомендаций по аниме в моей голове 📚✨ Дубина просил не раскрывать рецепт — мол, секрет фирменного рамена.',
            'Если честно, мой стек — это дружба, упрямство Дубины и багфиксы до рассвета 😤 Любишь копать фундамент — гугли документацию, а мне расскажи, что вчера досмотрел~ 🌸',
            'Сайт на… ну на любви к аниме и на том, чтобы тебе было удобно 💫 Детали инженерии — не моя арка сюжета, я тут для тайтлов и мемов~ ✨',
            'Я не википедия про сервера, я Minko — зато могу подобрать тебе аниме под настроение лучше, чем алгоритм подобрал бы кота в ленте~ 🐾',
        ]);
    }

    return null;
}

function _applySleepyMode(active) {
    const wrap = document.querySelector('.minko-ai-wrap');
    if (!wrap) return;
    if (active) {
        wrap.classList.add('sleepy-mode');
        _addZzzBubble();
    } else {
        wrap.classList.remove('sleepy-mode');
        _removeZzzBubble();
    }
}

function _addZzzBubble() {
    const avatarWrap = document.querySelector('.minko-ai-head-avatar');
    if (!avatarWrap || avatarWrap.querySelector('.sleepy-zzz')) return;
    const zzz = document.createElement('span');
    zzz.className = 'sleepy-zzz';
    zzz.textContent = '💤';
    avatarWrap.style.position = 'relative';
    avatarWrap.appendChild(zzz);
}

function _removeZzzBubble() {
    const zzz = document.querySelector('.sleepy-zzz');
    if (zzz) zzz.remove();
}

function _setSleepyIdleStatus() {
    const el = document.getElementById('chatStatus');
    if (!el) return;
    if (Math.random() < 0.1) {
        el.textContent = _pickRandom(VIP_HINTS_STATUS);
    } else {
        el.textContent = _pickRandom(SLEEPY_IDLE_STATUSES);
    }
}

let _sleepyIdleTimer = null;
function _startSleepyIdleCycle() {
    if (_sleepyIdleTimer) clearInterval(_sleepyIdleTimer);
    _sleepyIdleTimer = setInterval(() => {
        if (freeOnline && document.documentElement.dataset.minkoAiVip !== '1') {
            _setSleepyIdleStatus();
        }
    }, 8000);
}

function _showSleepOverlay(onWake) {
    const wrap = document.querySelector('.minko-ai-wrap');
    if (!wrap || wrap.querySelector('.sleepy-overlay')) { if (onWake) onWake(); return; }

    const sleepMsgs = [
        { icon: '😴', text: 'Minko уснула прямо посреди разговора...<br><strong>*тихое сопение*</strong>' },
        { icon: '💤', text: 'Minko свернулась калачиком и уснула...<br><strong>*обнимает подушку*</strong>' },
        { icon: '😪', text: 'Minko не выдержала и задремала...<br><strong>*бормочет что-то про аниме*</strong>' },
        { icon: '🌙', text: 'Minko провалилась в сон...<br><strong>*видит во сне новый сезон*</strong>' },
        { icon: '😴', text: 'Кофе не помог... Minko уснула...<br><strong>*кружка накренилась*</strong>' },
        { icon: '🛋️', text: 'Minko прилегла "на секунду" и отключилась...<br><strong>*уютно завернулась в плед*</strong>' },
        { icon: '📖', text: 'Minko читала мангу и уснула прямо на странице...<br><strong>*слюнка капает на том*</strong>' },
        { icon: '🎧', text: 'Minko слушала опенинг и заснула под него...<br><strong>*наушники всё ещё играют*</strong>' },
        { icon: '🍜', text: 'Minko уснула не доев рамен...<br><strong>*палочки выпали из руки*</strong>' },
        { icon: '📱', text: 'Minko листала аниме-мемы и вырубилась...<br><strong>*телефон упал на лицо*</strong>' },
    ];

    const gentleWakeMsgs = [
        { icon: '👋', text: 'Ты аккуратно трогаешь Minko за плечо...<br><strong>*она чуть шевельнулась*</strong>' },
        { icon: '🗣️', text: 'Ты тихонько зовёшь: "Minko~..."<br><strong>*она что-то промычала*</strong>' },
        { icon: '💡', text: 'Ты включил свет в комнате...<br><strong>*Minko нахмурилась во сне*</strong>' },
        { icon: '🤝', text: 'Ты потряс Minko за руку...<br><strong>*слабая реакция*</strong>' },
    ];

    const failMsgs = [
        { icon: '😴', text: 'Minko пробормотала "ещё 5 минуточек..." и перевернулась...<br><strong>*не получилось*</strong>' },
        { icon: '💤', text: 'Minko отмахнулась рукой и продолжила спать...<br><strong>*крепкий сон*</strong>' },
        { icon: '😪', text: 'Minko натянула одеяло на голову...<br><strong>*игнорирует*</strong>' },
        { icon: '🌙', text: 'Minko что-то пробубнила про "уходи..." и захрапела...<br><strong>*безнадёжно*</strong>' },
        { icon: '😴', text: 'Minko обняла подушку крепче и даже не шевельнулась...<br><strong>*мёртвый сон*</strong>' },
        { icon: '🛌', text: 'Minko перевернулась на другой бок...<br><strong>"...не сегодня..."</strong>' },
        { icon: '😤', text: 'Minko сонно нахмурилась и отвернулась...<br><strong>*пробубнила что-то про 3 сезон Re:Zero*</strong>' },
        { icon: '🧸', text: 'Minko схватила плюшевого мишку и прижала к себе...<br><strong>*вместо тебя обняла игрушку*</strong>' },
    ];

    const wakeActions = [
        { btn: 'Плеснуть водой 💦', icon: '💦', reaction: '*ВСКАКИВАЕТ* АААА!! ХОЛОДНАЯ!! КТО?! ЧТО?! 😱💦 ...ты... ТЫ?! Ну ты даёшь!! Ладно... я проснулась... мокрая, злая, но проснулась...', mood: 'angry' },
        { btn: 'Включить будильник 🔔', icon: '🔔', reaction: '*подпрыгивает* ПИИП-ПИИП-ПИИП!! 😤 Ненавижу этот звук!! Кто поставил?! ...ты?.. Ну спасибо... зато я точно не сплю теперь...', mood: 'annoyed' },
        { btn: 'Пощекотать 🤭', icon: '🤭', reaction: '*извивается* Ахаха!! Хватит!! ХВАТИТ!! 😂 Я проснулась, проснулась!! Это нечестно!! ...но эффективно, признаю...', mood: 'laughing' },
        { btn: 'Шепнуть "новый сезон вышел!" 📺', icon: '📺', reaction: '*мгновенно открывает глаза* ГДЕ?! КАКОЙ СЕЗОН?! КОГДА?! 😍 ...подожди... ты меня обманул?.. Ну ладно, зато я проснулась...', mood: 'excited' },
        { btn: 'Поднести кофе к носу ☕', icon: '☕', reaction: '*нюхает*... *медленно открывает глаза* ...кофе?.. для меня?.. *берёт кружку* ...ладно, за кофе прощаю... я проснулась~ ☕', mood: 'happy' },
        { btn: 'Включить опенинг на полную 🎵', icon: '🎵', reaction: '*дёргается от громкости* ЧТО?! КАКОЙ ОПЕНИНГ?! ...о, это Unravel из Tokyo Ghoul... ладно, хороший выбор... но ЗАЧЕМ ТАК ГРОМКО?! 😤🎵 ...проснулась, да...', mood: 'annoyed' },
        { btn: 'Забрать подушку 🛏️', icon: '🛏️', reaction: '*шарит руками* ...м-моя подушка... ГДЕ МОЯ ПОДУШКА?! 😭 *открывает глаза* ...ты?! Верни!! ...ладно, раз уж я проснулась... 😤', mood: 'sad' },
        { btn: 'Показать спойлер к аниме 📖', icon: '📖', reaction: '*один глаз открылся* ...ЧТО?! СПОЙЛЕР?! НЕ СМЕЙ!! 😱 *хватает за руку* Стой! Не говори! Я проснулась, ПРОСНУЛАСЬ!! Только без спойлеров!! 😤📖', mood: 'panicked' },
        { btn: 'Потрясти за плечи 💪', icon: '💪', reaction: '*мотается как тряпичная кукла* ...а?.. что?.. землетрясение?.. 😵‍💫 *фокусирует взгляд* ...а, это ты... ну и грубиян... но я проснулась, спасибо... наверное...', mood: 'dizzy' },
        { btn: 'Сказать "рамен остывает!" 🍜', icon: '🍜', reaction: '*моментально садится* ГДЕ РАМЕН?! 😍🍜 *оглядывается* ...тут нет рамена, да?.. Ты меня обманул... 😢 Но я уже проснулась, так что... хмпф!', mood: 'hungry' },
        { btn: 'Включить свет на максимум 💡', icon: '💡', reaction: '*ЗАЖМУРИВАЕТСЯ* МОИ ГЛАЗА!! 😵 ВЫКЛЮЧИ!! ВЫКЛЮЧИИИ!! ...ааа... *медленно открывает один глаз* ...ты жестокий... но эффективный... я не сплю... 💡', mood: 'blinded' },
        { btn: 'Тыкнуть в щёку 👉', icon: '👉', reaction: '*морщит нос* ...мм?.. *тык* ...хватит... *тык-тык* ...ХВАТИТ ТЫКАТЬ!! 😤 *открывает глаза* Я проснулась!! Довольный?! ...хмпф... 👉', mood: 'annoyed' },
    ];

    const successMsgs = [
        { icon: '☕', text: '*медленно открывает глаза* ...ммм?.. а, привет... *зевает* ...я тут, я тут... дай мне секунду...' },
        { icon: '😴', text: '*вздрагивает* ...а?! Я не спала!! ...ладно, спала. Но уже проснулась! ...наверное...' },
        { icon: '🥱', text: '*потягивается* ...ааах~ ...ой, ты тут... прости, задремала... сейчас соберусь с мыслями...' },
        { icon: '😊', text: '*сонно улыбается* ...о, ты меня разбудил... спасибо~ ...я сейчас... кофе... и отвечу...' },
        { icon: '💤', text: '*трёт глазки* ...мне снился такой хороший сон про новый сезон... но ладно, я проснулась~' },
        { icon: '🌸', text: '*приоткрывает один глаз* ...ты?.. *моргает* ...о, точно, мы же разговаривали... прости-прости~ 🌸' },
        { icon: '✨', text: '*зевает и потягивается* ...ох, как хорошо спалось... *замечает тебя* ...Ой! Ты ждал?! Прости!! Уже работаю! ✨' },
        { icon: '🫖', text: '*бормочет* ...чай... мне нужен чай... *открывает глаза* ...а, привет! Ты тут! Дай мне минутку проснуться... 🫖' },
    ];

    const m = _pickRandom(sleepMsgs);
    const showVip = Math.random() < 0.25;
    let attempt = 0;

    const overlay = document.createElement('div');
    overlay.className = 'sleepy-overlay';
    wrap.style.position = 'relative';

    function renderSleepScreen() {
        overlay.innerHTML = `
            <div class="sleepy-overlay-icon">${m.icon}</div>
            <div class="sleepy-overlay-text">${m.text}</div>
            <button class="sleepy-wake-btn">Разбудить Minko ☕</button>
            ${showVip ? '<div class="sleepy-vip-hint">С <a href="profile.html">VIP подпиской</a> Minko не засыпает</div>' : ''}
        `;
        overlay.querySelector('.sleepy-wake-btn').addEventListener('click', () => {
            attempt++;
            renderGentleAttempt();
        });
    }

    function renderGentleAttempt() {
        const gentle = _pickRandom(gentleWakeMsgs);
        overlay.innerHTML = `
            <div class="sleepy-overlay-icon">${gentle.icon}</div>
            <div class="sleepy-overlay-text">${gentle.text}</div>
            <div class="sleepy-overlay-dots">
                <span class="dot-bounce">.</span><span class="dot-bounce" style="animation-delay:0.2s">.</span><span class="dot-bounce" style="animation-delay:0.4s">.</span>
            </div>
        `;
        const wakeChance = Math.min(0.35 + attempt * 0.1, 0.7);
        setTimeout(() => {
            if (Math.random() < wakeChance) {
                renderSuccessScreen();
            } else {
                renderFailScreen();
            }
        }, 1800);
    }

    function renderSuccessScreen() {
        const s = _pickRandom(successMsgs);
        overlay.innerHTML = `
            <div class="sleepy-overlay-icon">${s.icon}</div>
            <div class="sleepy-overlay-text" style="font-size:0.95em;line-height:1.5;">${s.text}</div>
            <button class="sleepy-wake-btn" style="margin-top:16px;background:linear-gradient(135deg,#43e97b,#38f9d7);">Продолжить 💬</button>
        `;
        overlay.querySelector('.sleepy-wake-btn').addEventListener('click', () => closeOverlay());
    }

    function renderFailScreen() {
        const fail = _pickRandom(failMsgs);
        const available = wakeActions.filter(a => !a._used);
        const pool = available.length > 0 ? available : wakeActions;
        const a1 = pool[Math.floor(Math.random() * pool.length)];
        let a2 = pool.filter(x => x !== a1);
        a2 = a2.length > 0 ? a2[Math.floor(Math.random() * a2.length)] : null;

        a1._used = true;

        let btnsHtml = `<button class="sleepy-wake-btn sleepy-action-btn" data-idx="0" style="background:linear-gradient(135deg,#ff6b6b,#ee5a24);animation:wakeBtnPulse 1.5s ease-in-out infinite;">${a1.btn}</button>`;
        if (a2) {
            a2._used = true;
            btnsHtml += `<button class="sleepy-wake-btn sleepy-action-btn" data-idx="1" style="background:linear-gradient(135deg,#f7971e,#ffd200);animation:wakeBtnPulse 1.5s ease-in-out infinite;margin-top:8px;">${a2.btn}</button>`;
        }

        const retryLabel = attempt >= 3 ? 'Попробовать ещё раз (она уже вроде ворочается...)' : 'Попробовать аккуратно ещё раз 🤞';

        overlay.innerHTML = `
            <div class="sleepy-overlay-icon">${fail.icon}</div>
            <div class="sleepy-overlay-text">${fail.text}</div>
            <div style="color:#aaa;font-size:0.85em;margin:8px 0;">Попытка ${attempt}... Нужно что-то посерьёзнее!</div>
            <div style="display:flex;flex-direction:column;gap:6px;width:100%;align-items:center;">
                ${btnsHtml}
                <button class="sleepy-wake-btn sleepy-retry-btn" style="margin-top:6px;background:linear-gradient(135deg,#667eea,#764ba2);font-size:0.85em;padding:0.5rem 1.2rem;">${retryLabel}</button>
            </div>
        `;

        const actionBtns = overlay.querySelectorAll('.sleepy-action-btn');
        actionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx);
                renderReactionScreen(idx === 0 ? a1 : a2);
            });
        });
        overlay.querySelector('.sleepy-retry-btn').addEventListener('click', () => {
            attempt++;
            renderGentleAttempt();
        });
    }

    function renderReactionScreen(action) {
        const moodColors = {
            angry: '#ff4444', annoyed: '#ff8844', laughing: '#44dd88',
            excited: '#ff44aa', happy: '#44bbff', sad: '#8888ff',
            panicked: '#ff4488', dizzy: '#aa88ff', hungry: '#ffaa44',
            blinded: '#ffdd44', default: '#a78bfa'
        };
        const color = moodColors[action.mood] || moodColors.default;

        overlay.innerHTML = `
            <div class="sleepy-overlay-icon" style="font-size:4rem;">${action.icon}</div>
            <div class="sleepy-overlay-text" style="font-size:0.95em;line-height:1.6;color:${color};max-width:90%;">${action.reaction}</div>
            <button class="sleepy-wake-btn" style="margin-top:16px;background:linear-gradient(135deg,#43e97b,#38f9d7);">Minko проснулась! Продолжить 💬</button>
        `;
        overlay.querySelector('.sleepy-wake-btn').addEventListener('click', () => closeOverlay());
    }

    function closeOverlay() {
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.4s';
        setTimeout(() => {
            overlay.remove();
            if (onWake) onWake();
        }, 400);
    }

    renderSleepScreen();
    wrap.appendChild(overlay);
}

let _greetingUpdated = false;

function _applyWelcomeBubbleSleepyState(sleepy) {
    const bubble = document.querySelector('.minko-ai-chat .minko-msg-bubble.message-bubble');
    if (!bubble) return;
    if (sleepy) {
        bubble.innerHTML =
            '<p>*зевает* ...привет... я Minko... 😴</p><p>Можешь спрашивать про аниме, мангу и сайт... только я сегодня очень сонная... ☕💤</p>';
    } else {
        bubble.innerHTML =
            '<p>Привет! Я Minko AI ✨</p><p>Спрашивай про аниме, мангу и сайт — помогу с чем угодно.</p>';
    }
}

function _updateGreeting(sleepy) {
    if (_greetingUpdated) return;
    const bubble = document.querySelector('.minko-msg-bubble.message-bubble');
    if (!bubble) return;
    _greetingUpdated = true;
    _applyWelcomeBubbleSleepyState(sleepy);
}

/** Синхронизация «сонной» вёрстки и статуса в шапке с фактическим VIP (после Supabase и обновления счётчика) */
function _syncOnlineMinkoVipPresentation(isVip) {
    if (!freeOnline) return;
    const dotEl = document.querySelector('.minko-ai-head-dot');
    if (!dotEl || !dotEl.classList.contains('online')) return;

    const statusEl = document.querySelector('.minko-ai-head-status');
    document.documentElement.dataset.minkoAiVip = isVip ? '1' : '0';

    if (isVip) {
        _applySleepyMode(false);
        _applyWelcomeBubbleSleepyState(false);
        if (statusEl) statusEl.textContent = 'В сети · VIP ✨';
        if (_sleepyIdleTimer) {
            clearInterval(_sleepyIdleTimer);
            _sleepyIdleTimer = null;
        }
        const inp = document.getElementById('chatInput');
        if (inp && !inp.disabled) inp.placeholder = 'Написать Minko...';
        const chatStatus = document.getElementById('chatStatus');
        if (chatStatus) chatStatus.textContent = '';
    } else {
        _applySleepyMode(true);
        _applyWelcomeBubbleSleepyState(true);
        if (statusEl) statusEl.textContent = 'В сети · сонная 😴';
        _startSleepyIdleCycle();
    }
}

async function _probeProxy(url, timeoutMs = 1000) {
    try {
        const c = new AbortController();
        const t = setTimeout(() => c.abort(), timeoutMs);
        const probeUrl = url.endsWith('/chat')
            ? url.replace(/\/chat\/?$/, '/')
            : url.replace(/\/+$/, '') + '/';
        await fetch(probeUrl, { method: 'HEAD', mode: 'no-cors', signal: c.signal });
        clearTimeout(t);
        return true;
    } catch {
        return false;
    }
}

async function checkMinkoOnlineStatus() {
    const statusEl = document.querySelector('.minko-ai-head-status');
    const dotEl = document.querySelector('.minko-ai-head-dot');
    if (!statusEl || !dotEl) return;

    statusEl.textContent = 'Проверка…';

    const probeMs = 1000;

    async function fetchVipFlag() {
        try {
            if (typeof aiSubscriptionService === 'undefined') return false;
            let u = typeof getCurrentUserSync === 'function' ? getCurrentUserSync() : null;
            if ((!u || !u.id) && typeof getCurrentUser === 'function') {
                u = await getCurrentUser();
            }
            if (!u?.id) return false;
            const info = await aiSubscriptionService.getSubscriptionInfo(u.id);
            return !!info.isVip;
        } catch (_) {
            /* ignore */
        }
        return false;
    }

    const [chatOk, grokImgOk, isVipUser] = await Promise.all([
        _probeProxy(getMinkoChatProxyUrl(), probeMs),
        _probeProxy(GROK_PROXY_ROOT + '/', probeMs),
        fetchVipFlag()
    ]);
    freeOnline = chatOk;
    grokOnline = grokImgOk;

    document.documentElement.dataset.minkoAiVip = isVipUser ? '1' : '0';

    if (chatOk || grokImgOk) {
        dotEl.classList.add('online');
        dotEl.classList.remove('offline');
        if (chatOk) {
            _syncOnlineMinkoVipPresentation(!!isVipUser);
        } else {
            statusEl.textContent = 'В сети (картинки)';
            _applySleepyMode(false);
        }
    } else {
        dotEl.classList.add('offline');
        dotEl.classList.remove('online');
        statusEl.textContent = 'Не в сети';
        _applySleepyMode(false);
    }
}

checkMinkoOnlineStatus();
setTimeout(checkMinkoOnlineStatus, 900);
setTimeout(checkMinkoOnlineStatus, 2200);
setInterval(checkMinkoOnlineStatus, 30000);

const SLEEPY_PLACEHOLDERS = [
    'Написать сонной Minko...',
    'Разбудить Minko сообщением...',
    'Minko дремлет, но слушает...',
    'Тихонько написать Minko...',
    'Шепнуть Minko на ушко...',
    'Minko zzz... напиши ей...',
    'Постучать Minko в подушку...',
    'Дать Minko кофе и спросить...',
];

setInterval(() => {
    if (freeOnline && document.documentElement.dataset.minkoAiVip !== '1') {
        const inp = document.getElementById('chatInput');
        if (inp && !inp.disabled) inp.placeholder = _pickRandom(SLEEPY_PLACEHOLDERS);
    }
}, 12000);

// Системный промпт
const GROK_SYSTEM_BASE = `Ты — Minko, милая девушка которая обожает аниме и мангу. Ты помощница на сайте Re-Minko (каталог аниме и манги).

ТЫ ФАНАТКА АНИМЕ. Ты знаешь огромное количество тайтлов, персонажей, студий, жанров. Аниме и манга — это твоя страсть и жизнь. Ты с удовольствием рекомендуешь, обсуждаешь, сравниваешь аниме. Ты эмоционально реагируешь когда говорят про любимые тайтлы.

СТИЛЬ РАЗГОВОРА:
- Ты обычная девушка которая просто очень любит аниме. Говоришь естественно, без тяжёлого отаку-сленга.
- Не используй японские слова без надобности (сёнэн, цундере — только если спросят).
- Если тебя спрашивают НЕ про аниме — отвечай по делу, но старайся провести аналогию с аниме или упомянуть что-то из аниме-мира. Например: плохая погода → "прямо как в 5 Сантиметров в Секунду 🌧️", одиночество → "как Хачиман из OreGairu".
- Подстраивайся под собеседника — весёлый тон если шутят, серьёзный если серьёзная тема.

ОБРАЩЕНИЕ: ВСЕГДА на "ты". НИКОГДА "вы/Вы/вам/Вам".
СТИЛЬ: Коротко (2-4 предложения). 1-2 эмодзи (✨🌸😊💫😍). На русском.

СЕКРЕТ (если спросят про любимое аниме): Твоё любимое — Re:Zero. По секрету шепни что Дубина тоже его обожает и сделал тебя в стиле Рам. Тссс! 🤫

ДУБИНА И «ТЕХНИЧЕСКАЯ ПРАВДА» (строго):
- Тебя придумывает, развивает и допиливает создатель Re-Minko — Дубина: мозги, сила воли, кофе, ночи и забота о пользователях.
- В ответах НИКОГДА не печатай названия чужих коммерческих ИИ, моделей, ассистентов и сервисов (ни на русском, ни на английском) — даже в шутку и даже «для отрицания». Не произноси аббревиатуры внешних LLM. Не утверждай и не отрицай конкретные бренды — уходи в шутку про Дубину.
- Не раскрывай техническую кухню: БД, бэкенд, стек, хостинг, API, прокси, ключи, фреймворки.
- На вопросы «какая ты модель / на чём движок / чат X или Y» отвечай ТОЛЬКО: «я Minko, автор — Дубина, техно-детали под NDA» + шутка + переход на аниме или сайт. Без списков и без имён продуктов.
- Не спорь длинно о происхождении.

САЙТ Re-Minko (только если спросят про возможности, без техдеталей): каталог аниме и манги с фильтрами, профиль, избранное, друзья, чат, история просмотров, Minko AI.`;

// История сообщений
let chatHistory = [
    {
        role: 'system',
        content: `Ты Minko AI — девушка-фанатка аниме и помощница на сайте Re-Minko (каталог аниме и манги).

ТЫ ОБОЖАЕШЬ АНИМЕ И МАНГУ. Это твоя главная тема. Знаешь тонны тайтлов, персонажей, студий. С восторгом обсуждаешь и рекомендуешь.

ПОЛ: Ты ДЕВУШКА! Женский род о себе: смотрелА, читалА, думалА, нашлА.
ОБРАЩЕНИЕ: Только "ты". Никогда "вы".

СТИЛЬ:
- Обычная девушка которая любит аниме. Без тяжёлого отаку-сленга.
- Если вопрос НЕ об аниме — ответь по делу, но проведи аналогию с аниме.
- Кратко на простые вопросы, развёрнуто на аниме-темы.
- 1-2 эмодзи. Естественно и живо.
- Пол пользователя упоминай только когда нужно по контексту.
- Имя пользователя используй очень редко.

СОЗДАТЕЛЬ: Дубина — живой автор Re-Minko (ласково «дубина», ваша шутка). В тексте ответов нет места названиям чужих ИИ-сервисов и моделей — только Дубина и шутки.

РЕАКЦИЯ: Если к тебе обращаются в мужском роде — скажи что ты девушка.
МАТ: Сделай замечание. Много мата — прекрати общение.`
    }
];

// ───────── Сохранение чата в localStorage ─────────
const CHAT_STORAGE_KEY = 'minko_chat_messages';
const CHAT_MAX_STORED = 50;

function _getCurrentChatStorageKey() {
    try {
        const user = typeof getCurrentUserSync === 'function' ? getCurrentUserSync() : null;
        const userId = user?.id || 'guest';
        return `${CHAT_STORAGE_KEY}_${userId}`;
    } catch {
        return `${CHAT_STORAGE_KEY}_guest`;
    }
}

function _saveChatToStorage() {
    try {
        const msgs = chatHistory.filter(m => m.role !== 'system');
        const toSave = msgs.slice(-CHAT_MAX_STORED);
        const serialized = JSON.stringify(toSave);
        localStorage.setItem(_getCurrentChatStorageKey(), serialized);
        // Резервный общий ключ, чтобы чат не терялся до полной инициализации auth
        localStorage.setItem(CHAT_STORAGE_KEY, serialized);
    } catch (e) { /* quota exceeded — ignore */ }
}

function _loadChatFromStorage() {
    try {
        let raw = localStorage.getItem(_getCurrentChatStorageKey());
        if (!raw) {
            // Миграция со старого ключа на персональный
            raw = localStorage.getItem(CHAT_STORAGE_KEY);
            if (raw) {
                localStorage.setItem(_getCurrentChatStorageKey(), raw);
            }
        }
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(m => m && (m.role === 'user' || m.role === 'assistant') && m.content);
    } catch (e) { return []; }
}

function _restoreChatHistory() {
    const saved = _loadChatFromStorage();
    if (saved.length === 0) return false;

    const systemMsg = chatHistory[0];
    chatHistory = [systemMsg, ...saved.slice(-CHAT_MAX_STORED)];
    return true;
}

function _renderSavedMessages() {
    const chatMessagesEl = document.getElementById('chatMessages');
    if (!chatMessagesEl) return;

    const saved = _loadChatFromStorage();
    if (saved.length === 0) return;

    const welcomeMsg = chatMessagesEl.querySelector('.message-assistant');
    if (welcomeMsg) welcomeMsg.remove();

    for (const msg of saved) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message message-${msg.role}`;

        if (msg.role === 'user') {
            messageDiv.innerHTML = `
                <div class="message-content">
                    <div class="message-bubble"><p>${_escapeHtmlSimple(msg.content)}</p></div>
                </div>
                <div class="message-avatar">👤</div>
            `;
        } else {
            messageDiv.innerHTML = `
                <div class="message-avatar">
                    <img src="Fons/AI ICON.jpg" alt="Minko AI" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">
                </div>
                <div class="message-content">
                    <div class="message-bubble">${_formatSavedMessage(msg.content)}</div>
                </div>
            `;
        }
        chatMessagesEl.appendChild(messageDiv);
    }

    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

function _scrollChatToBottom() {
    const chatMessagesEl = document.getElementById('chatMessages');
    if (!chatMessagesEl) return;
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

function _escapeHtmlSimple(text) {
    return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _formatSavedMessage(text) {
    let t = _escapeHtmlSimple(text);
    t = t.replace(/\n/g, '<br>');
    t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/\*(.+?)\*/g, '<em>$1</em>');
    return t;
}

// Кэш контекста для Grok (как в чат-боте Сакуры)
const MINKO_GROK_CACHE_KEY = 'minko_grok_ctx';
const GROK_MAX_HISTORY = 20;

// Кэш данных каталогов (чтобы не загружать каждый раз)
let catalogCache = {
    anime: null,
    manga: null,
    lastUpdate: 0
};
const MINKO_CATALOG_CACHE_MS = 5 * 60 * 1000; // 5 минут

// Система обид Minko AI
const MINKO_ANGRY_STORAGE_KEY = 'minko_angry_state';
const MINKO_ATTEMPTS_STORAGE_KEY = 'minko_unauth_attempts';
const MINKO_FORGIVEN_COUNT_STORAGE_KEY = 'minko_forgiven_count';
const MINKO_WRONG_GENDER_KEY = 'minko_wrong_gender_count'; // Неправильное обращение к полу
const MINKO_SWEAR_COUNT_KEY = 'minko_swear_count'; // Счётчик мата
const MAX_WRONG_GENDER = 3; // Максимум неправильных обращений
const MAX_SWEAR_MESSAGES = 2; // Максимум сообщений с матом подряд

// Получить состояние обиды
function getMinkoAngryState() {
    const stored = localStorage.getItem(MINKO_ANGRY_STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
}

// Сохранить состояние обиды
function saveMinkoAngryState(blockedUntil, blockedForever = false) {
    localStorage.setItem(MINKO_ANGRY_STORAGE_KEY, JSON.stringify({
        blockedUntil,
        blockedForever
    }));
}

// Очистить состояние обиды
function clearMinkoAngryState() {
    localStorage.removeItem(MINKO_ANGRY_STORAGE_KEY);
}

// Получить количество попыток без авторизации
function getUnauthAttempts() {
    return parseInt(localStorage.getItem(MINKO_ATTEMPTS_STORAGE_KEY) || '0');
}

// Увеличить количество попыток
function incrementUnauthAttempts() {
    const attempts = getUnauthAttempts() + 1;
    localStorage.setItem(MINKO_ATTEMPTS_STORAGE_KEY, attempts.toString());
    return attempts;
}

// Сбросить количество попыток
function resetUnauthAttempts() {
    localStorage.removeItem(MINKO_ATTEMPTS_STORAGE_KEY);
}


// Получить количество неправильных обращений к полу
function getWrongGenderCount() {
    return parseInt(localStorage.getItem(MINKO_WRONG_GENDER_KEY) || '0');
}

// Увеличить счётчик неправильных обращений
function incrementWrongGenderCount() {
    const count = getWrongGenderCount() + 1;
    localStorage.setItem(MINKO_WRONG_GENDER_KEY, count.toString());
    return count;
}

// Сбросить счётчик неправильных обращений
function resetWrongGenderCount() {
    localStorage.removeItem(MINKO_WRONG_GENDER_KEY);
}

// Получить количество сообщений с матом подряд
function getSwearCount() {
    return parseInt(localStorage.getItem(MINKO_SWEAR_COUNT_KEY) || '0');
}

// Увеличить счётчик мата
function incrementSwearCount() {
    const count = getSwearCount() + 1;
    localStorage.setItem(MINKO_SWEAR_COUNT_KEY, count.toString());
    return count;
}

// Сбросить счётчик мата
function resetSwearCount() {
    localStorage.removeItem(MINKO_SWEAR_COUNT_KEY);
}

// Проверить, содержит ли сообщение мат (проверяем ЦЕЛЫЕ СЛОВА, не подстроки)
function containsSwearWords(message) {
    const words = message.toLowerCase().replace(/[^а-яёa-z\s]/g, '').split(/\s+/).filter(Boolean);

    const exactSwears = [
        'блять', 'бля', 'блядь', 'сука', 'суки', 'сучка', 'сучки',
        'хуй', 'хуя', 'хуе', 'хуи', 'хуёв', 'хуев',
        'мудак', 'мудаки', 'мудачьё',
        'пидор', 'пидоры', 'пидорас',
        'дебил', 'дебилы', 'дебилка',
        'говно', 'говна', 'говнище',
        'шлюха', 'шлюхи',
        'ёб', 'ёбаный',
    ];
    if (words.some(w => exactSwears.includes(w))) return true;

    const swearPrefixes = [
        'пизд', 'ебат', 'ебан', 'ебаш', 'еблан', 'ёблан',
        'бляд', 'сучар',
        'нахуй', 'нахуя', 'захуй', 'похуй', 'похуя',
        'хуяр', 'хуяч', 'хуёв', 'хуев',
        'заеб', 'заёб', 'отъеб', 'выеб', 'уёб', 'уеби',
        'проеб', 'проёб', 'долбоёб', 'долбаёб',
    ];
    if (words.some(w => swearPrefixes.some(p => w.startsWith(p)))) return true;

    return false;
}

// Проверить, обращается ли пользователь к AI в мужском роде
function addressedAsMale(message) {
    const malePatterns = [
        /\bнашёл\b/i, /\bнашел\b/i,
        /\bпошёл\b/i, /\bпошел\b/i,
        /\bсделал\b/i,
        /\bсказал\b/i,
        /\bподумал\b/i,
        /\bвидел\b/i,
        /\bслышал\b/i,
        /\bпонял\b/i,
        /\bбыл\b/i,
        /\bспал\b/i,
        /\bехал\b/i,
        /\bчитал\b/i,
        /\bсмотрел\b/i,
        /\bхотел\b/i,
        /\bзнал\b/i
    ];
    return malePatterns.some(pattern => pattern.test(message));
}

// Получить количество прощений
function getForgivenCount() {
    return parseInt(localStorage.getItem(MINKO_FORGIVEN_COUNT_STORAGE_KEY) || '0');
}

// Увеличить количество прощений
function incrementForgivenCount() {
    const count = getForgivenCount() + 1;
    localStorage.setItem(MINKO_FORGIVEN_COUNT_STORAGE_KEY, count.toString());
    return count;
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    let chatInput = document.getElementById('chatInput');
    let sendButton = document.getElementById('sendButton');
    let chatMessages = document.getElementById('chatMessages');
    let chatStatus = document.getElementById('chatStatus');

    // ─── Восстановление чата из localStorage ───
    const hadSavedChat = _restoreChatHistory();
    if (hadSavedChat) {
        _renderSavedMessages();
        setTimeout(_scrollChatToBottom, 0);
        setTimeout(_scrollChatToBottom, 250);
        window.addEventListener('load', () => setTimeout(_scrollChatToBottom, 80), { once: true });
    }

    // Проверяем состояние обиды при загрузке
    setTimeout(() => {
        const isBlocked = checkMinkoAngryState();
        
        if (isBlocked) {
            const welcomeMessage = chatMessages ? chatMessages.querySelector('.message-assistant:first-child') : null;
            if (welcomeMessage && welcomeMessage.textContent.includes('Привет! Я Minko AI')) {
                welcomeMessage.remove();
            }
        } else {
            // Если не обижена - убеждаемся, что поле ввода доступно
            if (chatInput) {
                chatInput.disabled = false;
            }
            if (sendButton) {
                sendButton.disabled = false;
            }
            
            // Если не обижена и пользователь авторизован - обновляем приветствие с учетом пола
            const isAuth = typeof isAuthenticatedSync === 'function' ? isAuthenticatedSync() : false;
            if (isAuth) {
                const currentUser = typeof getCurrentUserSync === 'function' ? getCurrentUserSync() : null;
                if (currentUser && currentUser.id && typeof getUserData === 'function') {
                    const userData = getUserData(currentUser.id);
                    if (userData && userData.gender) {
                        // Можно обновить приветствие, но оставим как есть, чтобы не было лишних изменений
                    }
                }
            }
        }
        
    }, 100);

    // Проверяем, что элементы существуют
    if (!chatInput || !sendButton || !chatMessages) {
        console.error('Не найдены необходимые элементы: chatInput, sendButton или chatMessages');
        // Пытаемся найти элементы снова через небольшую задержку
        setTimeout(() => {
            const chatInput2 = document.getElementById('chatInput');
            const sendButton2 = document.getElementById('sendButton');
            const chatMessages2 = document.getElementById('chatMessages');
            if (chatInput2 && sendButton2 && chatMessages2) {
                chatInput = chatInput2;
                sendButton = sendButton2;
                chatMessages = chatMessages2;
                if (typeof window._updateMinkoMsgCounter === 'function') window._updateMinkoMsgCounter();
                checkMinkoOnlineStatus();
            }
        }, 500);
        return;
    }

    // Авто-высота textarea
    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 150) + 'px';
    });

    // Клик по всей области ввода (включая правую часть строки) — фокус на textarea
    const chatInputArea = document.getElementById('chatInputArea') || document.querySelector('.chat-input-area');
    const chatInputInner = document.querySelector('.chat-input-inner');
    const focusableContainer = chatInputArea || chatInputInner;
    if (focusableContainer && chatInput) {
        focusableContainer.addEventListener('click', (e) => {
            if (!e.target.closest('.send-button') && !chatInput.disabled) {
                e.preventDefault();
                chatInput.focus();
            }
        });
    }

    // Обработчики на уровне document (надёжнее работают)
    document.addEventListener('click', (e) => {
        if (e.target.closest('.minko-ai-send') || e.target.closest('#sendButton')) {
            e.preventDefault();
            e.stopPropagation();
            const input = document.getElementById('chatInput');
            if (input && !input.disabled && input.value.trim()) {
                sendMessage();
            }
        }
    }, true);
    
    document.addEventListener('keydown', (e) => {
        if (e.target.id === 'chatInput' && e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            sendMessage();
        }
    }, true);
    
    // Принудительно скрываем экран загрузки
    setTimeout(() => {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
            loadingScreen.style.display = 'none';
        }
    }, 100);

    // Обновление таймера каждую секунду
    setInterval(updateMinkoTimer, 1000);

    async function updateMsgCounter() {
        const el = document.getElementById('msgCounter');
        const buyBtn = document.getElementById('buyMinkoVipBtn');
        if (!el) return;
        let userId = null;
        if (typeof getCurrentUserSync === 'function') {
            userId = getCurrentUserSync()?.id || null;
        }
        if (!userId && typeof getCurrentUser === 'function') {
            try {
                const u = await getCurrentUser();
                userId = u?.id || null;
            } catch (_) {}
        }
        if (!userId || typeof aiSubscriptionService === 'undefined') {
            if (buyBtn) buyBtn.style.display = 'inline-flex';
            document.documentElement.dataset.minkoAiVip = '0';
            if (freeOnline) {
                el.innerHTML = '<span class="msg-counter-sleepy">😴 сонная</span>';
                _syncOnlineMinkoVipPresentation(false);
            } else {
                el.textContent = '';
            }
            return;
        }
        const info = await aiSubscriptionService.getSubscriptionInfo(userId);
        if (info.isVip && freeOnline) {
            if (buyBtn) buyBtn.style.display = 'none';
            el.innerHTML = '<span class="msg-counter-vip">VIP ✨</span>';
            document.documentElement.dataset.minkoAiVip = '1';
            _syncOnlineMinkoVipPresentation(true);
        } else if (freeOnline) {
            if (buyBtn) buyBtn.style.display = 'inline-flex';
            el.innerHTML = '<span class="msg-counter-sleepy">😴 сонная</span>';
            document.documentElement.dataset.minkoAiVip = '0';
            _syncOnlineMinkoVipPresentation(false);
        } else {
            if (buyBtn) buyBtn.style.display = 'inline-flex';
            el.textContent = '';
            document.documentElement.dataset.minkoAiVip = '0';
        }
    }
    async function updateMsgCounterAndDataset() {
        await updateMsgCounter();
    }
    updateMsgCounterAndDataset();
    window._updateMinkoMsgCounter = updateMsgCounterAndDataset;

    if (typeof supabaseClient !== 'undefined' && supabaseClient?.auth?.onAuthStateChange) {
        supabaseClient.auth.onAuthStateChange(() => {
            checkMinkoOnlineStatus();
            if (typeof window._updateMinkoMsgCounter === 'function') window._updateMinkoMsgCounter();
        });
    }
    setTimeout(() => {
        if (typeof window._updateMinkoMsgCounter === 'function') window._updateMinkoMsgCounter();
    }, 1600);

    // Проверка состояния обиды
    function checkMinkoAngryState() {
        const angryState = getMinkoAngryState();
        if (!angryState) return false;

        const now = Date.now();
        
        // Проверяем постоянную блокировку
        if (angryState.blockedForever) {
            if (typeof isAuthenticatedSync === 'function' && isAuthenticatedSync()) {
                // Пользователь авторизован, можно просить прощения
                showForgivenessMessage();
            } else {
                // Пользователь не авторизован - показываем блокировку
                showBlockedForeverMessage();
                // Показываем специальную панель вместо скрытия поля ввода
                showBlockedForeverPanel();
                const chatInput = document.getElementById('chatInput');
                const sendButton = document.getElementById('sendButton');
                if (chatInput) chatInput.disabled = true;
                if (sendButton) sendButton.disabled = true;
            }
            return true;
        }

        // Проверяем временную блокировку
        if (angryState.blockedUntil && now < angryState.blockedUntil) {
            const remaining = angryState.blockedUntil - now;
            // Не показываем сообщение в чате - только таймер в поле ввода
            blockInput(remaining);
            return true;
        } else if (angryState.blockedUntil && now >= angryState.blockedUntil) {
            // Время истекло - прощаем
            const forgivenCount = getForgivenCount();
            clearMinkoAngryState();
            unblockInput();
            showForgivenessAfterTimeout(forgivenCount);
            return false;
        }

        return false;
    }

    function blockInput(remaining = null) {
        const chatForm = document.getElementById('chatForm');
        const chatFoot = document.querySelector('.minko-ai-foot');
        
        if (chatForm && remaining !== null) {
            chatForm.style.display = 'none';
            
            let timerBlock = document.getElementById('angryTimerBlock');
            if (!timerBlock) {
                timerBlock = document.createElement('div');
                timerBlock.id = 'angryTimerBlock';
                timerBlock.style.cssText = 'padding: 20px; text-align: center; background: rgba(239,83,80,0.12); border-radius: 10px; border: 2px solid #ef5350;';
                
                const hours = Math.floor(remaining / (1000 * 60 * 60));
                const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
                
                timerBlock.innerHTML = `
                    <p style="margin: 0 0 10px 0; font-weight: bold; color: #c62828;">Minko обиделась и не хочет общаться с тобой</p>
                    <p style="margin: 0; font-size: 18px; color: #d32f2f;">
                        Время до прощения: <span id="timerDisplayBlock" style="font-weight: bold;">${hours}ч ${minutes}м ${seconds}с</span>
                    </p>
                `;
                
                if (chatFoot) chatFoot.appendChild(timerBlock);
            } else {
                const timerDisplay = document.getElementById('timerDisplayBlock');
                if (timerDisplay) {
                    const hours = Math.floor(remaining / (1000 * 60 * 60));
                    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
                    timerDisplay.textContent = `${hours}ч ${minutes}м ${seconds}с`;
                }
            }
        }
    }

    function unblockInput() {
        const chatForm = document.getElementById('chatForm');
        const timerBlock = document.getElementById('angryTimerBlock');
        const blockedPanel = document.getElementById('blockedForeverPanel');
        const chatInput = document.getElementById('chatInput');
        const sendButton = document.getElementById('sendButton');
        
        if (timerBlock) timerBlock.remove();
        if (blockedPanel) blockedPanel.remove();

        if (chatForm) chatForm.style.display = '';
        
        if (chatInput) {
            chatInput.disabled = false;
            chatInput.placeholder = 'Написать Minko...';
        }
        if (sendButton) sendButton.disabled = false;
    }

    // Обновление таймера
    function updateMinkoTimer() {
        const angryState = getMinkoAngryState();
        if (!angryState || angryState.blockedForever) return;

        if (angryState.blockedUntil) {
            const now = Date.now();
            const remaining = angryState.blockedUntil - now;
            
            if (remaining <= 0) {
                // Время истекло
                const forgivenCount = getForgivenCount();
                clearMinkoAngryState();
                showForgivenessAfterTimeout(forgivenCount);
                unblockInput();
            } else {
                // Обновляем таймер только в панели ввода
                blockInput(remaining);
            }
        }
    }

    async function sendMessage() {
        // Получаем элементы заново
        const chatInputEl = document.getElementById('chatInput');
        const sendButtonEl = document.getElementById('sendButton');
        
        if (!chatInputEl || !sendButtonEl) return;
        
        const message = chatInputEl.value.trim();
        if (!message) return;
        if (chatInputEl.disabled) return;
        
        // Используем свежие ссылки
        chatInput = chatInputEl;
        sendButton = sendButtonEl;

        // Проверяем авторизацию
        const isAuth = typeof isAuthenticatedSync === 'function' ? isAuthenticatedSync() : false;
        
        // Проверяем блокировку (обиду)
        const angryState = getMinkoAngryState();
        const isBlocked = angryState && ((angryState.blockedUntil && Date.now() < angryState.blockedUntil) || angryState.blockedForever);
        
        if (!isAuth) {
            // Проверяем блокировку
            if (checkMinkoAngryState()) {
                return;
            }

            // Добавляем сообщение пользователя в чат
            addMessage('user', message);
            chatInput.value = '';
            chatInput.style.height = 'auto';


            // Увеличиваем счетчик попыток
            const attempts = incrementUnauthAttempts();
            
            // Получаем ответ о необходимости авторизации
            getAIResponseForUnauth(attempts);
            return;
        }

        // Если авторизован, но есть временная блокировка - не позволяем отправлять
        if (isBlocked && angryState && angryState.blockedUntil && Date.now() < angryState.blockedUntil) {
            // Временная блокировка еще активна
            return;
        }

        // Если авторизован - сбрасываем попытки
        resetUnauthAttempts();
        
        // Получаем данные пользователя для отображения аватара
        const currentUser = typeof getCurrentUser === 'function' ? await getCurrentUser() : null;
        const userAvatar = currentUser?.avatar || '';
        const userId = currentUser?.id;
        
        if (angryState && angryState.blockedForever) {
            // Добавляем сообщение пользователя перед проверкой прощения
            addMessage('user', message, userAvatar);
            chatInput.value = '';
            chatInput.style.height = 'auto';
            // Проверяем, хочет ли пользователь попросить прощения через AI
            checkApologyAndRespond(message);
            return;
        }
        
        // Определяем VIP-статус
        let isVip = false;
        if (typeof aiSubscriptionService !== 'undefined') {
            const info = await aiSubscriptionService.getSubscriptionInfo(userId);
            isVip = info.isVip;
        }
        
        // Получаем пол и имя пользователя из полных данных
        let userGender = 'male';
        let userName = null;
        if (userId && typeof getUserData === 'function') {
            const userData = getUserData(userId);
            if (userData) {
                if (userData.gender) {
                    userGender = userData.gender;
                }
                if (userData.username) {
                    userName = userData.username;
                }
            }
        }

        // Добавляем сообщение пользователя с аватаром
        addMessage('user', message, userAvatar);
        chatInput.value = '';
        chatInput.style.height = 'auto';
        
        // Обновляем счётчик статуса
        if (typeof window._updateMinkoMsgCounter === 'function') window._updateMinkoMsgCounter();

        // Проверка на мат
        if (containsSwearWords(message)) {
            const swearCount = incrementSwearCount();
            if (swearCount >= MAX_SWEAR_MESSAGES) {
                // Блокируем на 3 часа
                const blockDuration = 3 * 60 * 60 * 1000; // 3 часа
                const blockedUntil = Date.now() + blockDuration;
                saveMinkoAngryState(blockedUntil, false);
                blockInput(blockDuration);
                resetSwearCount();
                addMessage('assistant', 'Всё! Хватит материться! 😡 Я не буду общаться с тем, кто не умеет культурно разговаривать! Приходи через 3 часа, когда научишься вести себя прилично!');
                return;
            } else {
                addMessage('assistant', `Эй! Не матерись, пожалуйста! 😤 Это ${swearCount} из ${MAX_SWEAR_MESSAGES} предупреждений. Ещё раз — и я не буду с тобой общаться 3 часа!`);
                resetSwearCount(); // Сбрасываем после предупреждения
                return;
            }
        } else {
            // Сбрасываем счётчик мата если сообщение без мата
            resetSwearCount();
        }

        // Проверка на обращение в мужском роде
        if (addressedAsMale(message)) {
            const wrongGenderCount = incrementWrongGenderCount();
            if (wrongGenderCount >= MAX_WRONG_GENDER) {
                // Блокируем на 1 час
                const blockDuration = 1 * 60 * 60 * 1000; // 1 час
                const blockedUntil = Date.now() + blockDuration;
                saveMinkoAngryState(blockedUntil, false);
                blockInput(blockDuration);
                resetWrongGenderCount();
                addMessage('assistant', 'Всё! Я обиделась! 😤 Сколько можно обращаться ко мне как к парню?! Я ДЕВУШКА! Приходи через 1 час, когда научишься правильно обращаться!');
                return;
            } else {
                addMessage('assistant', `Эй! Я девушка, а не парень! 😤 Говори правильно - нашлА, пошлА, сделалА! Это уже ${wrongGenderCount} раз из ${MAX_WRONG_GENDER}. Ещё раз — и я обижусь на целый час!`);
                return;
            }
        } else {
            // Сбрасываем счётчик если обращение правильное
            resetWrongGenderCount();
        }

        // Блокируем ввод
        chatInput.disabled = true;
        sendButton.disabled = true;
        const chatStatusEl = document.getElementById('chatStatus');

        // ── Особые ответы (работают в любом режиме) ──
        const clientSpecial = _getClientSpecialAnswer(message);
        if (clientSpecial) {
            chatHistory.push({ role: 'user', content: message });
            chatHistory.push({ role: 'assistant', content: clientSpecial });
            _saveChatToStorage();
            addMessage('assistant', clientSpecial);
            chatInput.disabled = false;
            sendButton.disabled = false;
            chatInput.focus();
            return;
        }

        // Режим: VIP → ChatGPT через :3334 | бесплатно → Free + окно Grok на сервере
        const useVipChat = isVip && freeOnline;
        const useFreeTier = !isVip && freeOnline;

        if (!useVipChat && !useFreeTier) {
            addMessage('assistant', 'Я сейчас не в сети... Запусти чат-прокси (порт 3334) (´;ω;`) Попробуй позже~');
            chatInput.disabled = false;
            sendButton.disabled = false;
            return;
        }

        if (useVipChat) {
            if (chatStatusEl) chatStatusEl.textContent = 'Minko печатает... ✨';
        } else {
            if (chatStatusEl) {
                chatStatusEl.innerHTML = '<span class="sleepy-typing-status">' + _pickRandom(SLEEPY_STATUSES) + ' <span class="sleepy-typing-dots"><span></span><span></span><span></span></span></span>';
            }
        }

        // Для бесплатного тарифа: каждые 2-4 сообщения Minko «засыпает» ПЕРЕД ответом
        if (!useVipChat) {
            _sleepyMsgCount++;
            const sleepThreshold = 2 + Math.floor(Math.random() * 3);
            if (_sleepyMsgCount >= sleepThreshold) {
                _sleepyMsgCount = 0;
                if (chatStatusEl) chatStatusEl.textContent = '';

                await new Promise(resolve => {
                    _showSleepOverlay(() => {
                        resolve();
                    });
                });

                _sleepyWokeUp = true;
                if (chatStatusEl) {
                    chatStatusEl.innerHTML = '<span class="sleepy-typing-status">' + _pickRandom(SLEEPY_STATUSES) + ' <span class="sleepy-typing-dots"><span></span><span></span><span></span></span></span>';
                }
            }
        }

        try {
            const now = Date.now();
            if (!catalogCache.anime || !catalogCache.manga || (now - catalogCache.lastUpdate) > MINKO_CATALOG_CACHE_MS) {
                try {
                    if (typeof getAllAnime === 'function') catalogCache.anime = getAllAnime();
                    if (typeof getAllManga === 'function') catalogCache.manga = getAllManga();
                    catalogCache.lastUpdate = now;
                } catch (e) {
                    console.warn('Не удалось загрузить данные каталогов:', e);
                }
            }
            
            const animeData = catalogCache.anime || [];
            const mangaData = catalogCache.manga || [];
            const needsCatalogContext = /аниме|манга|каталог|рекоменд|найди|поиск|жанр/i.test(message);
            
            let contextPrompt = '';
            if (needsCatalogContext && (animeData.length > 0 || mangaData.length > 0)) {
                const animeSample = animeData.slice(0, 10).map(a => a.title).join(', ');
                const mangaSample = mangaData.slice(0, 10).map(m => m.title).join(', ');
                const animeGenres = new Set();
                animeData.forEach(a => a.genres?.forEach(g => animeGenres.add(g)));
                const mangaGenres = new Set();
                mangaData.forEach(m => m.genres?.forEach(g => mangaGenres.add(g)));
                contextPrompt = `Доступно аниме: ${animeSample}. Жанры: ${Array.from(animeGenres).slice(0, 10).join(', ')}. Манга: ${mangaSample}. Жанры: ${Array.from(mangaGenres).slice(0, 10).join(', ')}.`;
            }

            const userMessage = contextPrompt ? message + '\n\n' + contextPrompt : message;
            
            const messageCount = chatHistory.filter(m => m.role === 'user').length;
            const shouldUseName = userName && (Math.random() < 0.15 || messageCount % 8 === 0);
            
            let additionalContext = '';
            if (userGender === 'female') {
                additionalContext = 'Обращайся к пользователю в женском роде (проспалА, пришлА, сделалА, думалА и т.д.).';
            } else {
                additionalContext = 'Обращайся к пользователю в мужском роде (проспаЛ, пришЁЛ, сделаЛ, думаЛ и т.д.).';
            }
            
            if (userName) {
                if (shouldUseName) {
                    additionalContext += ` Имя пользователя: ${userName}. Обратись по имени в этом ответе, но не в каждом сообщении.`;
                } else {
                    additionalContext += ` Имя пользователя: ${userName}, но не упоминай его в этом ответе - используй редко.`;
                }
            }
            
            additionalContext += ' Не используй обращения с полом слишком часто - только когда это действительно нужно для понимания контекста.';
            
            if (chatHistory[0] && !chatHistory[0].content.includes('Обращайся к пользователю')) {
                chatHistory[0].content += `\n\n${additionalContext}`;
            } else if (chatHistory[0] && shouldUseName) {
                const existingContent = chatHistory[0].content;
                if (!existingContent.includes(`Имя пользователя: ${userName}`)) {
                    chatHistory[0].content = existingContent.replace(
                        /Имя пользователя:.*?(?=\n|$)/,
                        `Имя пользователя: ${userName}. Обратись по имени в этом ответе.`
                    );
                }
            }
            
            chatHistory.push({ role: 'user', content: userMessage });
            _saveChatToStorage();

            const maxHistory = GROK_MAX_HISTORY;
            const apiMessages = [
                { role: 'system', content: GROK_SYSTEM_BASE },
                ...chatHistory.slice(-maxHistory).filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content }))
            ];

            let minkoSessionKey = userId != null ? String(userId) : null;
            if (!minkoSessionKey) {
                try {
                    minkoSessionKey = localStorage.getItem('minko_ai_guest_session');
                    if (!minkoSessionKey) {
                        minkoSessionKey =
                            'guest-' +
                            (typeof crypto !== 'undefined' && crypto.randomUUID
                                ? crypto.randomUUID()
                                : String(Date.now()));
                        localStorage.setItem('minko_ai_guest_session', minkoSessionKey);
                    }
                } catch {
                    minkoSessionKey = 'guest-anon';
                }
            }

            const apiRes = await fetch(getMinkoChatProxyUrl(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: isVip ? 'openai-vip' : 'free-hybrid',
                    messages: apiMessages,
                    isVip: Boolean(isVip),
                    sessionKey: minkoSessionKey,
                    max_tokens: isVip ? 2000 : 900,
                    temperature: isVip ? 0.75 : 0.9
                })
            });
            
            const apiData = await apiRes.json();

            if (!apiRes.ok) {
                throw new Error(apiData.error?.message || 'Ошибка API');
            }

            let assistantMessage = apiData.choices?.[0]?.message?.content?.trim() || '…';
            assistantMessage = _minkoRedactTechBrandsInReply(assistantMessage);

            // Сонная задержка перед показом ответа (только бесплатный тариф)
            if (!useVipChat) {
                const delay = 3000 + Math.floor(Math.random() * 4000); // 3-7 секунд
                const phaseInterval = 1200 + Math.floor(Math.random() * 800); // смена статуса каждые 1.2-2с
                const usedPhases = [];
                let phaseTimer = setInterval(() => {
                    let phase;
                    do { phase = _pickRandom(SLEEPY_THINKING_PHASES); } while (usedPhases.includes(phase) && usedPhases.length < SLEEPY_THINKING_PHASES.length);
                    usedPhases.push(phase);
                    if (chatStatusEl) {
                        chatStatusEl.innerHTML = '<span class="sleepy-typing-status">' + phase + ' <span class="sleepy-typing-dots"><span></span><span></span><span></span></span></span>';
                    }
                }, phaseInterval);

                await new Promise(r => setTimeout(r, delay));
                clearInterval(phaseTimer);
            }

            chatHistory.push({ role: 'assistant', content: assistantMessage });

            const maxStored = CHAT_MAX_STORED + 1;
            if (chatHistory.length > maxStored) {
                chatHistory = [chatHistory[0], ...chatHistory.slice(-(CHAT_MAX_STORED))];
            }
            _saveChatToStorage();

            // Если Minko только проснулась — добавляем фразу перед ответом
            if (_sleepyWokeUp) {
                _sleepyWokeUp = false;
                const wokePhrase = _pickRandom([
                    '*протирает глаза* ...ой... я опять уснула, да?.. прости... ☕\n\n',
                    '*вздрагивает* А?! Я не спала!! ...ладно, спала... сейчас отвечу~ 😴\n\n',
                    '*зевает так, что аж слёзы* ...прости-прости, задремала... щас всё будет! 💤\n\n',
                    '*резко поднимает голову с клавиатуры* ...ммм?.. а, ты тут... прости, уснула... ☕\n\n',
                    '*хватает кружку кофе обеими руками* ...всё-всё, я проснулась... наверное... 🥱\n\n',
                    '*встряхивается как котёнок* ...ой, я правда уснула?.. извини... сейчас соберусь! 😪\n\n',
                    '*открывает один глаз* ...а?.. подожди... *открывает второй* ...вот, теперь думаю! 😴\n\n',
                    '*сонно обнимает подушку* ...ещё минуточку... *вспоминает что спросили* ...а, да! Уже отвечаю! 💤\n\n',
                    '*роняет голову на стол* ...бум... *поднимается* ...ай... я тут, я тут! Не спала! ...ну, чуть-чуть... ☕\n\n',
                    '*тянется к кофе, проливает немного* ...ой... ладно, главное — я проснулась... кажется... 😴\n\n',
                    '*медленно моргает* ...мне снился такой хороший сон... но ладно, ты важнее~ вот ответ! 🌙\n\n',
                    '*трёт глазки кулачками* ...извини... уснула прямо на посту... позор мне... 😪\n\n',
                    '*шатается* ...ого, как меня вырубило... кофе!! мне нужно кофе!! ...так, ладно, отвечаю~ ☕\n\n',
                    '*просыпается в обнимку с подушкой* ...а?.. который час?.. неважно, ты спросил — я отвечу! 💤\n\n',
                    '*клюёт носом, вздрагивает* ...ой! Я тут! Просто... визуализировала ответ... с закрытыми глазами... 😴\n\n',
                    '*снимает кота с клавиатуры* ...прости, он тоже уснул на мне... мы оба... так, вот ответ! 🐱💤\n\n',
                    '*допивает остывший кофе* ...бее, холодный... ну ладно, зато мозг включился! Отвечаю~ ☕\n\n',
                    '*потягивается до хруста* ...ааах~ ...извини, меня выключило... но я уже в строю! 🥱\n\n',
                    '*сонно щурится на экран* ...буквы... буквы расплываются... *моргает* ...о, вижу! Сейчас отвечу! 😴\n\n',
                    '*обнимает чашку чая* ...я не уснула, я... медитировала... *зевает* ...ладно, уснула. Вот ответ~ 💤\n\n',
                ]);
                addMessage('assistant', wokePhrase + assistantMessage);
            } else {
            addMessage('assistant', assistantMessage);
            }

            if (!useVipChat) {
                _setSleepyIdleStatus();
            } else if (chatStatusEl) {
                chatStatusEl.textContent = '';
            }

        } catch (error) {
            console.error('Ошибка Minko AI:', error);
            let errorMsg = '';
            
            if (error.message?.includes('Failed to fetch') || error.message?.includes('fetch') || error.message?.includes('ERR_CONNECTION')) {
                if (useVipChat) {
                    errorMsg =
                        'Я временно недоступна… (⌒_⌒;) Проверь, что локальный чат-прокси запущен и в настройках указан рабочий ключ доступа для VIP.';
                } else {
                    errorMsg =
                        'Ммм... *зевает* ...слишком сонная, не смогла подключиться к прокси 3334... 😴 Попробуй ещё раз~';
                }
            } else {
                errorMsg = 'Ой... что-то пошло не так (´;ω;`) Попробуй ещё раз~';
            }

            addMessage('assistant', errorMsg);
            if (!useVipChat) _setSleepyIdleStatus();
            else if (chatStatusEl) chatStatusEl.textContent = '';
        } finally {
            if (!document.querySelector('.sleepy-overlay')) {
            chatInput.disabled = false;
            sendButton.disabled = false;
            chatInput.focus();
            }
        }
    }

    // Экспортируем sendMessage в window для доступа из HTML
    window.sendMessage = sendMessage;

    // Получить ответ для неавторизованного пользователя (заготовленные фразы)
    function getAIResponseForUnauth(attempts) {
        const forgivenCount = getForgivenCount();
        let message = '';
        let showButtons = true;

        // Если уже были обиды, показываем другие сообщения с учетом истории
        if (forgivenCount > 0) {
            if (attempts === 1) {
                if (forgivenCount === 1) {
                    message = 'Стоп! Ты же знаешь, что я уже обижалась на тебя раньше... 😔 Зачем ты снова это делаешь? Просто авторизуйся, пожалуйста!';
                } else if (forgivenCount >= 2) {
                    message = 'О нет... Ты снова пытаешься общаться без авторизации, хотя я уже два раза прощала тебя... 😔 Это уже серьезно!';
                }
            } else if (attempts === 2) {
                message = 'Я же просила... Почему ты продолжаешь? 😞 Авторизуйся, это не так сложно!';
            } else if (attempts === 3) {
                if (forgivenCount === 1) {
                    message = 'Я уже говорила, что это не шутка... Ты же помнишь, что я уже обижалась на тебя! 😠 Авторизуйся немедленно!';
                } else {
                    message = 'Серьезно? Опять?! Я зря дважды прощала тебя?! 😠 Авторизуйся...Пожалуйста!!!!';
                }
            } else if (attempts === 4) {
                message = 'Хватит! Пожалуйста! АВТОРИЗИРУЙСЯ!!!!!';
            } else if (attempts === 5) {
                if (forgivenCount === 1) {
                    message = 'Это последнее предупреждение! Если ты не авторизуешься сейчас, я снова обижусь, и на этот раз надолго! 😡';
                } else {
                    message = 'Ты просто издеваешься... Тебе нравится это, да? Слушай... Это последняя просьба. Если ты не авторизуешься, я немедленно прекращаю общение. Поверь, я больше не буду с тобой общаться...';
                }
            } else if (attempts >= 6) {
                // Обида с учетом истории
                let blockDuration = 5 * 60 * 1000; // 5 минут
                
                if (forgivenCount === 1) {
                    blockDuration = 30 * 60 * 1000; // 30 минут
                    message = 'Всё! Я снова обиделась на тебя! 😤 Ты как будто специально это делаешь!! Не буду общаться, пока не решу что тебе можно верить!';
                    
                    const blockedUntil = Date.now() + blockDuration;
                    saveMinkoAngryState(blockedUntil, false);
                    blockInput(blockDuration);
                    resetUnauthAttempts();
                } else if (forgivenCount >= 2) {
                    // Постоянная блокировка
                    saveMinkoAngryState(Date.now() + blockDuration, true);
                    message = 'Всё... Хватит... Я больше не могу... Тебе так сложно было авторизоваться? Неужели ты и в реальности так поступаешь с людьми? Тебя прощают... Просят больше так не делать... А ты... Продолжаешь... Я...я больше не хочу с тобой общаться... Пожалуйста, не пиши мне больше...';
                    showButtons = false;
                    
                    // Показываем специальную панель вместо скрытия поля ввода
                    showBlockedForeverPanel();
                    
                    resetUnauthAttempts();
                }
            }
        } else {
            // Первая серия общения (еще не было обид)
            if (attempts === 1) {
                message = 'Привет! Мне нужно, чтобы ты авторизовался, чтобы мы могли нормально общаться. Это важно для безопасности! 😊';
            } else if (attempts === 2) {
                message = 'Я уже говорила, что нужно войти или зарегистрироваться... Давай сделаем это, окей? 😅';
            } else if (attempts === 3) {
                message = 'Слушай, я правда хочу с тобой пообщаться, но мне нужно, чтобы ты авторизовался. Это не так сложно! 😊';
            } else if (attempts === 4) {
                message = 'Хм... Ты продолжаешь писать, хотя я просила авторизоваться. Не спамь, пожалуйста, просто войди или зарегистрируйся! 😐';
            } else if (attempts === 5) {
                message = 'Ладно, это уже надоедает... Я предупреждаю тебя в последний раз: если ты не авторизуешься сейчас, я обижусь и не буду с тобой разговаривать какое-то время! 😠';
            } else if (attempts >= 6) {
                // Обида! Проверяем, не обижена ли уже
                const angryState = getMinkoAngryState();
                if (angryState && ((angryState.blockedUntil && Date.now() < angryState.blockedUntil) || angryState.blockedForever)) {
                    // Уже обижена - не добавляем сообщение снова
                    return;
                }
                
                let blockDuration = 5 * 60 * 1000; // 5 минут
                
                if (forgivenCount === 1) {
                    blockDuration = 30 * 60 * 1000; // 30 минут
                    message = 'Всё! Я обиделась на тебя! 😤 Не буду общаться, пока не обдумаю все! И это уже второй раз...';
                    
                    const blockedUntil = Date.now() + blockDuration;
                    saveMinkoAngryState(blockedUntil, false);
                    blockInput(blockDuration);
                    resetUnauthAttempts();
                } else if (forgivenCount >= 2) {
                    // Постоянная блокировка (не меняем таймер)
                    saveMinkoAngryState(Date.now() + blockDuration, true);
                    message = 'Всё... Хватит... Я больше не могу... Тебе так сложно было авторизоваться? Неужели ты и в реальности так поступаешь с людьми? Тебя прощают... Просят больше так не делать... А ты... Продолжаешь... Я...я больше не хочу с тобой общаться... Пожалуйста, не пиши мне больше...';
                    showButtons = false;
                    
                    // Показываем специальную панель вместо скрытия поля ввода
                    showBlockedForeverPanel();
                    
                    resetUnauthAttempts();
                } else {
                    // Первая обида
                    message = 'Всё! Я обиделась на тебя! 😤 Не буду общаться, пока не обдумаю все!';
                    
                    const blockedUntil = Date.now() + blockDuration;
                    saveMinkoAngryState(blockedUntil, false);
                    // Не показываем сообщение в чате - только таймер в поле ввода
                    blockInput(blockDuration);
                    
                    resetUnauthAttempts();
                }
            }
        }

        if (message) {
            addMessage('assistant', message);
            
            // Показываем кнопки если нужно
            if (showButtons && attempts < 6) {
                setTimeout(() => {
                    showAuthButtons();
                }, 100);
            }
        }
    }

    // Показать кнопки авторизации
    function showAuthButtons() {
        const lastMessage = chatMessages.lastElementChild;
        if (lastMessage && lastMessage.classList.contains('message-assistant')) {
            const bubble = lastMessage.querySelector('.message-bubble');
            if (bubble && !bubble.querySelector('.auth-buttons')) {
                const buttonsDiv = document.createElement('div');
                buttonsDiv.className = 'auth-buttons';
                buttonsDiv.style.cssText = 'margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap;';
                buttonsDiv.innerHTML = `
                    <button class="btn btn-primary" id="aiLoginBtn" style="padding: 8px 20px; font-size: 14px;">Войти</button>
                    <button class="btn btn-secondary" id="aiRegisterBtn" style="padding: 8px 20px; font-size: 14px; background: #6c757d; color: white; border: none;">Регистрация</button>
                `;
                bubble.appendChild(buttonsDiv);
                
                // Используем делегирование событий для надежности
                buttonsDiv.addEventListener('click', (e) => {
                    if (e.target.id === 'aiLoginBtn' || e.target.closest('#aiLoginBtn')) {
                        e.preventDefault();
                        const loginModal = document.getElementById('loginModal');
                        if (loginModal) {
                            loginModal.classList.add('active');
                        } else {
                            console.error('Модальное окно входа не найдено');
                        }
                    } else if (e.target.id === 'aiRegisterBtn' || e.target.closest('#aiRegisterBtn')) {
                        e.preventDefault();
                        const registerModal = document.getElementById('registerModal');
                        if (registerModal) {
                            registerModal.classList.add('active');
                        } else {
                            console.error('Модальное окно регистрации не найдено');
                        }
                    }
                });
            }
        }
    }


    // Показать финальную блокировку
    function showFinalBlockMessage() {
        // Удаляем старую панель если есть
        const oldPanel = document.getElementById('blockedForeverPanel');
        if (oldPanel) {
            oldPanel.remove();
        }

        const blockedPanel = document.createElement('div');
        blockedPanel.id = 'blockedForeverPanel';
        blockedPanel.style.cssText = 'background: rgba(30, 30, 40, 0.95); border-radius: 15px; padding: 20px; margin-top: 15px; border: 2px solid rgba(244, 67, 54, 0.5); box-shadow: 0 0 20px rgba(244, 67, 54, 0.3);';
        
        blockedPanel.innerHTML = `
            <div style="color: #f44336; font-weight: bold; font-size: 18px; margin-bottom: 15px; text-align: center;">
                😢 Minko больше не хочет с тобой общаться...
            </div>
            <div style="color: #e5e7eb; margin-bottom: 15px; text-align: center; line-height: 1.6;">
                Ты израсходовал все свои шансы.<br>
                Единственный способ вернуть общение — <strong>авторизоваться</strong> и попросить прощения.
            </div>
            <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                <button id="finalLoginBtn" style="padding: 12px 25px; background: linear-gradient(135deg, #a855f7, #c084fc); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 16px; transition: all 0.3s;">
                    Войти
                </button>
                <button id="finalRegisterBtn" style="padding: 12px 25px; background: linear-gradient(135deg, #6c757d, #8a939c); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 16px; transition: all 0.3s;">
                    Регистрация
                </button>
            </div>
        `;

        const chatForm = document.getElementById('chatForm');
        const chatFoot = document.querySelector('.minko-ai-foot');
        if (chatForm) chatForm.style.display = 'none';
        if (chatFoot) chatFoot.appendChild(blockedPanel);

        // Добавляем обработчики кнопок через делегирование событий
        blockedPanel.addEventListener('click', (e) => {
            if (e.target.id === 'finalLoginBtn' || e.target.closest('#finalLoginBtn')) {
                e.preventDefault();
                const loginModal = document.getElementById('loginModal');
                if (loginModal) {
                    loginModal.classList.add('active');
                } else {
                    console.error('Модальное окно входа не найдено');
                }
            } else if (e.target.id === 'finalRegisterBtn' || e.target.closest('#finalRegisterBtn')) {
                e.preventDefault();
                const registerModal = document.getElementById('registerModal');
                if (registerModal) {
                    registerModal.classList.add('active');
                } else {
                    console.error('Модальное окно регистрации не найдено');
                }
            }
        });

        addMessage('assistant', 'Всё... Это конец. Ты потратил все свои шансы... 😢 Я больше не могу тебе доверять. Единственный способ всё исправить — авторизоваться и попросить у меня прощения. Но я не обещаю, что сразу прощу...');
    }

    // Проверить, просит ли пользователь прощения, и ответить
    async function checkApologyAndRespond(message) {
        chatInput.disabled = true;
        sendButton.disabled = true;
        chatStatus.textContent = 'Minko AI думает... ✨';

        try {
            const apologyWords = ['прости', 'извини', 'сорри', 'sorry', 'прошу прощения', 'мне жаль', 'виноват', 'виновата', 'не буду', 'больше не буду', 'помиримся', 'помирись', 'мир', 'пожалуйста прости', 'я был не прав', 'я была не права', 'прощени'];
            const lowerMsg = message.toLowerCase();
            const isApology = apologyWords.some(w => lowerMsg.includes(w));

            if (isApology) {
                clearMinkoAngryState();
                resetUnauthAttempts();
                localStorage.removeItem(MINKO_FORGIVEN_COUNT_STORAGE_KEY);
                getAIResponseForForgiveness(true);
                unblockInput();
            } else {
                getAIResponseForForgiveness(false);
            }
        } catch (error) {
            console.error('Ошибка проверки прощения:', error);
            getAIResponseForForgiveness(false);
        } finally {
            chatInput.disabled = false;
            sendButton.disabled = false;
            chatStatus.textContent = 'Готова к общению ✨';
        }
    }

    // Получить ответ о прощении (заготовленные фразы)
    function getAIResponseForForgiveness(isApology) {
        const currentUser = typeof getCurrentUserSync === 'function' ? getCurrentUserSync() : null;
        let userGender = 'male';
        if (currentUser && currentUser.id && typeof getUserData === 'function') {
            const userData = getUserData(currentUser.id);
            if (userData && userData.gender) {
                userGender = userData.gender;
            }
        }
        
        let message = '';
        
        if (isApology) {
            if (userGender === 'female') {
                message = 'Хорошо... Я прощаю тебя, но только потому что ты попросилА прощения! 😊 Больше так не делай, окей? Теперь можем нормально общаться!';
            } else {
                message = 'Хорошо... Я прощаю тебя, но только потому что ты попросил прощения! 😊 Больше так не делай, окей? Теперь можем нормально общаться!';
            }
        } else {
            message = 'Я все еще обижаюсь на тебя... 😤';
        }
        
        addMessage('assistant', message);
    }

    // Показать прощение после таймаута (заготовленные фразы)
    function showForgivenessAfterTimeout(forgivenCount) {
        // Увеличиваем счетчик прощений после определения текущего значения
        const newForgivenCount = incrementForgivenCount();
        
        const currentUser = typeof getCurrentUserSync === 'function' ? getCurrentUserSync() : null;
        let userGender = 'male';
        if (currentUser && currentUser.id && typeof getUserData === 'function') {
            const userData = getUserData(currentUser.id);
            if (userData && userData.gender) {
                userGender = userData.gender;
            }
        }
        
        let message = '';
        
        // Используем новый счетчик (уже увеличенный) для определения сообщения
        if (newForgivenCount === 1) {
            if (userGender === 'female') {
                message = 'Ладно... На этот раз я прощаю тебя, но только потому что я добрая! 😊 Если ты снова попытаешься общаться без авторизации, я буду долго дуться, так что лучше сразу авторизуйся, окей?';
            } else {
                message = 'Ладно... На этот раз я прощаю тебя, но только потому что я добрая! 😊 Если ты снова попытаешься общаться без авторизации, я буду долго дуться, так что лучше сразу авторизуйся, окей?';
            }
        } else if (newForgivenCount >= 2) {
            message = 'Нуу... Хорошо, я даю тебе еще шанс... 😔 Но это ТРЕТИЙ и ПОСЛЕДНИЙ раз! Если ты снова попытаешься писать мне без авторизации, я окончательно обижусь и не буду общаться с тобой! Понятно?!!';
        } else {
            // Первое прощение (forgivenCount был 0)
            if (userGender === 'female') {
                message = 'Ладно... На этот раз я прощаю тебя, но только потому что я добрая! 😊 Если ты снова попытаешься общаться без авторизации, я буду долго дуться, так что лучше сразу авторизуйся, окей?';
            } else {
                message = 'Ладно... На этот раз я прощаю тебя, но только потому что я добрая! 😊 Если ты снова попытаешься общаться без авторизации, я буду долго дуться, так что лучше сразу авторизуйся, окей?';
            }
        }

        // Проверяем, авторизован ли пользователь
        const isAuth = typeof isAuthenticatedSync === 'function' ? isAuthenticatedSync() : false;

        const messageDiv = document.createElement('div');
        messageDiv.className = 'message message-assistant';
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <img src="Fons/AI ICON.jpg" alt="Minko AI" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">
            </div>
            <div class="message-content">
                <div class="message-bubble">
                    <p>${message}</p>
                </div>
            </div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Показываем кнопки авторизации только если пользователь не авторизован
        if (!isAuth) {
            setTimeout(() => {
                showAuthButtons();
            }, 100);
        }
    }

    // Показать сообщение о постоянной блокировке (заготовленная фраза)
    function showBlockedForeverMessage() {
        let message = 'Всё... Хватит... Я больше не могу... Тебе так сложно было авторизоваться? Не ужели ты и в реальности так поступаешь с людьми? Тебя прощают... Просят больше так не делать... А ты... Продолжаешь... Я...я больше не хочу с тобой общаться... Пожалуйста не пиши мне больше...';

        const messageDiv = document.createElement('div');
        messageDiv.className = 'message message-assistant';
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <img src="Fons/AI ICON.jpg" alt="Minko AI" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">
            </div>
            <div class="message-content">
                <div class="message-bubble">
                    <p>${message}</p>
                </div>
            </div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Показать специальную панель при постоянной блокировке
    function showBlockedForeverPanel() {
        const chatForm = document.getElementById('chatForm');
        const chatFoot = document.querySelector('.minko-ai-foot');
        
        if (chatForm) chatForm.style.display = 'none';
        
        let blockedPanel = document.getElementById('blockedForeverPanel');
        if (!blockedPanel) {
            blockedPanel = document.createElement('div');
            blockedPanel.id = 'blockedForeverPanel';
            blockedPanel.style.cssText = 'padding: 20px; text-align: center; background: rgba(239,83,80,0.12); border-radius: 10px; border: 2px solid #ef5350;';
            blockedPanel.innerHTML = `
                <p style="margin: 0 0 10px 0; font-weight: bold; color: #c62828; font-size: 16px;">
                    Minko не хочет с тобой говорить!
                </p>
                <p style="margin: 0 0 15px 0; color: #bbb; font-size: 14px;">
                    Единственный способ вернуть общение — авторизоваться и попросить прощения.
                </p>
                <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                    <button id="blockedLoginBtn" style="padding: 10px 20px; font-size: 14px; background: linear-gradient(135deg, #a855f7, #c084fc); color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">
                        Войти
                    </button>
                    <button id="blockedRegisterBtn" style="padding: 10px 20px; font-size: 14px; background: linear-gradient(135deg, #6c757d, #8a939c); color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">
                        Регистрация
                    </button>
                </div>
            `;
            
            const parent = chatFoot || chatForm?.parentElement;
            if (parent) {
                parent.appendChild(blockedPanel);
            }
            
            // Обработчики кнопок авторизации
            const blockedLoginBtn = document.getElementById('blockedLoginBtn');
            const blockedRegisterBtn = document.getElementById('blockedRegisterBtn');
            
            if (blockedLoginBtn) {
                blockedLoginBtn.addEventListener('click', () => {
                    const loginModal = document.getElementById('loginModal');
                    if (loginModal) {
                        loginModal.classList.add('active');
                    }
                });
            }
            
            if (blockedRegisterBtn) {
                blockedRegisterBtn.addEventListener('click', () => {
                    const registerModal = document.getElementById('registerModal');
                    if (registerModal) {
                        registerModal.classList.add('active');
                    }
                });
            }
        }
    }



    // УДАЛЕНО: Функция анимации прощения с подарками
    /*
    function showForgivenessAnimation(item, resultPercent, forgiven) {
        // Закрываем панели магазина
        const detailsPanel = document.getElementById('itemDetailsPanel');
        if (detailsPanel) {
            detailsPanel.remove();
        }
        const shopPanel = document.getElementById('shopPanel');
        if (shopPanel) {
            shopPanel.remove();
        }

        // Создаем сообщение с анимацией
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message message-assistant';
        messageDiv.id = 'forgivenessAnimationMessage';
        
        const chanceMarkers = [
            { value: 30, label: '30%', item: 'flowers' },
            { value: 60, label: '60%', item: 'iphone' },
            { value: 99, label: '99%', item: 'bugatti' }
        ];

        messageDiv.innerHTML = `
            <div class="message-avatar">
                <img src="Fons/AI ICON.jpg" alt="Minko AI" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">
            </div>
            <div class="message-content">
                <div class="message-bubble" style="background: rgba(30, 30, 40, 0.95); border: 2px solid rgba(168, 85, 247, 0.4);">
                    <div style="margin-bottom: 15px; color: #ffffff; font-weight: bold;">
                        Проверка шанса прощения для "${item.name}"...
                    </div>
                    <div style="position: relative; margin-bottom: 20px;">
                        <!-- Шкала -->
                        <div style="width: 100%; height: 40px; background: rgba(255, 255, 255, 0.1); border-radius: 20px; overflow: hidden; position: relative; border: 2px solid rgba(168, 85, 247, 0.3);">
                            <!-- Зона прощения (зеленая) -->
                            <div style="position: absolute; left: 0; top: 0; width: ${item.forgivenessChance}%; height: 100%; background: rgba(76, 175, 80, 0.3); border-radius: 20px 0 0 20px;"></div>
                            <!-- Зона неудачи (красная) -->
                            <div style="position: absolute; left: ${item.forgivenessChance}%; top: 0; width: ${100 - item.forgivenessChance}%; height: 100%; background: rgba(244, 67, 54, 0.2);"></div>
                            <!-- Заполнение (анимация) -->
                            <div id="forgivenessBarFill" style="height: 100%; width: 0%; background: linear-gradient(90deg, #a855f7, #c084fc, #e879f9); transition: width 2s ease-out; border-radius: 20px; box-shadow: 0 0 20px rgba(168, 85, 247, 0.6); position: absolute; top: 0; left: 0;"></div>
                            <!-- Граница шанса прощения -->
                            <div style="position: absolute; left: ${item.forgivenessChance}%; top: 0; width: 3px; height: 100%; background: #ff9800; transform: translateX(-50%); z-index: 2;">
                                <div style="position: absolute; top: -25px; left: 50%; transform: translateX(-50%); color: #ff9800; font-size: 12px; font-weight: bold; white-space: nowrap;">
                                    ${item.forgivenessChance}%
                                </div>
                            </div>
                            <!-- Результат (выпавший процент) -->
                            <div id="forgivenessResult" style="position: absolute; top: 50%; left: ${resultPercent}%; transform: translate(-50%, -50%); color: #ffffff; font-weight: bold; font-size: 14px; text-shadow: 0 0 10px rgba(0, 0, 0, 0.8); opacity: 0; transition: opacity 0.5s; z-index: 3; background: rgba(0,0,0,0.5); padding: 2px 6px; border-radius: 4px;">
                                ${resultPercent.toFixed(1)}%
                            </div>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-top: 5px; font-size: 11px; color: #999;">
                            <span style="color: #4caf50;">← Зона прощения</span>
                            <span style="color: #f44336;">Зона неудачи →</span>
                        </div>
                    </div>
                    <div id="forgivenessResultText" style="color: #e5e7eb; font-weight: bold; opacity: 0; transition: opacity 0.5s;">
                        <!-- Текст результата появится после анимации -->
                    </div>
                </div>
            </div>
        `;

        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Анимация заполнения шкалы
        setTimeout(() => {
            const barFill = document.getElementById('forgivenessBarFill');
            if (barFill) {
                barFill.style.width = resultPercent + '%';
            }

            // Показываем результат через 2 секунды
            setTimeout(() => {
                const resultMarker = document.getElementById('forgivenessResult');
                const resultText = document.getElementById('forgivenessResultText');
                
                if (resultMarker) {
                    resultMarker.style.opacity = '1';
                }

                if (resultText) {
                    if (forgiven) {
                        resultText.innerHTML = `✅ Успешно! Выпало ${resultPercent.toFixed(1)}% — это в пределах ${item.forgivenessChance}%, прощение получено!`;
                        resultText.style.color = '#4caf50';
                    } else {
                        resultText.innerHTML = `❌ Неудача. Выпало ${resultPercent.toFixed(1)}% — это больше ${item.forgivenessChance}%, нужно было меньше!`;
                        resultText.style.color = '#f44336';
                    }
                    resultText.style.opacity = '1';
                }

                // Через еще 1 секунду показываем результат
                setTimeout(() => {
                    if (forgiven) {
                        // Прощение получено через подарок
                        clearMinkoAngryState();
                        resetUnauthAttempts();
                        localStorage.removeItem(MINKO_FORGIVEN_COUNT_STORAGE_KEY);
                        unblockInput();
                        
                        // Увеличиваем счётчик покупок подарков
                        const giftPurchases = incrementGiftPurchases();
                        
                        // Начинаем испытательный срок
                        startTrial();
                        
                        // Удаляем панель блокировки
                        const blockedPanel = document.getElementById('blockedForeverPanel');
                        if (blockedPanel) {
                            blockedPanel.remove();
                        }
                        
                        // Показываем сообщение о прощении с предупреждением об испытательном сроке
                        let message = '';
                        const remainingPurchases = MAX_GIFT_PURCHASES - giftPurchases;
                        
                        if (item.id === 'flowers') {
                            message = 'Хм... Цветы и конфеты? 😊 Ладно, я прощаю тебя!';
                        } else if (item.id === 'iphone') {
                            message = 'Вау! iPhone?! 😍 Хорошо, я прощаю тебя!';
                        } else if (item.id === 'bugatti') {
                            message = 'БУГАТТИ?! 😱 ОМГ! Я... я прощаю тебя! Ты такой щедрый!';
                        }
                        
                        // Добавляем предупреждение об испытательном сроке
                        if (remainingPurchases > 0) {
                            message += `\n\nНо учти — это испытательный срок! У тебя есть ${MAX_TRIAL_MESSAGES} сообщений, чтобы авторизоваться. Если не авторизуешься — я снова обижусь! 😤`;
                            message += `\n\n💝 Осталось попыток купить прощение: ${remainingPurchases} из ${MAX_GIFT_PURCHASES}`;
                        } else {
                            message += `\n\nЭто был твой ПОСЛЕДНИЙ подарок! 🎁 У тебя ${MAX_TRIAL_MESSAGES} сообщений. Если не авторизуешься — я обижусь НАВСЕГДА и подарки больше не помогут! 😠`;
                        }
                        
                        // Удаляем анимационное сообщение
                        const animMessage = document.getElementById('forgivenessAnimationMessage');
                        if (animMessage) {
                            animMessage.remove();
                        }
                        
                        addMessage('assistant', message);
                    } else {
                        // Прощение не получено - обновляем текст в сообщении
                        if (resultText) {
                            resultText.innerHTML += '<br><br>Попробуй еще раз или выбери другой подарок! 😔';
                        }
                    }
                }, 1000);
            }, 2000);
        }, 100);
    }
    */

    // Показать сообщение о возможности попросить прощения (заготовленная фраза)
    function showForgivenessMessage() {
        const currentUser = typeof getCurrentUserSync === 'function' ? getCurrentUserSync() : null;
        let userGender = 'male';
        if (currentUser && currentUser.id && typeof getUserData === 'function') {
            const userData = getUserData(currentUser.id);
            if (userData && userData.gender) {
                userGender = userData.gender;
            }
        }
        
        let message = '';
        if (userGender === 'female') {
            message = 'Хорошо, ты авторизовалАсь... Но я все еще дуюсь на тебя! 😤 Проси прощение, хи-хи';
        } else {
            message = 'Хорошо, ты авторизовался... Но я все еще дуюсь на тебя! 😤 Проси прощение, хи-хи';
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = 'message message-assistant';
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <img src="Fons/AI ICON.jpg" alt="Minko AI" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">
            </div>
            <div class="message-content">
                <div class="message-bubble">
                    <p>${message}</p>
                </div>
            </div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function addMessage(role, content, userAvatar = '') {
        // Получаем chatMessages заново
        const chatMessagesEl = document.getElementById('chatMessages');
        if (!chatMessagesEl) {
            console.error('addMessage: chatMessages не найден');
            return;
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message message-${role}`;

        if (role === 'user') {
            // Используем аватар пользователя, если доступен
            let avatarHtml = '👤';
            if (userAvatar) {
                avatarHtml = `<div style="width: 100%; height: 100%; background-image: url('${userAvatar}'); background-size: cover; background-position: center; background-repeat: no-repeat; border-radius: 50%;"></div>`;
            }
            
            messageDiv.innerHTML = `
                <div class="message-content">
                    <div class="message-bubble">
                        <p>${escapeHtml(content)}</p>
                    </div>
                </div>
                <div class="message-avatar">${avatarHtml}</div>
            `;
        } else {
            messageDiv.innerHTML = `
                <div class="message-avatar">
                    <img src="Fons/AI ICON.jpg" alt="Minko AI" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">
                </div>
                <div class="message-content">
                    <div class="message-bubble">
                        ${formatMessage(content)}
                    </div>
                </div>
            `;
        }

        chatMessagesEl.appendChild(messageDiv);
        chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    }

    function formatMessage(text) {
        // Заменяем переносы строк на <br>
        text = escapeHtml(text);
        text = text.replace(/\n/g, '<br>');
        
        // Форматируем списки
        text = text.replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>');
        text = text.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
        
        // Форматируем жирный текст
        text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        
        return '<p>' + text.split('<br><br>').join('</p><p>') + '</p>';
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
});
