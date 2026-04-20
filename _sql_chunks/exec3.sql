
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

-- Таблицы ленты и ЛС (повторное ENABLE безопасно — состояние «уже включено»)
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5b. ФУНКЦИИ ДЛЯ ПОЛИТИК RLS (до секции 6)
-- ============================================

-- Email пользователя: только сам пользователь или учётка создателя сайта (панель).
-- Остальным NULL — чтобы не перечислять чужие email через RPC.
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

-- Проверка «это UUID создателя сайта?» — без раскрытия email; доступна любому залогиненному (VIP Watch и т.д.).
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