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
-- Схема синхронизирована с фронтом: таблиц соцленты (posts, fans и т.д.) в проекте нет — в БД они не создаются и при прогоне удаляются.
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
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dm_sender ON public.direct_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_dm_receiver ON public.direct_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_dm_created ON public.direct_messages(created_at);

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dm_select" ON public.direct_messages;
DROP POLICY IF EXISTS "dm_insert" ON public.direct_messages;
DROP POLICY IF EXISTS "dm_update" ON public.direct_messages;
CREATE POLICY "dm_select" ON public.direct_messages FOR SELECT USING (
  auth.uid() = sender_id OR auth.uid() = receiver_id
);
CREATE POLICY "dm_insert" ON public.direct_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "dm_update" ON public.direct_messages FOR UPDATE USING (auth.uid() = receiver_id);

-- ============================================
-- АДМИНЫ И МОДЕРАЦИЯ ЧАТА (используются admin-panel.js, admin-panel-creator.js)
-- ============================================

CREATE TABLE IF NOT EXISTS public.admins (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.chat_mutes (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  muted_until TIMESTAMP WITH TIME ZONE NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_mutes_muted_until ON public.chat_mutes(muted_until);

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_mutes ENABLE ROW LEVEL SECURITY;

-- Политики admins / chat_mutes и site_visit_events ниже зависят от is_site_creator_user_id — см. блок перед ними.

-- global_chat_messages: reply_to и deleted_at
ALTER TABLE public.global_chat_messages ADD COLUMN IF NOT EXISTS reply_to UUID REFERENCES public.global_chat_messages(id) ON DELETE SET NULL;
ALTER TABLE public.global_chat_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- notifications: дополнительные поля
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

-- vip_subscriptions
ALTER TABLE public.vip_subscriptions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- friends
ALTER TABLE public.friends ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE;

-- profiles: модерация и админ-панель (раньше role дропали — возвращаем опциональные поля)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;

-- user_settings: дополнительные поля
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS auto_play_next_episode BOOLEAN DEFAULT false;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS show_recommendations BOOLEAN DEFAULT true;

-- ============================================
-- 3. УДАЛЕНИЕ ТАБЛИЦ КОТОРЫХ НЕТ В СХЕМЕ
-- ============================================

DO $$
DECLARE
  _tbl TEXT;
  _allowed TEXT[] := ARRAY[
    'profiles',
    'favorites_anime',
    'favorites_manga',
    'watch_history',
    'user_settings',
    'minko_ai_state',
    'ai_subscriptions',
    'vip_subscriptions',
    'watch_together_sessions',
    'watch_together_participants',
    'watch_together_chat',
    'watch_together_voice_signals',
    'friends',
    'global_chat_messages',
    'global_chat_likes',
    'notifications',
    'user_achievements',
    'custom_anime',
    'catalog_site_anime',
    'site_visit_events',
    'direct_messages',
    'admins',
    'chat_mutes',
    'site_maintenance_config'
  ];
BEGIN
  FOR _tbl IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename != ALL(_allowed)
  LOOP
    RAISE NOTICE 'Удаление лишней таблицы: public.%', _tbl;
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', _tbl);
  END LOOP;
END $$;

-- ============================================
-- 4. ИНДЕКСЫ (IF NOT EXISTS)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read);

CREATE INDEX IF NOT EXISTS idx_global_chat_messages_user_id ON public.global_chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_global_chat_messages_created_at ON public.global_chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_global_chat_messages_deleted ON public.global_chat_messages(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_global_chat_likes_message_id ON public.global_chat_likes(message_id);

CREATE INDEX IF NOT EXISTS idx_favorites_anime_user_id ON public.favorites_anime(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_manga_user_id ON public.favorites_manga(user_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_user_id ON public.watch_history(user_id);

CREATE INDEX IF NOT EXISTS idx_friends_user_id ON public.friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON public.friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_friends_status ON public.friends(status);

CREATE INDEX IF NOT EXISTS idx_profiles_last_online ON public.profiles(last_online DESC);
CREATE INDEX IF NOT EXISTS idx_wt_voice_sig_session_created ON public.watch_together_voice_signals(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_custom_anime_title ON public.custom_anime(title);
CREATE INDEX IF NOT EXISTS idx_site_visit_created ON public.site_visit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_visit_visitor ON public.site_visit_events(visitor_id);
CREATE INDEX IF NOT EXISTS idx_site_visit_user_created ON public.site_visit_events(user_id, created_at DESC) WHERE user_id IS NOT NULL;

-- ============================================
-- 5. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_anime ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_site_anime ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites_anime ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites_manga ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.minko_ai_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vip_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_together_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_together_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_together_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_together_voice_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_chat_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visit_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_mutes ENABLE ROW LEVEL SECURITY;

-- ЛС (повторное ENABLE безопасно — состояние «уже включено»)
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. RLS ПОЛИТИКИ (DROP IF EXISTS + CREATE)
-- ============================================

-- profiles
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- favorites_anime
DROP POLICY IF EXISTS "favorites_anime_all" ON public.favorites_anime;
DROP POLICY IF EXISTS "Пользователи могут управлять своим избранным аниме" ON public.favorites_anime;
CREATE POLICY "favorites_anime_all" ON public.favorites_anime FOR ALL USING (auth.uid() = user_id);

-- favorites_manga
DROP POLICY IF EXISTS "favorites_manga_all" ON public.favorites_manga;
DROP POLICY IF EXISTS "Пользователи могут управлять своим избранным мангой" ON public.favorites_manga;
CREATE POLICY "favorites_manga_all" ON public.favorites_manga FOR ALL USING (auth.uid() = user_id);

-- watch_history
DROP POLICY IF EXISTS "watch_history_all" ON public.watch_history;
DROP POLICY IF EXISTS "watch_history_select" ON public.watch_history;
DROP POLICY IF EXISTS "watch_history_insert" ON public.watch_history;
DROP POLICY IF EXISTS "watch_history_update" ON public.watch_history;
DROP POLICY IF EXISTS "watch_history_delete" ON public.watch_history;
CREATE POLICY "watch_history_select" ON public.watch_history FOR SELECT USING (true);
CREATE POLICY "watch_history_insert" ON public.watch_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "watch_history_update" ON public.watch_history FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "watch_history_delete" ON public.watch_history FOR DELETE USING (auth.uid() = user_id);

-- user_settings
DROP POLICY IF EXISTS "user_settings_all" ON public.user_settings;
CREATE POLICY "user_settings_all" ON public.user_settings FOR ALL USING (auth.uid() = user_id);

-- minko_ai_state
DROP POLICY IF EXISTS "minko_ai_state_all" ON public.minko_ai_state;
CREATE POLICY "minko_ai_state_all" ON public.minko_ai_state FOR ALL USING (auth.uid() = user_id);

-- ai_subscriptions
DROP POLICY IF EXISTS "ai_subscriptions_select" ON public.ai_subscriptions;
DROP POLICY IF EXISTS "ai_subscriptions_insert" ON public.ai_subscriptions;
DROP POLICY IF EXISTS "ai_subscriptions_update" ON public.ai_subscriptions;
DROP POLICY IF EXISTS "ai_subscriptions_site_creator_all" ON public.ai_subscriptions;
CREATE POLICY "ai_subscriptions_select" ON public.ai_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ai_subscriptions_insert" ON public.ai_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_subscriptions_update" ON public.ai_subscriptions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ai_subscriptions_site_creator_all" ON public.ai_subscriptions FOR ALL TO authenticated
  USING (lower(trim(coalesce(auth.jwt() ->> 'email', ''))) = 'creator@reminko.com')
  WITH CHECK (lower(trim(coalesce(auth.jwt() ->> 'email', ''))) = 'creator@reminko.com');

-- vip_subscriptions
DROP POLICY IF EXISTS "vip_subscriptions_select" ON public.vip_subscriptions;
DROP POLICY IF EXISTS "vip_subscriptions_insert" ON public.vip_subscriptions;
DROP POLICY IF EXISTS "vip_subscriptions_update" ON public.vip_subscriptions;
DROP POLICY IF EXISTS "vip_subscriptions_site_creator_all" ON public.vip_subscriptions;
CREATE POLICY "vip_subscriptions_select" ON public.vip_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "vip_subscriptions_insert" ON public.vip_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "vip_subscriptions_update" ON public.vip_subscriptions FOR UPDATE USING (auth.uid() = user_id);
-- Учётная запись создателя (email в JWT): выдача/снятие VIP «Вместе» любому user_id из панели
CREATE POLICY "vip_subscriptions_site_creator_all" ON public.vip_subscriptions FOR ALL TO authenticated
  USING (lower(trim(coalesce(auth.jwt() ->> 'email', ''))) = 'creator@reminko.com')
  WITH CHECK (lower(trim(coalesce(auth.jwt() ->> 'email', ''))) = 'creator@reminko.com');

-- watch_together_sessions
DROP POLICY IF EXISTS "wt_sessions_select" ON public.watch_together_sessions;
DROP POLICY IF EXISTS "wt_sessions_insert" ON public.watch_together_sessions;
DROP POLICY IF EXISTS "wt_sessions_update" ON public.watch_together_sessions;
CREATE POLICY "wt_sessions_select" ON public.watch_together_sessions FOR SELECT USING (true);
CREATE POLICY "wt_sessions_insert" ON public.watch_together_sessions FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "wt_sessions_update" ON public.watch_together_sessions FOR UPDATE USING (auth.uid() = host_id);

-- watch_together_participants
DROP POLICY IF EXISTS "wt_participants_select" ON public.watch_together_participants;
DROP POLICY IF EXISTS "wt_participants_insert" ON public.watch_together_participants;
DROP POLICY IF EXISTS "wt_participants_delete" ON public.watch_together_participants;
CREATE POLICY "wt_participants_select" ON public.watch_together_participants FOR SELECT USING (true);
CREATE POLICY "wt_participants_insert" ON public.watch_together_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wt_participants_delete" ON public.watch_together_participants FOR DELETE USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.watch_together_sessions s
    WHERE s.id = watch_together_participants.session_id
      AND s.host_id = auth.uid()
      AND watch_together_participants.user_id <> s.host_id
  )
);
DROP POLICY IF EXISTS "wt_participants_update_own" ON public.watch_together_participants;
CREATE POLICY "wt_participants_update_own" ON public.watch_together_participants FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- watch_together_chat (хост видит и пишет чат, даже если строка в participants утеряна у старых комнат)
DROP POLICY IF EXISTS "wt_chat_select" ON public.watch_together_chat;
DROP POLICY IF EXISTS "wt_chat_insert" ON public.watch_together_chat;
CREATE POLICY "wt_chat_select" ON public.watch_together_chat FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM watch_together_participants p
    WHERE p.session_id = watch_together_chat.session_id AND p.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM watch_together_sessions s
    WHERE s.id = watch_together_chat.session_id AND s.host_id = auth.uid()
  )
);
CREATE POLICY "wt_chat_insert" ON public.watch_together_chat FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND (
    EXISTS (
      SELECT 1 FROM watch_together_participants p
      WHERE p.session_id = watch_together_chat.session_id AND p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM watch_together_sessions s
      WHERE s.id = watch_together_chat.session_id AND s.host_id = auth.uid()
    )
  )
);

-- Голос Watch Together: видим только сигналы, адресованные нам или отправленные нами
DROP POLICY IF EXISTS "wt_voice_sig_select" ON public.watch_together_voice_signals;
DROP POLICY IF EXISTS "wt_voice_sig_insert" ON public.watch_together_voice_signals;
CREATE POLICY "wt_voice_sig_select" ON public.watch_together_voice_signals FOR SELECT USING (
  (
    EXISTS (
      SELECT 1 FROM watch_together_participants p
      WHERE p.session_id = watch_together_voice_signals.session_id AND p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM watch_together_sessions s
      WHERE s.id = watch_together_voice_signals.session_id AND s.host_id = auth.uid()
    )
  )
  AND (to_user_id = auth.uid() OR from_user_id = auth.uid())
);
CREATE POLICY "wt_voice_sig_insert" ON public.watch_together_voice_signals FOR INSERT WITH CHECK (
  auth.uid() = from_user_id
  AND (
    EXISTS (
      SELECT 1 FROM watch_together_participants p
      WHERE p.session_id = watch_together_voice_signals.session_id AND p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM watch_together_sessions s
      WHERE s.id = watch_together_voice_signals.session_id AND s.host_id = auth.uid()
    )
  )
  AND (
    EXISTS (
      SELECT 1 FROM watch_together_participants p
      WHERE p.session_id = watch_together_voice_signals.session_id AND p.user_id = watch_together_voice_signals.to_user_id
    )
    OR EXISTS (
      SELECT 1 FROM watch_together_sessions s
      WHERE s.id = watch_together_voice_signals.session_id AND s.host_id = watch_together_voice_signals.to_user_id
    )
  )
  AND (
    signal_type <> 'mod_mute'
    OR EXISTS (
      SELECT 1 FROM watch_together_sessions s
      WHERE s.id = watch_together_voice_signals.session_id AND s.host_id = auth.uid()
    )
  )
);

-- global_chat_messages
DROP POLICY IF EXISTS "chat_select" ON public.global_chat_messages;
DROP POLICY IF EXISTS "chat_insert" ON public.global_chat_messages;
DROP POLICY IF EXISTS "chat_update_own" ON public.global_chat_messages;
DROP POLICY IF EXISTS "chat_delete" ON public.global_chat_messages;
DROP POLICY IF EXISTS "chat_update_creator" ON public.global_chat_messages;
CREATE POLICY "chat_select" ON public.global_chat_messages FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "chat_insert" ON public.global_chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "chat_update_own" ON public.global_chat_messages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "chat_delete" ON public.global_chat_messages FOR DELETE USING (auth.uid() = user_id);

-- global_chat_likes
DROP POLICY IF EXISTS "chat_likes_select" ON public.global_chat_likes;
DROP POLICY IF EXISTS "chat_likes_insert" ON public.global_chat_likes;
DROP POLICY IF EXISTS "chat_likes_delete" ON public.global_chat_likes;
CREATE POLICY "chat_likes_select" ON public.global_chat_likes FOR SELECT USING (true);
CREATE POLICY "chat_likes_insert" ON public.global_chat_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "chat_likes_delete" ON public.global_chat_likes FOR DELETE USING (auth.uid() = user_id);

-- notifications
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "notifications_delete" ON public.notifications;
CREATE POLICY "notifications_delete" ON public.notifications FOR DELETE USING (auth.uid() = user_id);

-- friends
DROP POLICY IF EXISTS "friends_select" ON public.friends;
DROP POLICY IF EXISTS "friends_insert" ON public.friends;
DROP POLICY IF EXISTS "friends_update" ON public.friends;
DROP POLICY IF EXISTS "friends_delete" ON public.friends;
CREATE POLICY "friends_select" ON public.friends FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "friends_insert" ON public.friends FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "friends_update" ON public.friends FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "friends_delete" ON public.friends FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- custom_anime
DROP POLICY IF EXISTS "custom_anime_select" ON public.custom_anime;
CREATE POLICY "custom_anime_select" ON public.custom_anime FOR SELECT USING (true);

-- catalog_site_anime (читать всем; INSERT — гости added_by NULL или пользователи со своим uid; правки/удаление — создатель по email в JWT)
DROP POLICY IF EXISTS "catalog_site_anime_select" ON public.catalog_site_anime;
DROP POLICY IF EXISTS "catalog_site_anime_insert" ON public.catalog_site_anime;
DROP POLICY IF EXISTS "catalog_site_anime_update" ON public.catalog_site_anime;
DROP POLICY IF EXISTS "catalog_site_anime_delete" ON public.catalog_site_anime;
CREATE POLICY "catalog_site_anime_select" ON public.catalog_site_anime FOR SELECT USING (true);
DROP POLICY IF EXISTS "catalog_site_anime_insert_authenticated" ON public.catalog_site_anime;
DROP POLICY IF EXISTS "catalog_site_anime_insert_anon" ON public.catalog_site_anime;
CREATE POLICY "catalog_site_anime_insert_authenticated" ON public.catalog_site_anime FOR INSERT TO authenticated
  WITH CHECK (added_by IS NOT NULL AND auth.uid() = added_by);
CREATE POLICY "catalog_site_anime_insert_anon" ON public.catalog_site_anime FOR INSERT TO anon
  WITH CHECK (added_by IS NULL);
CREATE POLICY "catalog_site_anime_update" ON public.catalog_site_anime FOR UPDATE TO authenticated
  USING (lower(trim(coalesce(auth.jwt() ->> 'email', ''))) = 'creator@reminko.com')
  WITH CHECK (lower(trim(coalesce(auth.jwt() ->> 'email', ''))) = 'creator@reminko.com');
CREATE POLICY "catalog_site_anime_delete" ON public.catalog_site_anime FOR DELETE TO authenticated
  USING (lower(trim(coalesce(auth.jwt() ->> 'email', ''))) = 'creator@reminko.com');

-- user_achievements
DROP POLICY IF EXISTS "achievements_select_all" ON public.user_achievements;
DROP POLICY IF EXISTS "achievements_select_own" ON public.user_achievements;
CREATE POLICY "achievements_select_all" ON public.user_achievements FOR SELECT USING (true);

-- Функции для политик (должны существовать до CREATE POLICY, где они используются)
CREATE OR REPLACE FUNCTION public.get_user_email(user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  em text;
  caller_lower text;
BEGIN
  IF caller_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF caller_id = user_id THEN
    SELECT u.email::text INTO em FROM auth.users u WHERE u.id = user_id;
    RETURN em;
  END IF;
  SELECT lower(trim(coalesce(u.email::text, ''))) INTO caller_lower FROM auth.users u WHERE u.id = caller_id;
  IF caller_lower IS NOT NULL AND caller_lower = 'creator@reminko.com' THEN
    SELECT u.email::text INTO em FROM auth.users u WHERE u.id = user_id;
    RETURN em;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_email(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_email(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_email(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.is_site_creator_user_id(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = user_id
      AND lower(trim(coalesce(u.email::text, ''))) = 'creator@reminko.com'
  );
$$;

REVOKE ALL ON FUNCTION public.is_site_creator_user_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_site_creator_user_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_site_creator_user_id(uuid) TO service_role;

DROP VIEW IF EXISTS public.profiles_with_email;
CREATE VIEW public.profiles_with_email AS
SELECT p.*, public.get_user_email(p.id) AS email
FROM public.profiles p;

GRANT SELECT ON public.profiles_with_email TO anon;
GRANT SELECT ON public.profiles_with_email TO authenticated;

DROP POLICY IF EXISTS "admins_select" ON public.admins;
DROP POLICY IF EXISTS "admins_insert" ON public.admins;
DROP POLICY IF EXISTS "admins_update" ON public.admins;
DROP POLICY IF EXISTS "admins_delete" ON public.admins;
CREATE POLICY "admins_select" ON public.admins FOR SELECT USING (
  auth.uid() = user_id OR public.is_site_creator_user_id(auth.uid())
);
CREATE POLICY "admins_insert" ON public.admins FOR INSERT WITH CHECK (
  public.is_site_creator_user_id(auth.uid())
);
CREATE POLICY "admins_update" ON public.admins FOR UPDATE USING (
  public.is_site_creator_user_id(auth.uid())
) WITH CHECK (public.is_site_creator_user_id(auth.uid()));
CREATE POLICY "admins_delete" ON public.admins FOR DELETE USING (
  public.is_site_creator_user_id(auth.uid())
);

DROP POLICY IF EXISTS "chat_mutes_select" ON public.chat_mutes;
DROP POLICY IF EXISTS "chat_mutes_insert" ON public.chat_mutes;
DROP POLICY IF EXISTS "chat_mutes_update" ON public.chat_mutes;
DROP POLICY IF EXISTS "chat_mutes_delete" ON public.chat_mutes;
CREATE POLICY "chat_mutes_select" ON public.chat_mutes FOR SELECT USING (
  auth.uid() = user_id OR public.is_site_creator_user_id(auth.uid())
);
CREATE POLICY "chat_mutes_insert" ON public.chat_mutes FOR INSERT WITH CHECK (
  public.is_site_creator_user_id(auth.uid())
);
CREATE POLICY "chat_mutes_update" ON public.chat_mutes FOR UPDATE USING (
  public.is_site_creator_user_id(auth.uid())
) WITH CHECK (public.is_site_creator_user_id(auth.uid()));
CREATE POLICY "chat_mutes_delete" ON public.chat_mutes FOR DELETE USING (
  public.is_site_creator_user_id(auth.uid())
);

-- site_visit_events: запись с сайта (anon/auth); просмотр и удаление старых записей — только создатель
DROP POLICY IF EXISTS "site_visit_events_insert" ON public.site_visit_events;
DROP POLICY IF EXISTS "site_visit_events_select_creator" ON public.site_visit_events;
DROP POLICY IF EXISTS "site_visit_events_delete_creator" ON public.site_visit_events;
CREATE POLICY "site_visit_events_insert" ON public.site_visit_events
  FOR INSERT
  WITH CHECK (
    length(visitor_id) BETWEEN 8 AND 64
    AND length(path) BETWEEN 1 AND 2048
    AND (user_id IS NULL OR user_id = auth.uid())
  );
CREATE POLICY "site_visit_events_select_creator" ON public.site_visit_events
  FOR SELECT TO authenticated
  USING (public.is_site_creator_user_id(auth.uid()));
CREATE POLICY "site_visit_events_delete_creator" ON public.site_visit_events
  FOR DELETE TO authenticated
  USING (public.is_site_creator_user_id(auth.uid()));

GRANT SELECT, INSERT ON public.site_visit_events TO anon;
GRANT SELECT, INSERT ON public.site_visit_events TO authenticated;

-- ============================================
-- 7. ТРИГГЕРЫ И ФУНКЦИИ
-- ============================================

-- get_user_email / is_site_creator_user_id — выше (перед политиками site_visit и admins).

-- Сводка посещений для дашборда создателя (одна RPC вместо тяжёлых выборок с клиента)
CREATE OR REPLACE FUNCTION public.site_visit_creator_bundle(p_since timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  j jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_site_creator_user_id(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'summary', COALESCE((
      SELECT jsonb_build_object(
        'total_events', COUNT(*)::bigint,
        'pageviews', COUNT(*) FILTER (WHERE event_kind = 'pageview')::bigint,
        'unique_visitors', COUNT(DISTINCT visitor_id)::bigint,
        'unique_logged_accounts', COUNT(DISTINCT user_id)::bigint,
        'events_by_logged_in', COUNT(*) FILTER (WHERE user_id IS NOT NULL)::bigint
      )
      FROM public.site_visit_events
      WHERE created_at >= p_since
    ), '{"total_events":0,"pageviews":0,"unique_visitors":0,"unique_logged_accounts":0,"events_by_logged_in":0}'::jsonb),
    'top_paths', COALESCE((
      SELECT jsonb_agg(to_jsonb(t) ORDER BY t.cnt DESC)
      FROM (
        SELECT path, COUNT(*)::bigint AS cnt
        FROM public.site_visit_events
        WHERE created_at >= p_since AND event_kind = 'pageview' AND path IS NOT NULL AND path <> ''
        GROUP BY path
        ORDER BY cnt DESC
        LIMIT 30
      ) t
    ), '[]'::jsonb),
    'by_day', COALESCE((
      SELECT jsonb_agg(to_jsonb(t) ORDER BY t.day)
      FROM (
        SELECT (created_at AT TIME ZONE 'UTC')::date AS day, COUNT(*)::bigint AS cnt
        FROM public.site_visit_events
        WHERE created_at >= p_since
        GROUP BY 1
        ORDER BY 1
      ) t
    ), '[]'::jsonb)
  ) INTO j;

  RETURN j;
END;
$$;

REVOKE ALL ON FUNCTION public.site_visit_creator_bundle(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.site_visit_creator_bundle(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.site_visit_creator_bundle(timestamptz) TO service_role;

-- Глобальная пауза комнаты: любой участник (плеер/сеть); снимает только хост.
CREATE OR REPLACE FUNCTION public.wt_raise_sync_hold(p_session_id uuid, p_reason text DEFAULT 'issue')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Требуется вход';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.watch_together_participants wtp
    WHERE wtp.session_id = p_session_id AND wtp.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Вы не в этой комнате';
  END IF;

  UPDATE public.watch_together_sessions
  SET
    sync_hold = true,
    sync_hold_reason = LEFT(COALESCE(NULLIF(trim(p_reason), ''), 'issue'), 240),
    is_playing = false,
    updated_at = TIMEZONE('utc'::text, NOW())
  WHERE id = p_session_id
    AND is_active = true
    AND COALESCE(sync_hold, false) = false;
END;
$$;

REVOKE ALL ON FUNCTION public.wt_raise_sync_hold(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wt_raise_sync_hold(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wt_raise_sync_hold(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.wt_clear_sync_hold(
  p_session_id uuid,
  p_episode integer DEFAULT NULL,
  p_playback_sec double precision DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Требуется вход';
  END IF;

  UPDATE public.watch_together_sessions
  SET
    sync_hold = false,
    sync_hold_reason = NULL,
    sync_generation = COALESCE(sync_generation, 0) + 1,
    current_episode = CASE WHEN p_episode IS NOT NULL THEN p_episode ELSE current_episode END,
    playback_time = CASE WHEN p_playback_sec IS NOT NULL THEN p_playback_sec ELSE playback_time END,
    updated_at = TIMEZONE('utc'::text, NOW())
  WHERE id = p_session_id
    AND host_id = auth.uid()
    AND is_active = true;
END;
$$;

REVOKE ALL ON FUNCTION public.wt_clear_sync_hold(uuid, integer, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wt_clear_sync_hold(uuid, integer, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wt_clear_sync_hold(uuid, integer, double precision) TO service_role;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  profile_username TEXT;
  telegram_id_val TEXT;
BEGIN
  telegram_id_val := NEW.raw_user_meta_data->>'telegram_id';
  
  IF telegram_id_val IS NOT NULL THEN
    profile_username := COALESCE(
      NEW.raw_user_meta_data->>'telegram_username',
      NEW.raw_user_meta_data->>'first_name',
      'Пользователь_' || substring(telegram_id_val from 1 for 8)
    );
  ELSE
    profile_username := COALESCE(
      NEW.raw_user_meta_data->>'username', 
      split_part(NEW.email, '@', 1)
    );
  END IF;
  
  INSERT INTO public.profiles (id, username, avatar, gender, telegram_id)
  VALUES (
    NEW.id,
    profile_username,
    COALESCE(NEW.raw_user_meta_data->>'photo_url', NEW.raw_user_meta_data->>'avatar', 'Fons/1 b.jpg'),
    COALESCE(NEW.raw_user_meta_data->>'gender', 'male'),
    telegram_id_val
  )
  ON CONFLICT (id) DO UPDATE SET
    telegram_id = COALESCE(EXCLUDED.telegram_id, profiles.telegram_id),
    updated_at = TIMEZONE('utc'::text, NOW());
  
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.ai_subscriptions (user_id, subscription_type, messages_limit, messages_used, last_reset_date)
  VALUES (NEW.id, 'free', 50, 0, NOW()) ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE OR REPLACE FUNCTION reset_cooldown_messages()
RETURNS void AS $$
BEGIN
  UPDATE public.ai_subscriptions
  SET messages_used = 0, last_reset_date = NOW()
  WHERE subscription_type = 'free'
    AND messages_used >= 50
    AND last_reset_date < NOW() - INTERVAL '12 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION generate_session_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists_check INTEGER;
BEGIN
  LOOP
    code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
    SELECT COUNT(*) INTO exists_check FROM watch_together_sessions WHERE session_code = code;
    EXIT WHEN exists_check = 0;
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. REALTIME
-- ============================================

DO $$ 
BEGIN 
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.global_chat_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.global_chat_likes;
  EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    -- ЛС: без этого Realtime-подписка в direct-messages.js (postgres_changes INSERT) не получает события
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    -- «Смотреть вместе»: мгновенный эфир/пауза у гостей (watch-together.js postgres_changes UPDATE)
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.watch_together_sessions;
  EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    -- Опционально: мгновенный голосовой сигналинг (сейчас клиент опрашивает таблицу)
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.watch_together_voice_signals;
  EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;

-- ============================================
-- 8b. Режим «В разработке» (конфиг в site_maintenance_config ниже)
-- ============================================

CREATE TABLE IF NOT EXISTS public.site_maintenance_config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  maintenance_enabled boolean NOT NULL DEFAULT false,
  extra_allowed_routes text[] NOT NULL DEFAULT ARRAY[]::text[]
);

INSERT INTO public.site_maintenance_config (id, maintenance_enabled, extra_allowed_routes)
VALUES (1, false, ARRAY[]::text[])
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.site_maintenance_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_maintenance_select" ON public.site_maintenance_config;
DROP POLICY IF EXISTS "site_maintenance_update" ON public.site_maintenance_config;

CREATE POLICY "site_maintenance_select" ON public.site_maintenance_config FOR SELECT USING (true);

CREATE POLICY "site_maintenance_update" ON public.site_maintenance_config FOR UPDATE TO authenticated
  USING (public.is_site_creator_user_id(auth.uid()))
  WITH CHECK (public.is_site_creator_user_id(auth.uid()));

DROP POLICY IF EXISTS "site_maintenance_insert" ON public.site_maintenance_config;
CREATE POLICY "site_maintenance_insert" ON public.site_maintenance_config FOR INSERT TO authenticated
  WITH CHECK (public.is_site_creator_user_id(auth.uid()));

-- ============================================
-- 9. ОЧИСТКА УСТАРЕВШИХ ФУНКЦИЙ
-- ============================================

DROP FUNCTION IF EXISTS reset_daily_messages();

-- ============================================
-- ГОТОВО
-- ============================================

DO $$ 
BEGIN 
  RAISE NOTICE '✅ База данных Re-Minko готова! Таблицы обновлены, лишние удалены.';
END $$;
