
-- ============================================
-- 7. ТРИГГЕРЫ И ФУНКЦИИ
-- ============================================

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