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
-- СОЦИАЛЬНАЯ ЛЕНТА (посты, лайки, комменты, фаны)
-- ============================================

CREATE TABLE IF NOT EXISTS public.posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  caption TEXT,
  cloudinary_public_id TEXT,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_posts_user ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON public.posts(created_at DESC);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "posts_select" ON public.posts;
DROP POLICY IF EXISTS "posts_insert" ON public.posts;
DROP POLICY IF EXISTS "posts_update" ON public.posts;
DROP POLICY IF EXISTS "posts_delete" ON public.posts;
CREATE POLICY "posts_select" ON public.posts FOR SELECT USING (true);
CREATE POLICY "posts_insert" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts_update" ON public.posts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts_delete" ON public.posts FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.post_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_post ON public.post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user ON public.post_likes(user_id);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_likes_select" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes_insert" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes_delete" ON public.post_likes;
CREATE POLICY "post_likes_select" ON public.post_likes FOR SELECT USING (true);
CREATE POLICY "post_likes_insert" ON public.post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "post_likes_delete" ON public.post_likes FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.post_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_post_comments_post ON public.post_comments(post_id);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_comments_select" ON public.post_comments;
DROP POLICY IF EXISTS "post_comments_insert" ON public.post_comments;
DROP POLICY IF EXISTS "post_comments_update" ON public.post_comments;
DROP POLICY IF EXISTS "post_comments_delete" ON public.post_comments;
CREATE POLICY "post_comments_select" ON public.post_comments FOR SELECT USING (true);
CREATE POLICY "post_comments_insert" ON public.post_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "post_comments_update" ON public.post_comments FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "post_comments_delete" ON public.post_comments FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.fans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  fan_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id, fan_id)
);

CREATE INDEX IF NOT EXISTS idx_fans_user ON public.fans(user_id);
CREATE INDEX IF NOT EXISTS idx_fans_fan ON public.fans(fan_id);

ALTER TABLE public.fans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fans_select" ON public.fans;
DROP POLICY IF EXISTS "fans_insert" ON public.fans;
DROP POLICY IF EXISTS "fans_delete" ON public.fans;
CREATE POLICY "fans_select" ON public.fans FOR SELECT USING (true);
CREATE POLICY "fans_insert" ON public.fans FOR INSERT WITH CHECK (auth.uid() = fan_id);
CREATE POLICY "fans_delete" ON public.fans FOR DELETE USING (auth.uid() = fan_id);

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
    'posts',
    'post_likes',
    'post_comments',
    'fans',
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