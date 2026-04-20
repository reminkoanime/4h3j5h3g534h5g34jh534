// Админ панель Создателя - полнофункциональная
class CreatorAdminPanel {
    constructor() {
        this.isCreator = false;
        this.currentUser = null;
        this.currentTab = 'dashboard';
    }

    // Панель только у учётной записи создателя сайта (email), без ролей в БД
    async checkCreatorStatus(userId) {
        if (!userId || !supabaseClient) return false;

        try {
            const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
            if (userError || !user) return false;
            const em = (user.email || '').toLowerCase();
            return (
                em ===
                (typeof SITE_CREATOR_EMAIL !== 'undefined' ? SITE_CREATOR_EMAIL : 'creator@reminko.com')
            );
        } catch (error) {
            console.error('Ошибка проверки создателя:', error);
            return false;
        }
    }

    async _getUserEmailById(userId) {
        if (!userId || !supabaseClient) return null;
        try {
            const { data, error } = await supabaseClient.rpc('get_user_email', { user_id: userId });
            if (error) return null;
            return data || null;
        } catch {
            return null;
        }
    }

    async _assertCallerIsSiteCreator() {
        const { data: { user } } = await supabaseClient.auth.getUser();
        const email = (user && user.email) || '';
        if (typeof isSiteCreatorEmail === 'function') {
            if (!isSiteCreatorEmail(email)) {
                return {
                    ok: false,
                    message: 'Управление услугами доступно только учётной записи создателя сайта.'
                };
            }
        } else if (email.toLowerCase() !== 'creator@reminko.com') {
            return { ok: false, message: 'Управление услугами доступно только создателю сайта.' };
        }
        return { ok: true, user };
    }

    async _assertTargetServicesManageable(userId) {
        const email = await this._getUserEmailById(userId);
        if (typeof isSiteCreatorEmail === 'function' && isSiteCreatorEmail(email)) {
            return {
                ok: false,
                message:
                    'У создателя сайта услуги «Смотреть вместе» и Minko AI включены навсегда. Запись в базе не нужна.'
            };
        }
        return { ok: true };
    }

    // Получить расширенную статистику
    async getAdvancedStats() {
        if (!supabaseClient) return null;

        try {
            // Пользователи
            const { count: usersCount } = await supabaseClient
                .from('profiles')
                .select('*', { count: 'exact', head: true });

            // Новые пользователи за сегодня
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const { count: newUsersToday } = await supabaseClient
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', today.toISOString());

            // Активные пользователи (за последние 7 дней)
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            const { data: activeUsersData } = await supabaseClient
                .from('watch_together_sessions')
                .select('host_id')
                .gte('created_at', weekAgo.toISOString());
            const activeUsers = activeUsersData
                ? new Set((activeUsersData || []).map((u) => u.host_id).filter(Boolean)).size
                : 0;

            // Сообщения в чате
            const { count: chatMessagesCount } = await supabaseClient
                .from('global_chat_messages')
                .select('*', { count: 'exact', head: true })
                .is('deleted_at', null);

            // Сообщения за сегодня
            const { count: chatMessagesToday } = await supabaseClient
                .from('global_chat_messages')
                .select('*', { count: 'exact', head: true })
                .is('deleted_at', null)
                .gte('created_at', today.toISOString());

            // VIP подписки
            const { count: vipCount } = await supabaseClient
                .from('vip_subscriptions')
                .select('*', { count: 'exact', head: true })
                .eq('is_active', true);

            // Подписки ИИ
            const { data: aiSubs } = await supabaseClient
                .from('ai_subscriptions')
                .select('subscription_type')
                .neq('subscription_type', 'free');
            const premiumAICount = aiSubs ? aiSubs.length : 0;

            // Бан-лист
            const { count: bannedCount } = await supabaseClient
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('is_banned', true);

            return {
                users: usersCount || 0,
                newUsersToday: newUsersToday || 0,
                activeUsers: activeUsers,
                chatMessages: chatMessagesCount || 0,
                chatMessagesToday: chatMessagesToday || 0,
                vipSubscriptions: vipCount || 0,
                premiumAISubscriptions: premiumAICount,
                bannedUsers: bannedCount || 0
            };
        } catch (error) {
            console.error('Ошибка получения статистики:', error);
            return null;
        }
    }

    /**
     * Сводная лента для дашборда: чат и новые профили (последние по времени).
     * @returns {Promise<Array<{ type: string, at: string, title: string, body: string }>>}
     */
    async getRecentDashboardActivity(limit = 12) {
        if (!supabaseClient) return [];

        const esc = (t) =>
            String(t ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');

        try {
            const [chatRes, profilesRes] = await Promise.all([
                supabaseClient
                    .from('global_chat_messages')
                    .select('message, created_at, user_id')
                    .is('deleted_at', null)
                    .order('created_at', { ascending: false })
                    .limit(8),
                supabaseClient
                    .from('profiles')
                    .select('username, created_at')
                    .order('created_at', { ascending: false })
                    .limit(8)
            ]);

            const chatRows = chatRes.data || [];
            const chatUserIds = [...new Set(chatRows.map((r) => r.user_id).filter(Boolean))];
            let chatNameById = new Map();
            if (chatUserIds.length) {
                const { data: chatProfiles } = await supabaseClient
                    .from('profiles')
                    .select('id, username')
                    .in('id', chatUserIds);
                chatNameById = new Map((chatProfiles || []).map((p) => [p.id, p.username]));
            }

            const items = [];

            chatRows.forEach((r) => {
                const name = chatNameById.get(r.user_id) || 'Пользователь';
                const msg = (r.message || '').trim();
                items.push({
                    type: 'chat',
                    at: r.created_at,
                    title: `💬 ${esc(name)}`,
                    body: esc(msg.length > 140 ? `${msg.slice(0, 140)}…` : msg)
                });
            });

            (profilesRes.data || []).forEach((r) => {
                const name = r.username || 'Без ника';
                items.push({
                    type: 'join',
                    at: r.created_at,
                    title: '👤 Новый пользователь',
                    body: esc(name)
                });
            });

            items.sort((a, b) => new Date(b.at) - new Date(a.at));
            return items.slice(0, limit);
        } catch (e) {
            console.warn('getRecentDashboardActivity:', e);
            return [];
        }
    }

    // Получить список пользователей с фильтрами
    async getUsersAdvanced(page = 1, limit = 50, filters = {}) {
        if (!supabaseClient) return { users: [], total: 0 };

        try {
            let query = supabaseClient
                .from('profiles')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false });

            // Фильтр по банам
            if (filters.banned !== undefined) {
                query = query.eq('is_banned', filters.banned);
            }

            // Поиск
            if (filters.search) {
                query = query.ilike('username', `%${filters.search}%`);
            }

            if (filters.excludeUserId) {
                query = query.neq('id', filters.excludeUserId);
            }

            query = query.range((page - 1) * limit, page * limit - 1);

            const { data, error, count } = await query;

            if (error) {
                console.error('Ошибка получения пользователей:', error);
                return { users: [], total: 0 };
            }

            // Получаем email и дополнительную информацию для каждого пользователя
            const usersWithDetails = await Promise.all((data || []).map(async (user) => {
                try {
                    // Email через RPC
                    const { data: emailData } = await supabaseClient
                        .rpc('get_user_email', { user_id: user.id });
                    
                    // VIP подписка
                    const { data: vip } = await supabaseClient
                        .from('vip_subscriptions')
                        .select('*')
                        .eq('user_id', user.id)
                        .eq('is_active', true)
                        .maybeSingle();

                    // Подписка ИИ
                    const { data: aiSub } = await supabaseClient
                        .from('ai_subscriptions')
                        .select('subscription_type, expires_at')
                        .eq('user_id', user.id)
                        .maybeSingle();

                    // Статистика активности
                    const { count: chatMessages } = await supabaseClient
                        .from('global_chat_messages')
                        .select('*', { count: 'exact', head: true })
                        .eq('user_id', user.id)
                        .is('deleted_at', null);

                    const emailStr = emailData || '';
                    const isCreatorAcc =
                        typeof isSiteCreatorEmail === 'function'
                            ? isSiteCreatorEmail(emailStr)
                            : emailStr.toLowerCase() === 'creator@reminko.com';

                    return {
                        ...user,
                        email: emailData || 'Не указан',
                        is_site_creator_account: isCreatorAcc,
                        vip: isCreatorAcc
                            ? { is_active: true, expires_at: null, permanent: true }
                            : vip
                              ? {
                                    is_active: true,
                                    expires_at: vip.expires_at
                                }
                              : null,
                        ai_subscription: isCreatorAcc
                            ? { type: 'unlimited', expires_at: null, permanent: true }
                            : aiSub
                              ? {
                                    type: aiSub.subscription_type,
                                    expires_at: aiSub.expires_at
                                }
                              : { type: 'free' },
                        activity: {
                            chat_messages: chatMessages || 0
                        }
                    };
                } catch (err) {
                    console.error('Ошибка получения деталей пользователя:', err);
                    return { ...user, email: 'Не указан', vip: null, ai_subscription: { type: 'free' }, activity: { chat_messages: 0 } };
                }
            }));

            return { users: usersWithDetails, total: count || 0 };
        } catch (error) {
            console.error('Ошибка получения пользователей:', error);
            return { users: [], total: 0 };
        }
    }

    // Назначение ролей отключено: панель только у создателя по email
    async updateUserRole() {
        return {
            success: false,
            message:
                'Назначение ролей отключено. Доступ к панели есть только у учётной записи создателя сайта.'
        };
    }

    // Забанить/разбанить пользователя
    async toggleUserBan(userId, ban = true, reason = '') {
        if (!supabaseClient) return { success: false, message: 'Нет подключения' };

        try {
            const { error } = await supabaseClient
                .from('profiles')
                .update({ 
                    is_banned: ban,
                    ban_reason: reason || null,
                    banned_at: ban ? new Date().toISOString() : null
                })
                .eq('id', userId);

            if (error) {
                console.error('Ошибка изменения статуса бана:', error);
                return { success: false, message: 'Ошибка изменения статуса' };
            }

            return { success: true, message: ban ? 'Пользователь забанен' : 'Пользователь разбанен' };
        } catch (error) {
            console.error('Ошибка изменения статуса бана:', error);
            return { success: false, message: 'Ошибка изменения статуса' };
        }
    }

    // Получить сообщения чата с фильтрами
    async getChatMessages(filters = {}) {
        if (!supabaseClient) return [];

        try {
            // Сначала получаем сообщения
            let query = supabaseClient
                .from('global_chat_messages')
                .select('*')
                .is('deleted_at', null)
                .order('created_at', { ascending: false })
                .limit(filters.limit || 100);

            if (filters.userId) {
                query = query.eq('user_id', filters.userId);
            }

            if (filters.search) {
                query = query.ilike('message', `%${filters.search}%`);
            }

            if (filters.fromDate) {
                query = query.gte('created_at', filters.fromDate);
            }

            if (filters.toDate) {
                query = query.lte('created_at', filters.toDate);
            }

            const { data: messages, error } = await query;

            if (error) {
                console.error('Ошибка получения сообщений:', error);
                return [];
            }

            if (!messages || messages.length === 0) {
                return [];
            }

            // Получаем профили пользователей отдельно
            const userIds = [...new Set(messages.map(msg => msg.user_id))];
            const { data: profiles } = await supabaseClient
                .from('profiles')
                .select('id, username, avatar')
                .in('id', userIds);

            // Создаем мапу профилей
            const profilesMap = {};
            if (profiles) {
                profiles.forEach(profile => {
                    profilesMap[profile.id] = profile;
                });
            }

            // Объединяем данные
            return messages.map(msg => ({
                ...msg,
                user: profilesMap[msg.user_id] || { id: msg.user_id, username: 'Пользователь', avatar: null }
            }));
        } catch (error) {
            console.error('Ошибка получения сообщений:', error);
            return [];
        }
    }

    // Удалить сообщение чата
    async deleteChatMessage(messageId, reason = '') {
        if (!supabaseClient) return { success: false };

        try {
            const { error } = await supabaseClient
                .from('global_chat_messages')
                .update({
                    deleted_at: new Date().toISOString(),
                    deleted_reason: reason || 'Удалено администратором'
                })
                .eq('id', messageId);

            if (error) {
                console.error('Ошибка удаления сообщения:', error);
                return { success: false, message: 'Ошибка удаления' };
            }

            return { success: true, message: 'Сообщение удалено' };
        } catch (error) {
            console.error('Ошибка удаления сообщения:', error);
            return { success: false, message: 'Ошибка удаления' };
        }
    }

    // Мут пользователя в чате
    async muteUserChat(userId, hours, reason = '') {
        if (!supabaseClient) return { success: false };

        try {
            const mutedUntil = new Date();
            mutedUntil.setHours(mutedUntil.getHours() + hours);

            const { error } = await supabaseClient
                .from('chat_mutes')
                .upsert({
                    user_id: userId,
                    muted_until: mutedUntil.toISOString(),
                    reason: reason || 'Мут от администратора',
                    created_by: this.currentUser.id
                }, {
                    onConflict: 'user_id'
                });

            if (error) {
                console.error('Ошибка мута пользователя:', error);
                return { success: false, message: 'Ошибка мута' };
            }

            return { success: true, message: `Пользователь замьючен до ${mutedUntil.toLocaleString('ru-RU')}` };
        } catch (error) {
            console.error('Ошибка мута пользователя:', error);
            return { success: false, message: 'Ошибка мута' };
        }
    }

    // Управление VIP подпиской (только создатель сайта; не целевой аккаунт создателя)
    async manageVIPSubscription(userId, action, days = null) {
        if (!supabaseClient) return { success: false };

        try {
            const gate = await this._assertCallerIsSiteCreator();
            if (!gate.ok) return { success: false, message: gate.message };

            const targ = await this._assertTargetServicesManageable(userId);
            if (!targ.ok) return { success: false, message: targ.message };

            if (action === 'grant' && days) {
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + days);

                const { error } = await supabaseClient
                    .from('vip_subscriptions')
                    .upsert({
                        user_id: userId,
                        is_active: true,
                        expires_at: expiresAt.toISOString()
                    }, {
                        onConflict: 'user_id'
                    });

                if (error) {
                    console.error('Ошибка выдачи VIP:', error);
                    return {
                        success: false,
                        message:
                            error.message ||
                            error.details ||
                            'Ошибка выдачи VIP. Проверьте SQL: политика vip_subscriptions_site_creator_all.'
                    };
                }

                return { success: true, message: `VIP выдан до ${expiresAt.toLocaleDateString('ru-RU')}` };
            } else if (action === 'revoke') {
                const { data: updated, error } = await supabaseClient
                    .from('vip_subscriptions')
                    .update({ is_active: false })
                    .eq('user_id', userId)
                    .select('user_id');

                if (error) {
                    console.error('Ошибка отзыва VIP:', error);
                    return {
                        success: false,
                        message: error.message || error.details || 'Ошибка отзыва VIP'
                    };
                }
                if (!updated || updated.length === 0) {
                    return { success: true, message: 'VIP не был активен (запись не найдена)' };
                }

                return { success: true, message: 'VIP «Смотреть вместе» снят' };
            }

            return { success: false, message: 'Неверное действие' };
        } catch (error) {
            console.error('Ошибка управления VIP:', error);
            return { success: false, message: 'Ошибка управления VIP' };
        }
    }

    // Управление подпиской ИИ (только создатель сайта)
    async manageAISubscription(userId, subscriptionType, days = null) {
        if (!supabaseClient) return { success: false };

        try {
            const gate = await this._assertCallerIsSiteCreator();
            if (!gate.ok) return { success: false, message: gate.message };

            const targ = await this._assertTargetServicesManageable(userId);
            if (!targ.ok) return { success: false, message: targ.message };

            let expiresAt = null;
            if (subscriptionType === 'free') {
                expiresAt = null;
            } else if (days) {
                expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + days);
            }

            if (typeof aiSubscriptionService !== 'undefined') {
                const result = await aiSubscriptionService.updateSubscriptionType(
                    userId, 
                    subscriptionType, 
                    expiresAt ? expiresAt.toISOString() : null
                );
                return {
                    success: result,
                    message: result
                        ? subscriptionType === 'free'
                            ? 'Minko AI: переведён на Free'
                            : 'Тариф Minko AI обновлён'
                        : 'Ошибка обновления подписки ИИ. Проверьте политику ai_subscriptions_site_creator_all в SQL.'
                };
            }

            const { error } = await supabaseClient
                .from('ai_subscriptions')
                .upsert({
                    user_id: userId,
                    subscription_type: subscriptionType,
                    expires_at: expiresAt ? expiresAt.toISOString() : null
                }, {
                    onConflict: 'user_id'
                });

            if (error) {
                console.error('Ошибка обновления подписки ИИ:', error);
                return {
                    success: false,
                    message: error.message || error.details || 'Ошибка обновления подписки ИИ'
                };
            }

            return {
                success: true,
                message:
                    subscriptionType === 'free'
                        ? 'Minko AI: переведён на Free'
                        : 'Тариф Minko AI обновлён'
            };
        } catch (error) {
            console.error('Ошибка обновления подписки ИИ:', error);
            return { success: false, message: 'Ошибка обновления подписки' };
        }
    }

    // Получить популярный контент
    async getPopularContent(type = 'anime', limit = 10) {
        // Это будет работать с локальной базой данных
        // В будущем можно интегрировать с Supabase, если есть таблица просмотров
        return [];
    }

    // Отправить уведомление пользователю
    async sendNotificationToUser(userId, title, message, type = 'system', link = null) {
        if (!supabaseClient) return { success: false };

        try {
            const { error } = await supabaseClient
                .from('notifications')
                .insert({
                    user_id: userId,
                    type: type,
                    title: title,
                    message: message,
                    link: link
                });

            if (error) {
                console.error('Ошибка отправки уведомления:', error);
                return { success: false, message: 'Ошибка отправки уведомления' };
            }

            return { success: true, message: 'Уведомление отправлено' };
        } catch (error) {
            console.error('Ошибка отправки уведомления:', error);
            return { success: false, message: 'Ошибка отправки уведомления' };
        }
    }

    // Массовая отправка уведомлений
    async sendBulkNotifications(userIds, title, message, type = 'system', link = null) {
        if (!supabaseClient || !userIds || userIds.length === 0) return { success: false };

        try {
            const notifications = userIds.map(userId => ({
                user_id: userId,
                type: type,
                title: title,
                message: message,
                link: link
            }));

            const { error } = await supabaseClient
                .from('notifications')
                .insert(notifications);

            if (error) {
                console.error('Ошибка массовой отправки уведомлений:', error);
                return { success: false, message: 'Ошибка отправки уведомлений' };
            }

            return { success: true, message: `Уведомления отправлены ${userIds.length} пользователям` };
        } catch (error) {
            console.error('Ошибка массовой отправки уведомлений:', error);
            return { success: false, message: 'Ошибка отправки уведомлений' };
        }
    }

    // Получить активность пользователя
    async getUserActivity(userId, days = 7) {
        if (!supabaseClient) return null;

        try {
            const dateFrom = new Date();
            dateFrom.setDate(dateFrom.getDate() - days);

            // Сообщения в чате
            const { count: chatMessages } = await supabaseClient
                .from('global_chat_messages')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .is('deleted_at', null)
                .gte('created_at', dateFrom.toISOString());

            return {
                chat_messages: chatMessages || 0,
                total: chatMessages || 0
            };
        } catch (error) {
            console.error('Ошибка получения активности:', error);
            return null;
        }
    }

    /** Записи глобального каталога (Jikan / MyAnimeList), id на сайте = 10_000_000 + mal_id */
    async listCatalogSiteAnime() {
        if (!supabaseClient) return { success: false, message: 'Supabase не инициализирован', rows: [] };
        try {
            const { data, error } = await supabaseClient
                .from('catalog_site_anime')
                .select('mal_id, created_at, jikan, title_ru, description_ru')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return { success: true, rows: data || [] };
        } catch (e) {
            console.error('[CreatorAdmin] listCatalogSiteAnime', e);
            return {
                success: false,
                message: e.message || 'Ошибка загрузки catalog_site_anime',
                rows: []
            };
        }
    }

    async upsertCatalogSiteAnime(jikanFull, options = {}) {
        if (!supabaseClient) return { success: false, message: 'Нет клиента Supabase' };
        const a = await this._assertCallerIsSiteCreator();
        if (!a.ok) return { success: false, message: a.message };
        const mal = jikanFull && jikanFull.mal_id;
        if (!mal) return { success: false, message: 'В ответе Jikan нет mal_id' };
        const tr =
            options.title_ru != null && String(options.title_ru).trim()
                ? String(options.title_ru).trim()
                : null;
        const dr =
            options.description_ru != null && String(options.description_ru).trim()
                ? String(options.description_ru).trim()
                : null;
        try {
            const { error } = await supabaseClient.from('catalog_site_anime').upsert(
                {
                    mal_id: mal,
                    jikan: jikanFull,
                    added_by: a.user.id,
                    title_ru: tr,
                    description_ru: dr
                },
                { onConflict: 'mal_id' }
            );
            if (error) throw error;
            return { success: true, message: 'Аниме добавлено в каталог на сайте' };
        } catch (e) {
            console.error('[CreatorAdmin] upsertCatalogSiteAnime', e);
            return { success: false, message: e.message || 'Ошибка записи в Supabase' };
        }
    }

    async deleteCatalogSiteAnime(malId) {
        if (!supabaseClient) return { success: false, message: 'Нет клиента' };
        const a = await this._assertCallerIsSiteCreator();
        if (!a.ok) return { success: false, message: a.message };
        const mid = parseInt(malId, 10);
        if (!mid || Number.isNaN(mid)) return { success: false, message: 'Некорректный mal_id' };
        try {
            const { error } = await supabaseClient.from('catalog_site_anime').delete().eq('mal_id', mid);
            if (error) throw error;
            return { success: true, message: 'Удалено из каталога сайта' };
        } catch (e) {
            console.error('[CreatorAdmin] deleteCatalogSiteAnime', e);
            return { success: false, message: e.message || 'Ошибка удаления' };
        }
    }

    /**
     * Посещения сайта: сводка (RPC) + последние события. Только учётка создателя.
     * @param {number} days 1…90
     */
    async getSiteVisitAnalytics(days = 7) {
        if (!supabaseClient) return { bundle: null, recent: [], error: 'Supabase не инициализирован' };
        const a = await this._assertCallerIsSiteCreator();
        if (!a.ok) return { bundle: null, recent: [], error: a.message };
        const d = Math.min(90, Math.max(1, parseInt(days, 10) || 7));
        const since = new Date();
        since.setDate(since.getDate() - d);
        since.setHours(0, 0, 0, 0);
        const sinceIso = since.toISOString();
        try {
            const { data: bundle, error: e1 } = await supabaseClient.rpc('site_visit_creator_bundle', {
                p_since: sinceIso
            });
            if (e1) throw e1;
            const { data: recent, error: e2 } = await supabaseClient
                .from('site_visit_events')
                .select(
                    'id, created_at, path, page_title, referrer, user_agent, visitor_id, user_id, event_kind, event_label, meta'
                )
                .gte('created_at', sinceIso)
                .order('created_at', { ascending: false })
                .limit(120);
            if (e2) throw e2;
            return { bundle: bundle || null, recent: recent || [], since: sinceIso, days: d };
        } catch (e) {
            console.error('[CreatorAdmin] getSiteVisitAnalytics', e);
            return {
                bundle: null,
                recent: [],
                error:
                    e.message ||
                    'Не удалось загрузить аналитику. Выполните миграцию: site_visit_events и site_visit_creator_bundle в database.sql'
            };
        }
    }
}

// Глобальный экземпляр
window.creatorAdminPanel = new CreatorAdminPanel();
