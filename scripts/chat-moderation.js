// Базовая модерация чата: маскировка мата и токсичных тем
(function () {
    const profanityWords = [
        'блять', 'бля', 'сука', 'хуй', 'хуе', 'хуя', 'пизд', 'еба', 'ёба', 'ебан', 'ебл',
        'мудак', 'уеб', 'урод', 'гандон', 'шлюх', 'сучк'
    ];

    const sensitiveTopicWords = [
        'политик', 'политика', 'президент', 'депутат', 'выборы', 'митинг', 'пропаганд',
        'санкц', 'нато', 'революц', 'войн', 'теракт', 'расстрел', 'суицид', 'самоубий'
    ];

    const allBlockedRoots = [...profanityWords, ...sensitiveTopicWords];

    function escapeRegex(value) {
        return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function normalizeText(text) {
        return String(text || '').replace(/ё/g, 'е').replace(/Ё/g, 'Е');
    }

    function getKeepCharsLength(wordLen) {
        if (wordLen <= 4) return 2;
        if (wordLen <= 8) return 3;
        return 3;
    }

    function maskWord(word) {
        const source = String(word || '');
        const keep = getKeepCharsLength(source.length);
        return source.slice(0, keep) + '*'.repeat(Math.max(1, source.length - keep));
    }

    function sanitizeText(text) {
        const original = String(text || '');
        if (!original) return { text: '', changed: false, hits: 0, sensitive: false };

        let output = original;
        let hits = 0;

        for (const root of allBlockedRoots) {
            const re = new RegExp(escapeRegex(root) + '[а-яa-z0-9_-]*', 'giu');
            output = output.replace(re, (match) => {
                hits += 1;
                return maskWord(match);
            });
        }

        const sensitive = sensitiveTopicWords.some((root) => {
            const re = new RegExp(escapeRegex(root), 'iu');
            return re.test(normalizeText(original));
        });

        return {
            text: output,
            changed: output !== original,
            hits,
            sensitive
        };
    }

    function hasSensitiveTopics(text) {
        return sanitizeText(text).sensitive;
    }

    window.ChatModeration = {
        sanitizeText,
        hasSensitiveTopics
    };
})();
