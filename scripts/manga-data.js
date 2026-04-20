// База данных манги
const mangaDatabase = {
    all: [
        {
            id: 2001,
            title: "Атака титанов",
            titleAlt: "Shingeki no Kyojin",
            rating: 9.0,
            year: 2009,
            genres: ["Экшен", "Драма", "Фэнтези", "Триллер"],
            type: "Манга",
            status: "Завершён",
            totalChapters: 141,
            author: "Хадзимэ Исаяма",
            description: "Человечество живёт за стенами, защищающими от гигантских титанов. Юный Эрен Йегер клянётся уничтожить всех титанов после того, как один из них убивает его мать."
        },
        {
            id: 2002,
            title: "Наруто",
            titleAlt: "Naruto",
            rating: 8.7,
            year: 1999,
            genres: ["Экшен", "Приключения", "Фэнтези"],
            type: "Манга",
            status: "Завершён",
            totalChapters: 700,
            author: "Масаси Кисимото",
            description: "Наруто Удзумаки — шумный подросток-ниндзя, в теле которого запечатан демон-лис. Он мечтает стать Хокагэ — лидером своей деревни."
        },
        {
            id: 2003,
            title: "Ван Пис",
            titleAlt: "One Piece",
            rating: 9.2,
            year: 1997,
            genres: ["Экшен", "Приключения", "Комедия", "Фэнтези"],
            type: "Манга",
            status: "Онгоинг",
            totalChapters: 1110,
            author: "Эйитиро Ода",
            description: "Монки Д. Луффи отправляется в путешествие, чтобы найти легендарное сокровище One Piece и стать королём пиратов."
        },
        {
            id: 2004,
            title: "Тетрадь смерти",
            titleAlt: "Death Note",
            rating: 8.9,
            year: 2003,
            genres: ["Триллер", "Детектив", "Психология", "Драма"],
            type: "Манга",
            status: "Завершён",
            totalChapters: 108,
            author: "Цугуми Ооба",
            description: "Старшеклассник Лайт Ягами находит тетрадь, позволяющую убивать людей, записывая их имена. Он решает очистить мир от преступности."
        },
        {
            id: 2005,
            title: "Берсерк",
            titleAlt: "Berserk",
            rating: 9.4,
            year: 1989,
            genres: ["Экшен", "Фэнтези", "Драма", "Ужасы"],
            type: "Манга",
            status: "Онгоинг",
            totalChapters: 376,
            author: "Кэнтаро Миура",
            description: "Гатс — наёмник с огромным мечом, преследующий демонов. Мрачная эпическая история о мести, судьбе и несломленной воле."
        },
        {
            id: 2006,
            title: "Токийский гуль",
            titleAlt: "Tokyo Ghoul",
            rating: 8.5,
            year: 2011,
            genres: ["Экшен", "Драма", "Ужасы", "Психология"],
            type: "Манга",
            status: "Завершён",
            totalChapters: 179,
            author: "Суи Исида",
            description: "Канэки Кэн становится наполовину гулем после нападения и вынужден балансировать между миром людей и гулей."
        },
        {
            id: 2007,
            title: "Блич",
            titleAlt: "Bleach",
            rating: 8.2,
            year: 2001,
            genres: ["Экшен", "Приключения", "Фэнтези"],
            type: "Манга",
            status: "Завершён",
            totalChapters: 686,
            author: "Тайто Кубо",
            description: "Ичиго Куросаки получает силы жнеца душ и должен защищать людей от злых духов — Пустых."
        },
        {
            id: 2008,
            title: "Охотник x Охотник",
            titleAlt: "Hunter x Hunter",
            rating: 9.1,
            year: 1998,
            genres: ["Экшен", "Приключения", "Фэнтези"],
            type: "Манга",
            status: "Онгоинг",
            totalChapters: 400,
            author: "Ёсихиро Тогаси",
            description: "Гон Фрикс отправляется сдавать экзамен на охотника, чтобы найти своего отца — легендарного охотника."
        },
        {
            id: 2009,
            title: "Моя геройская академия",
            titleAlt: "Boku no Hero Academia",
            rating: 8.3,
            year: 2014,
            genres: ["Экшен", "Фэнтези", "Школа"],
            type: "Манга",
            status: "Завершён",
            totalChapters: 430,
            author: "Кохэй Хорикоси",
            description: "В мире, где у 80% людей есть суперспособности, бесталанный Мидория Изуку мечтает стать героем."
        },
        {
            id: 2010,
            title: "Магическая битва",
            titleAlt: "Jujutsu Kaisen",
            rating: 8.8,
            year: 2018,
            genres: ["Экшен", "Фэнтези", "Ужасы"],
            type: "Манга",
            status: "Завершён",
            totalChapters: 271,
            author: "Гэгэ Акутами",
            description: "Итадори Юдзи проглатывает палец демона Сукуны и вступает в мир магов, борющихся с проклятиями."
        },
        {
            id: 2011,
            title: "Ванпанчмен",
            titleAlt: "One Punch Man",
            rating: 8.8,
            year: 2012,
            genres: ["Экшен", "Комедия", "Пародия"],
            type: "Манга",
            status: "Онгоинг",
            totalChapters: 200,
            author: "ONE / Юсукэ Мурата",
            description: "Сайтама — герой, который побеждает любого противника одним ударом. Скука от собственной силы — его главная проблема."
        },
        {
            id: 2012,
            title: "Человек-бензопила",
            titleAlt: "Chainsaw Man",
            rating: 8.7,
            year: 2018,
            genres: ["Экшен", "Фэнтези", "Ужасы"],
            type: "Манга",
            status: "Онгоинг",
            totalChapters: 180,
            author: "Тацуки Фудзимото",
            description: "Дэндзи — нищий парень, который сливается с демоном-бензопилой и становится охотником на демонов ради простой мечты о нормальной жизни."
        },
        {
            id: 2013,
            title: "Клинок, рассекающий демонов",
            titleAlt: "Kimetsu no Yaiba",
            rating: 8.6,
            year: 2016,
            genres: ["Экшен", "Фэнтези", "Драма"],
            type: "Манга",
            status: "Завершён",
            totalChapters: 205,
            author: "Коёхару Готогэ",
            description: "Тандзиро Камадо становится охотником на демонов, чтобы вернуть обращённую в демона сестру Нэзуко в человеческий облик."
        },
        {
            id: 2014,
            title: "Обещанный Неверленд",
            titleAlt: "Yakusoku no Neverland",
            rating: 8.5,
            year: 2016,
            genres: ["Триллер", "Фэнтези", "Драма", "Детектив"],
            type: "Манга",
            status: "Завершён",
            totalChapters: 181,
            author: "Каиу Сирай",
            description: "Дети из приюта узнают, что их растят как пищу для демонов, и планируют побег."
        },
        {
            id: 2015,
            title: "Доктор Стоун",
            titleAlt: "Dr. Stone",
            rating: 8.4,
            year: 2017,
            genres: ["Приключения", "Комедия", "Фантастика"],
            type: "Манга",
            status: "Завершён",
            totalChapters: 232,
            author: "Риитиро Инагаки",
            description: "После того как всё человечество обращено в камень, гений науки Сэнку пробуждается спустя 3700 лет и решает восстановить цивилизацию с помощью науки."
        },
        {
            id: 2016,
            title: "Шпион × Семья",
            titleAlt: "Spy x Family",
            rating: 8.6,
            year: 2019,
            genres: ["Комедия", "Экшен", "Повседневность"],
            type: "Манга",
            status: "Онгоинг",
            totalChapters: 100,
            author: "Тацуя Эндо",
            description: "Шпион, убийца и телепатка создают фальшивую семью, не зная секретов друг друга. Каждый из них скрывает свою истинную личность."
        },
        {
            id: 2017,
            title: "Соло Левелинг",
            titleAlt: "Solo Leveling",
            rating: 8.9,
            year: 2018,
            genres: ["Экшен", "Фэнтези", "Приключения"],
            type: "Манхва",
            status: "Завершён",
            totalChapters: 200,
            author: "Чхугон",
            description: "Слабейший охотник Сон Джин Ву получает уникальную способность повышать уровень без ограничений и становится сильнейшим."
        },
        {
            id: 2018,
            title: "Стальной алхимик",
            titleAlt: "Fullmetal Alchemist",
            rating: 9.1,
            year: 2001,
            genres: ["Экшен", "Приключения", "Фэнтези", "Драма"],
            type: "Манга",
            status: "Завершён",
            totalChapters: 116,
            author: "Хирому Аракава",
            description: "Братья Элрик используют алхимию, чтобы вернуть свои тела после неудачной попытки воскресить мать."
        },
        {
            id: 2019,
            title: "Токийские мстители",
            titleAlt: "Tokyo Revengers",
            rating: 8.0,
            year: 2017,
            genres: ["Экшен", "Драма", "Фантастика"],
            type: "Манга",
            status: "Завершён",
            totalChapters: 278,
            author: "Кэн Вакуи",
            description: "Такэмити путешествует во времени, чтобы спасти свою девушку, изменив прошлое токийской банды."
        },
        {
            id: 2020,
            title: "Великий из бродячих псов",
            titleAlt: "Bungou Stray Dogs",
            rating: 8.3,
            year: 2012,
            genres: ["Экшен", "Детектив", "Комедия"],
            type: "Манга",
            status: "Онгоинг",
            totalChapters: 115,
            author: "Кафка Асагири",
            description: "Детективное агентство с людьми, обладающими сверхъестественными способностями, названными в честь писателей."
        },
        {
            id: 2021,
            title: "Синий замок",
            titleAlt: "Blue Lock",
            rating: 8.4,
            year: 2018,
            genres: ["Спорт", "Драма", "Психология"],
            type: "Манга",
            status: "Онгоинг",
            totalChapters: 280,
            author: "Мунэюки Канэсиро",
            description: "Программа по созданию лучшего нападающего Японии собирает 300 молодых футболистов для жёсткого отбора."
        },
        {
            id: 2022,
            title: "Класс превосходства",
            titleAlt: "Youkoso Jitsuryoku Shijou Shugi no Kyoushitsu e",
            rating: 8.2,
            year: 2015,
            genres: ["Драма", "Психология", "Школа"],
            type: "Манга",
            status: "Онгоинг",
            totalChapters: 90,
            author: "Сёго Киногаса",
            description: "Элитная школа, где ученики делятся на классы по способностям. Тихий Аянокодзи скрывает свой истинный потенциал."
        },
        {
            id: 2023,
            title: "Сказка о хвосте феи",
            titleAlt: "Fairy Tail",
            rating: 7.8,
            year: 2006,
            genres: ["Экшен", "Приключения", "Комедия", "Фэнтези"],
            type: "Манга",
            status: "Завершён",
            totalChapters: 545,
            author: "Хиро Масима",
            description: "Маг огня Нацу Драгнил и его друзья из гильдии Хвост Феи отправляются в захватывающие приключения."
        },
        {
            id: 2024,
            title: "Убийца Акамэ!",
            titleAlt: "Akame ga Kill!",
            rating: 7.9,
            year: 2010,
            genres: ["Экшен", "Фэнтези", "Драма"],
            type: "Манга",
            status: "Завершён",
            totalChapters: 80,
            author: "Такахиро",
            description: "Группа убийц Night Raid сражается против коррумпированной империи. Жестокий мир, где никто не в безопасности."
        },
        {
            id: 2025,
            title: "Re:Zero",
            titleAlt: "Re:Zero kara Hajimeru Isekai Seikatsu",
            rating: 8.5,
            year: 2014,
            genres: ["Фэнтези", "Драма", "Триллер", "Психология"],
            type: "Манга",
            status: "Онгоинг",
            totalChapters: 60,
            author: "Таппэй Нагацуки",
            description: "Субару Нацуки попадает в фэнтезийный мир и обнаруживает, что после смерти он возвращается в определённую точку времени."
        },
        {
            id: 2026,
            title: "Паразит",
            titleAlt: "Parasyte",
            rating: 8.6,
            year: 1988,
            genres: ["Экшен", "Ужасы", "Фантастика", "Драма"],
            type: "Манга",
            status: "Завершён",
            totalChapters: 64,
            author: "Хитоси Ивааки",
            description: "Инопланетный паразит захватывает правую руку Синъити. Вместе они вынуждены сосуществовать и бороться с другими паразитами."
        },
        {
            id: 2027,
            title: "Класс убийц",
            titleAlt: "Ansatsu Kyoushitsu",
            rating: 8.4,
            year: 2012,
            genres: ["Экшен", "Комедия", "Школа"],
            type: "Манга",
            status: "Завершён",
            totalChapters: 187,
            author: "Юсэй Мацуи",
            description: "Ученики класса 3-Е должны убить своего учителя — сверхсущество, грозящее уничтожить Землю. Но он — лучший учитель, который у них был."
        },
        {
            id: 2028,
            title: "Созданный в Бездне",
            titleAlt: "Made in Abyss",
            rating: 8.8,
            year: 2012,
            genres: ["Приключения", "Фэнтези", "Драма"],
            type: "Манга",
            status: "Онгоинг",
            totalChapters: 67,
            author: "Акихито Цукуси",
            description: "Рико спускается в Бездну — гигантскую пропасть, полную чудес и смертельных опасностей, чтобы найти свою мать."
        },
        {
            id: 2029,
            title: "Волчица и пряности",
            titleAlt: "Spice and Wolf",
            rating: 8.3,
            year: 2007,
            genres: ["Приключения", "Романтика", "Фэнтези"],
            type: "Манга",
            status: "Завершён",
            totalChapters: 100,
            author: "Исуна Хасэкура",
            description: "Странствующий торговец Крафт Лоуренс путешествует с волчицей-богиней Холо, мудрой и озорной."
        },
        {
            id: 2030,
            title: "Виланд Сага",
            titleAlt: "Vinland Saga",
            rating: 9.0,
            year: 2005,
            genres: ["Экшен", "Приключения", "Драма", "Исторический"],
            type: "Манга",
            status: "Завершён",
            totalChapters: 208,
            author: "Макото Юкимура",
            description: "Торфинн — молодой викинг, жаждущий мести за отца. Эпическая история о войне, мире и смысле жизни."
        },
        {
            id: 2031,
            title: "Монстр",
            titleAlt: "Monster",
            rating: 9.1,
            year: 1994,
            genres: ["Триллер", "Драма", "Детектив", "Психология"],
            type: "Манга",
            status: "Завершён",
            totalChapters: 162,
            author: "Наоки Урасава",
            description: "Доктор Тэнма спасает жизнь мальчику, который вырастает серийным убийцей. Теперь он должен остановить монстра, которого сам создал."
        },
        {
            id: 2032,
            title: "Клеймор",
            titleAlt: "Claymore",
            rating: 8.2,
            year: 2001,
            genres: ["Экшен", "Фэнтези", "Драма"],
            type: "Манга",
            status: "Завершён",
            totalChapters: 159,
            author: "Нороихиро Яги",
            description: "Воительницы-полудемоны, называемые Клейморами, защищают людей от демонов — ёма."
        },
        {
            id: 2033,
            title: "Огненная бригада",
            titleAlt: "Enen no Shouboutai",
            rating: 7.9,
            year: 2015,
            genres: ["Экшен", "Фантастика", "Драма"],
            type: "Манга",
            status: "Завершён",
            totalChapters: 304,
            author: "Ацуси Окубо",
            description: "Синра Кусакабэ вступает в пожарную бригаду, борющуюся с людьми, спонтанно возгорающимися и превращающимися в демонов."
        },
        {
            id: 2034,
            title: "Чёрный дворецкий",
            titleAlt: "Kuroshitsuji",
            rating: 8.1,
            year: 2006,
            genres: ["Экшен", "Фэнтези", "Детектив", "Комедия"],
            type: "Манга",
            status: "Онгоинг",
            totalChapters: 210,
            author: "Яна Тобосо",
            description: "Юный граф Сиэль Фантомхайв заключает контракт с демоном-дворецким Себастьяном ради мести."
        },
        {
            id: 2035,
            title: "Тетрадь друзей Нацумэ",
            titleAlt: "Natsume Yuujinchou",
            rating: 8.5,
            year: 2003,
            genres: ["Фэнтези", "Драма", "Повседневность"],
            type: "Манга",
            status: "Онгоинг",
            totalChapters: 120,
            author: "Юки Мидорикава",
            description: "Нацумэ видит духов и решает вернуть им имена из тетради, оставленной его бабушкой."
        },
        {
            id: 2036,
            title: "Дневник будущего",
            titleAlt: "Mirai Nikki",
            rating: 7.8,
            year: 2006,
            genres: ["Экшен", "Триллер", "Романтика", "Психология"],
            type: "Манга",
            status: "Завершён",
            totalChapters: 59,
            author: "Сакаэ Эсуно",
            description: "12 владельцев дневников будущего сражаются насмерть за право стать богом. Юки и безумно влюблённая Юно — среди них."
        },
        {
            id: 2037,
            title: "Ковбой Бибоп",
            titleAlt: "Cowboy Bebop",
            rating: 8.4,
            year: 1998,
            genres: ["Экшен", "Фантастика", "Драма"],
            type: "Манга",
            status: "Завершён",
            totalChapters: 24,
            author: "Юта Якэ",
            description: "Команда охотников за головами путешествует по космосу на корабле «Бибоп», зарабатывая на жизнь ловлей преступников."
        },
        {
            id: 2038,
            title: "Доктор Стоун: 4D Science",
            titleAlt: "Dr. Stone: 4D Science",
            rating: 8.0,
            year: 2023,
            genres: ["Приключения", "Комедия", "Фантастика"],
            type: "Манга",
            status: "Онгоинг",
            totalChapters: 30,
            author: "Риитиро Инагаки",
            description: "Продолжение истории Сэнку. Новые научные открытия и приключения в мире, возрождённом из камня."
        },
        {
            id: 2039,
            title: "Кагуя: В любви как на войне",
            titleAlt: "Kaguya-sama wa Kokurasetai",
            rating: 8.7,
            year: 2015,
            genres: ["Комедия", "Романтика", "Психология", "Школа"],
            type: "Манга",
            status: "Завершён",
            totalChapters: 281,
            author: "Ака Акасака",
            description: "Два гениальных студента влюблены друг в друга, но считают, что признание — это поражение. Война интеллектов за первый шаг."
        },
        {
            id: 2040,
            title: "Башня Бога",
            titleAlt: "Tower of God",
            rating: 8.5,
            year: 2010,
            genres: ["Экшен", "Фэнтези", "Приключения", "Драма"],
            type: "Манхва",
            status: "Онгоинг",
            totalChapters: 600,
            author: "SIU",
            description: "Бам входит в загадочную Башню, чтобы найти свою подругу Рахель. Каждый этаж — новое испытание и новые враги."
        },
        {
            id: 2041,
            title: "Благословение небожителей",
            titleAlt: "Tian Guan Ci Fu",
            rating: 8.6,
            year: 2017,
            genres: ["Фэнтези", "Романтика", "Приключения", "Драма"],
            type: "Маньхуа",
            status: "Онгоинг",
            totalChapters: 120,
            author: "Мосян Тунсю",
            description: "Бывший принц-воин Се Лянь третий раз возносится на небеса и встречает загадочного Короля-демона Хуа Чэна."
        },
        {
            id: 2042,
            title: "Магистр дьявольского культа",
            titleAlt: "Mo Dao Zu Shi",
            rating: 8.7,
            year: 2015,
            genres: ["Фэнтези", "Экшен", "Приключения", "Драма"],
            type: "Маньхуа",
            status: "Онгоинг",
            totalChapters: 260,
            author: "Мосян Тунсю",
            description: "Вэй У Сянь, основатель тёмного пути культивации, воскресает спустя 13 лет и расследует цепь загадочных событий."
        },
        {
            id: 2043,
            title: "Ад",
            titleAlt: "Hellsing",
            rating: 8.3,
            year: 1997,
            genres: ["Экшен", "Ужасы", "Фэнтези"],
            type: "Манга",
            status: "Завершён",
            totalChapters: 92,
            author: "Кота Хирано",
            description: "Организация Хеллсинг и её могущественный вампир Алукард сражаются с нежитью, угрожающей Англии."
        },
        {
            id: 2044,
            title: "Одержимые смертью",
            titleAlt: "Deadman Wonderland",
            rating: 7.8,
            year: 2007,
            genres: ["Экшен", "Фантастика", "Ужасы"],
            type: "Манга",
            status: "Завершён",
            totalChapters: 58,
            author: "Дзинсэй Катаока",
            description: "Ганта, ложно обвинённый в убийстве, попадает в тюрьму-аттракцион, где заключённые сражаются насмерть."
        },
        {
            id: 2045,
            title: "Невеста чародея",
            titleAlt: "Mahou Tsukai no Yome",
            rating: 8.4,
            year: 2013,
            genres: ["Фэнтези", "Драма", "Романтика"],
            type: "Манга",
            status: "Онгоинг",
            totalChapters: 100,
            author: "Корэ Ямадзаки",
            description: "Чисэ, девушка-сирота, продаётся на аукционе и попадает к загадочному магу Элиасу, который делает её своей ученицей и невестой."
        },
        {
            id: 2046,
            title: "Обитель Хаоса",
            titleAlt: "Dandadan",
            rating: 8.5,
            year: 2021,
            genres: ["Экшен", "Комедия", "Фэнтези", "Фантастика"],
            type: "Манга",
            status: "Онгоинг",
            totalChapters: 170,
            author: "Юкинобу Татсу",
            description: "Окулт-фанатка и скептик объединяются, когда сталкиваются с инопланетянами и духами одновременно. Безумные приключения с драками и романтикой."
        },
        {
            id: 2047,
            title: "Сакамото уходит на пенсию",
            titleAlt: "Sakamoto Days",
            rating: 8.3,
            year: 2020,
            genres: ["Экшен", "Комедия"],
            type: "Манга",
            status: "Онгоинг",
            totalChapters: 180,
            author: "Юто Судзуки",
            description: "Бывший легендарный наёмник стал толстым владельцем магазинчика. Но прошлое не отпускает."
        },
        {
            id: 2048,
            title: "Адская электричка",
            titleAlt: "Mashle: Magic and Muscles",
            rating: 8.0,
            year: 2020,
            genres: ["Экшен", "Комедия", "Фэнтези"],
            type: "Манга",
            status: "Завершён",
            totalChapters: 162,
            author: "Хадзимэ Комото",
            description: "В мире, где магия — всё, Мэш Бёрндэд лишён магических способностей, но компенсирует это невероятной физической силой."
        },
        {
            id: 2049,
            title: "Кайдзю №8",
            titleAlt: "Kaiju No. 8",
            rating: 8.2,
            year: 2020,
            genres: ["Экшен", "Фантастика", "Комедия"],
            type: "Манга",
            status: "Онгоинг",
            totalChapters: 115,
            author: "Наоя Мацумото",
            description: "Кафка Хибино мечтает стать бойцом противокайдзю, но неожиданно сам превращается в монстра — Кайдзю №8."
        },
        {
            id: 2050,
            title: "Фрирен: Провожающая в последний путь",
            titleAlt: "Sousou no Frieren",
            rating: 9.0,
            year: 2020,
            genres: ["Фэнтези", "Приключения", "Драма"],
            type: "Манга",
            status: "Онгоинг",
            totalChapters: 135,
            author: "Канэхито Ямада",
            description: "Эльфийка-маг Фрирен, пережившая своих спутников-героев, отправляется в путешествие, чтобы понять людей и ценность времени."
        }
    ]
};

// Получить мангу по ID (числовое сравнение — id может быть number или string)
function getMangaById(id) {
    const num = parseInt(id, 10);
    if (Number.isNaN(num)) return undefined;
    return mangaDatabase.all.find(m => parseInt(m.id, 10) === num);
}

// Получить все манги
function getAllManga() {
    return mangaDatabase.all;
}

// Поиск манги
function searchManga(query) {
    const lowerQuery = query.toLowerCase();
    return mangaDatabase.all.filter(manga => 
        manga.title.toLowerCase().includes(lowerQuery) ||
        (manga.titleAlt && manga.titleAlt.toLowerCase().includes(lowerQuery)) ||
        (manga.genres && manga.genres.some(g => g.toLowerCase().includes(lowerQuery))) ||
        (manga.author && manga.author.toLowerCase().includes(lowerQuery))
    );
}

// Фильтрация манги
function filterManga(filters) {
    let results = getAllManga();
    
    if (filters.genre && filters.genre.length > 0) {
        if (filters.genre.length >= 2) {
            results = results.filter(manga =>
                filters.genre.every(selectedGenre => 
                    manga.genres.some(mangaGenre => 
                        mangaGenre.toLowerCase().trim() === selectedGenre.toLowerCase().trim()
                    )
                    )
                );
        } else {
            const selectedGenre = filters.genre[0].toLowerCase().trim();
            results = results.filter(manga => 
                manga.genres.some(genre => genre.toLowerCase().trim() === selectedGenre)
            );
        }
    }
    
    if (filters.type && filters.type.length > 0) {
        results = results.filter(manga => filters.type.includes(manga.type));
    }
    
    if (filters.status && filters.status.length > 0) {
        results = results.filter(manga => filters.status.includes(manga.status));
    }
    
    if (filters.yearFrom) {
        results = results.filter(manga => manga.year >= filters.yearFrom);
    }
    
    if (filters.yearTo) {
        results = results.filter(manga => manga.year <= filters.yearTo);
    }
    
    if (filters.ratingMin) {
        results = results.filter(manga => manga.rating >= filters.ratingMin);
    }
    
    if (filters.search) {
        const searchResults = searchManga(filters.search);
        results = results.filter(manga => searchResults.includes(manga));
    }
    
    if (filters.removeDuplicates !== false) {
        results = removeMangaDuplicates(results);
    }
    
    return results;
}

function removeMangaDuplicates(mangaList) {
    const seen = new Map();
    mangaList.forEach(manga => {
        const key = manga.title.toLowerCase()
            .replace(/\s+/g, '')
            .replace(/[:\-–—]/g, '')
            .trim();
        if (!seen.has(key) || seen.get(key).rating < manga.rating) {
            seen.set(key, manga);
        }
    });
    return Array.from(seen.values());
}

function sortManga(mangaList, sortBy) {
    const sorted = [...mangaList];
    switch(sortBy) {
        case 'rating-desc': return sorted.sort((a, b) => b.rating - a.rating);
        case 'rating-asc': return sorted.sort((a, b) => a.rating - b.rating);
        case 'year-desc': return sorted.sort((a, b) => b.year - a.year);
        case 'year-asc': return sorted.sort((a, b) => a.year - b.year);
        case 'title-asc': return sorted.sort((a, b) => a.title.localeCompare(b.title));
        case 'title-desc': return sorted.sort((a, b) => b.title.localeCompare(a.title));
        default: return sorted;
    }
}

function getAllMangaGenres() {
    const genres = new Set();
    mangaDatabase.all.forEach(manga => {
        manga.genres.forEach(genre => genres.add(genre));
    });
    return Array.from(genres).sort();
}
