-- ============================================
-- БАЗА ДАННЫХ RE-MINKO
-- Выполните в Supabase SQL Editor
-- Скрипт идемпотентный: можно запускать повторно
-- Таблицы создаются/обновляются, лишние удаляются
--
-- ВАЖНО (приватность):
--   • watch_history: SELECT разрешён всем (USING true) — так фронт читает историю
--     чужого профиля. Если нужна только «своя» история — смените политику и уберите
--     выборку чужих строк в profile.js.
--   • notifications: INSERT с auth.uid() IS NOT NULL — любой залогиненный может
--     вставить строку с любым user_id (заявки в друзья и т.д.). Спам снижайте в коде.
--
-- ОПАСНО: блок «УДАЛЕНИЕ ТАБЛИЦ» ниже удаляет ЛЮБЫЕ public-таблицы не из списка.
-- Если добавляли свои таблицы — допишите их в _allowed или закомментируйте блок.
--
-- НОВЫЙ ПРОЕКТ SUPABASE: URL/ключи в этом файле НЕ хранятся. После создания проекта:
--   1) Выполните весь скрипт здесь (SQL Editor нового проекта).
--   2) Пропишите URL и anon JWT в scripts/config.js (или config.local.js) — см. SUPABASE_CHECKLIST.md
-- ============================================

-- ============================================
-- 1. СОЗДАНИЕ ТАБЛИЦ (IF NOT EXISTS)
-- ============================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT NOT NULL,
  avatar TEXT,
  gender TEXT CHECK (gender IN ('male', 'female')) DEFAULT 'male',
  telegram_id TEXT,
  last_online TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.favorites_anime (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  anime_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id, anime_id)
);

CREATE TABLE IF NOT EXISTS public.favorites_manga (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  manga_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id, manga_id)
);

CREATE TABLE IF NOT EXISTS public.watch_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  anime_id TEXT NOT NULL,
  episode_number INTEGER NOT NULL,
  watched_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  ads_enabled BOOLEAN DEFAULT true,
  notifications_enabled BOOLEAN DEFAULT true,
  auto_play_next_episode BOOLEAN DEFAULT false,
  show_recommendations BOOLEAN DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.minko_ai_state (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  is_angry BOOLEAN DEFAULT false,
  angry_until TIMESTAMP WITH TIME ZONE,
  blocked_forever BOOLEAN DEFAULT false,
  unauth_attempts INTEGER DEFAULT 0,
  trial_messages INTEGER DEFAULT 0,
  wrong_gender_count INTEGER DEFAULT 0,
  swear_count INTEGER DEFAULT 0,
  forgiven_count INTEGER DEFAULT 0,
  last_interaction TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  subscription_type TEXT CHECK (subscription_type IN ('free', 'premium', 'unlimited')) DEFAULT 'free',
  messages_limit INTEGER DEFAULT 50,
  messages_used INTEGER DEFAULT 0,
  last_reset_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.vip_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.watch_together_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  host_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  anime_id TEXT,
  manga_id TEXT,
  type TEXT CHECK (type IN ('anime', 'manga')) NOT NULL,
  current_episode INTEGER,
  current_chapter INTEGER,
  playback_position INTEGER DEFAULT 0,
  is_playing BOOLEAN DEFAULT false,
  playback_time FLOAT DEFAULT 0,
  video_source TEXT,
  is_active BOOLEAN DEFAULT true,
  session_code TEXT UNIQUE NOT NULL,
  max_participants INTEGER DEFAULT 4,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.watch_together_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES watch_together_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  has_vip BOOLEAN DEFAULT false,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(session_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.watch_together_chat (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES watch_together_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Сигнaling WebRTC для голосового чата «Смотреть вместе» (mesh, только при всех VIP в комнате — проверка в UI)
CREATE TABLE IF NOT EXISTS public.watch_together_voice_signals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.watch_together_sessions(id) ON DELETE CASCADE NOT NULL,
  from_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  to_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('offer', 'answer', 'candidate', 'hangup', 'mod_mute')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.friends (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  friend_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'accepted', 'blocked')) DEFAULT 'pending',
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id, friend_id)
);

CREATE TABLE IF NOT EXISTS public.global_chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  reply_to UUID REFERENCES public.global_chat_messages(id) ON DELETE SET NULL,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.global_chat_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES public.global_chat_messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(message_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  link TEXT,
  data JSONB,
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  achievement_type TEXT NOT NULL,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id, achievement_type)
);

CREATE TABLE IF NOT EXISTS public.custom_anime (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  title_alt TEXT NOT NULL,
  type TEXT DEFAULT 'Сериал',
  year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  total_episodes INTEGER DEFAULT 12,
  status TEXT DEFAULT 'Онгоинг',
  genres TEXT[] DEFAULT '{}',
  description TEXT,
  studio TEXT,
  rating DECIMAL(3,1) DEFAULT 0,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Глобальный каталог: тайтлы с MyAnimeList (Jikan), добавленные создателем; на сайте id = 10_000_000 + mal_id
CREATE TABLE IF NOT EXISTS public.catalog_site_anime (
  mal_id INTEGER PRIMARY KEY,
  jikan JSONB NOT NULL,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.catalog_site_anime ADD COLUMN IF NOT EXISTS title_ru TEXT;
ALTER TABLE public.catalog_site_anime ADD COLUMN IF NOT EXISTS description_ru TEXT;

-- События посещений (дашборд создателя): просмотры страниц, гости и залогиненные
CREATE TABLE IF NOT EXISTS public.site_visit_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  path TEXT NOT NULL,
  page_title TEXT,
  referrer TEXT,
  user_agent TEXT,
  event_kind TEXT NOT NULL DEFAULT 'pageview',
  event_label TEXT,
  meta JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CONSTRAINT site_visit_visitor_len CHECK (char_length(visitor_id) >= 8 AND char_length(visitor_id) <= 64),
  CONSTRAINT site_visit_path_len CHECK (char_length(path) <= 2048)
);

-- ============================================
-- 2. МИГРАЦИЯ СУЩЕСТВУЮЩИХ ТАБЛИЦ
--    Добавление колонок которых может не быть
--    Изменение типов/дефолтов
-- ============================================

-- profiles: добавить колонки если их нет
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_online TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW());
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'male';

-- minko_ai_state: убедиться что все поля на месте
ALTER TABLE public.minko_ai_state ADD COLUMN IF NOT EXISTS wrong_gender_count INTEGER DEFAULT 0;
ALTER TABLE public.minko_ai_state ADD COLUMN IF NOT EXISTS swear_count INTEGER DEFAULT 0;
ALTER TABLE public.minko_ai_state ADD COLUMN IF NOT EXISTS forgiven_count INTEGER DEFAULT 0;
ALTER TABLE public.minko_ai_state ADD COLUMN IF NOT EXISTS trial_messages INTEGER DEFAULT 0;

-- ai_subscriptions: миграция с 10 на 50 лимит и DATE → TIMESTAMP
ALTER TABLE public.ai_subscriptions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.ai_subscriptions ALTER COLUMN messages_limit SET DEFAULT 50;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'ai_subscriptions' AND column_name = 'last_reset_date' AND data_type = 'date'
  ) THEN
    ALTER TABLE public.ai_subscriptions ALTER COLUMN last_reset_date TYPE TIMESTAMP WITH TIME ZONE USING last_reset_date::TIMESTAMP WITH TIME ZONE;
    ALTER TABLE public.ai_subscriptions ALTER COLUMN last_reset_date SET DEFAULT NOW();
  END IF;
END $$;

-- Обновить старые записи с лимитом 10 на 50 (бесплатные пользователи)
UPDATE public.ai_subscriptions
SET messages_limit = 50
WHERE subscription_type = 'free' AND messages_limit < 50;

-- watch_together_sessions: все колонки
ALTER TABLE public.watch_together_sessions ADD COLUMN IF NOT EXISTS manga_id TEXT;
ALTER TABLE public.watch_together_sessions ADD COLUMN IF NOT EXISTS current_chapter INTEGER;
ALTER TABLE public.watch_together_sessions ADD COLUMN IF NOT EXISTS playback_time FLOAT DEFAULT 0;
ALTER TABLE public.watch_together_sessions ADD COLUMN IF NOT EXISTS video_source TEXT;
ALTER TABLE public.watch_together_sessions ADD COLUMN IF NOT EXISTS max_participants INTEGER DEFAULT 4;

-- watch_together_participants: has_vip
ALTER TABLE public.watch_together_participants ADD COLUMN IF NOT EXISTS has_vip BOOLEAN DEFAULT false;
-- «Смотреть вместе»: глобальная пауза + поколение синхронизации + пинги
ALTER TABLE public.watch_together_sessions ADD COLUMN IF NOT EXISTS sync_hold BOOLEAN DEFAULT false;
ALTER TABLE public.watch_together_sessions ADD COLUMN IF NOT EXISTS sync_hold_reason TEXT;
ALTER TABLE public.watch_together_sessions ADD COLUMN IF NOT EXISTS sync_generation INTEGER DEFAULT 0;
ALTER TABLE public.watch_together_sessions ADD COLUMN IF NOT EXISTS host_screen_broadcast BOOLEAN DEFAULT false;
ALTER TABLE public.watch_together_participants ADD COLUMN IF NOT EXISTS last_ping_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW());

UPDATE public.watch_together_participants
SET last_ping_at = COALESCE(last_ping_at, TIMEZONE('utc'::text, NOW()))
WHERE last_ping_at IS NULL;

-- profiles: текущая активность (что смотрит)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_activity JSONB;

-- ============================================
-- ЛИЧНЫЕ СООБЩЕНИЯ
-- ============================================