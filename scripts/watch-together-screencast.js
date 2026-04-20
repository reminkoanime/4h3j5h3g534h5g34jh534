/**
 * WebRTC: трансляция экрана/вкладки ведущего гостям комнаты «Смотреть вместе».
 * Сигналинг — Supabase Realtime broadcast (отдельный канал на сессию).
 */
(function (global) {
    const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    const BROADCAST_EVENT = 'wt-screencast-signal';

    class WtScreencast {
        constructor(opts) {
            this.supabase = opts.supabase;
            this.sessionId = opts.sessionId;
            this.userId = opts.userId;
            this.isHost = opts.isHost;
            this.channel = null;
            this.subscribed = false;
            /** @type {MediaStream | null} */
            this.localStream = null;
            /** @type {Map<string, RTCPeerConnection>} */
            this.hostPeers = new Map();
            /** @type {Set<string>} */
            this._guestReadyQueue = new Set();
            /** @type {RTCPeerConnection | null} */
            this.guestPc = null;
            /** @type {RTCIceCandidate[]} */
            this._guestIcePending = [];
            /** @type {Map<string, RTCIceCandidate[]>} */
            this._hostIceFromGuest = new Map();
            /** @param {MediaStream} stream */
            this.onRemoteStream = null;
            this.onRemoteEnded = null;
            this._handleBroadcast = this._handleBroadcast.bind(this);
        }

        hasLocalStream() {
            return !!(this.localStream && this.localStream.getTracks().some((t) => t.readyState === 'live'));
        }

        _topic() {
            return `wt-screencast:${this.sessionId}`;
        }

        async ensureChannel() {
            if (this.channel && this.subscribed) return;
            const ch = this.supabase.channel(this._topic(), {
                config: { broadcast: { ack: false } }
            });
            ch.on('broadcast', { event: BROADCAST_EVENT }, (msg) => {
                const payload = msg && msg.payload;
                if (payload) void this._handleBroadcast(payload);
            });
            await new Promise((resolve, reject) => {
                const t = setTimeout(() => reject(new Error('Realtime: таймаут подписки')), 12000);
                ch.subscribe((status, err) => {
                    if (status === 'SUBSCRIBED') {
                        clearTimeout(t);
                        this.subscribed = true;
                        resolve(undefined);
                    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                        clearTimeout(t);
                        reject(err || new Error(String(status)));
                    }
                });
            });
            this.channel = ch;
        }

        async sendSignal(payload) {
            if (!this.channel || !this.subscribed) return;
            const { error } = await this.channel.send({
                type: 'broadcast',
                event: BROADCAST_EVENT,
                payload: { ...payload, from: this.userId }
            });
            if (error) console.warn('[WtScreencast] send', error);
        }

        async broadcastHostEnded() {
            try {
                await this.sendSignal({ type: 'screencast-ended' });
            } catch (_) {
                /* ignore */
            }
        }

        /**
         * Хост: захват экрана / вкладки.
         * preferCurrentTab — в Chrome быстрее выбрать текущую вкладку (всё равно будет диалог разрешения).
         */
        async startHostShare() {
            await this.ensureChannel();
            if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
                throw new Error('Браузер не поддерживает трансляцию экрана (нужен современный Chrome / Edge / Firefox)');
            }
            const constraints = {
                video: true,
                audio: true,
                preferCurrentTab: true,
                selfBrowserSurface: 'include'
            };
            let stream;
            try {
                stream = await navigator.mediaDevices.getDisplayMedia(constraints);
            } catch (e) {
                /* Firefox и др. — без расширенных флагов */
                stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            }
            const [vtrack] = stream.getVideoTracks();
            if (vtrack) {
                vtrack.onended = () => {
                    if (typeof this.onHostDisplayEnded === 'function') this.onHostDisplayEnded();
                };
            }
            this.localStream = stream;
            this._flushGuestReadyQueue();
        }

        _flushGuestReadyQueue() {
            if (!this.localStream) return;
            for (const gid of this._guestReadyQueue) {
                void this._hostHandleGuestReady(gid);
            }
            this._guestReadyQueue.clear();
        }

        stopHostShare() {
            if (this.localStream) {
                this.localStream.getTracks().forEach((t) => t.stop());
                this.localStream = null;
            }
            for (const pc of this.hostPeers.values()) {
                pc.close();
            }
            this.hostPeers.clear();
            this._guestReadyQueue.clear();
            this._hostIceFromGuest.clear();
        }

        leaveGuestReceiver() {
            this._guestIcePending = [];
            if (this.guestPc) {
                this.guestPc.close();
                this.guestPc = null;
            }
        }

        destroy() {
            this.stopHostShare();
            this.leaveGuestReceiver();
            if (this.channel && this.supabase) {
                this.supabase.removeChannel(this.channel);
            }
            this.channel = null;
            this.subscribed = false;
        }

        async enterGuestReceiver() {
            await this.ensureChannel();
            await this.sendSignal({ type: 'guest-ready' });
        }

        _flushHostIceForGuest(guestId) {
            const pc = this.hostPeers.get(guestId);
            const q = this._hostIceFromGuest.get(guestId);
            if (!pc || !q || !q.length) {
                this._hostIceFromGuest.delete(guestId);
                return;
            }
            for (const c of q) {
                pc.addIceCandidate(c).catch((e) => console.warn('[WtScreencast] flush host ICE', e));
            }
            this._hostIceFromGuest.delete(guestId);
        }

        /**
         * У каждого гостя — свой клон треков (один track в нескольких PC в части браузеров ломается).
         */
        _buildClonedStreamForPeer() {
            if (!this.localStream) return null;
            const out = new MediaStream();
            for (const t of this.localStream.getTracks()) {
                out.addTrack(t.clone());
            }
            return out;
        }

        /**
         * @param {Record<string, unknown>} payload
         */
        async _handleBroadcast(payload) {
            if (payload.from === this.userId) return;

            if (this.isHost) {
                if (payload.type === 'guest-ready' && typeof payload.from === 'string') {
                    await this._hostHandleGuestReady(payload.from);
                    return;
                }
                if (payload.type === 'answer' && payload.to === this.userId && typeof payload.from === 'string') {
                    const pc = this.hostPeers.get(payload.from);
                    const guestId = payload.from;
                    if (pc && payload.sdp) {
                        try {
                            await pc.setRemoteDescription(
                                new RTCSessionDescription(JSON.parse(String(payload.sdp)))
                            );
                            this._flushHostIceForGuest(guestId);
                        } catch (e) {
                            console.warn('[WtScreencast] setRemote answer', e);
                        }
                    }
                    return;
                }
                if (payload.type === 'ice-guest' && payload.to === this.userId && typeof payload.from === 'string') {
                    const pc = this.hostPeers.get(payload.from);
                    if (!pc || !payload.candidate) return;
                    const c = new RTCIceCandidate(JSON.parse(String(payload.candidate)));
                    if (!pc.remoteDescription) {
                        if (!this._hostIceFromGuest.has(payload.from)) this._hostIceFromGuest.set(payload.from, []);
                        this._hostIceFromGuest.get(payload.from).push(c);
                        return;
                    }
                    pc.addIceCandidate(c).catch((e) => console.warn('[WtScreencast] addIce guest→host', e));
                }
            } else {
                if (payload.type === 'offer' && payload.to === this.userId) {
                    await this._guestHandleOffer(payload);
                    return;
                }
                if (payload.type === 'ice-host' && payload.to === this.userId && payload.candidate) {
                    const c = new RTCIceCandidate(JSON.parse(String(payload.candidate)));
                    if (!this.guestPc) return;
                    if (!this.guestPc.remoteDescription) {
                        this._guestIcePending.push(c);
                        return;
                    }
                    this.guestPc.addIceCandidate(c).catch((e) => console.warn('[WtScreencast] addIce host→guest', e));
                    return;
                }
                if (payload.type === 'screencast-ended') {
                    this.leaveGuestReceiver();
                    if (typeof this.onRemoteEnded === 'function') this.onRemoteEnded();
                }
            }
        }

        /**
         * @param {string} guestId
         */
        async _hostHandleGuestReady(guestId) {
            if (!this.localStream) {
                this._guestReadyQueue.add(guestId);
                return;
            }
            const existing = this.hostPeers.get(guestId);
            if (existing) {
                existing.close();
                this.hostPeers.delete(guestId);
            }
            this._hostIceFromGuest.delete(guestId);

            const peerStream = this._buildClonedStreamForPeer();
            if (!peerStream || !peerStream.getTracks().length) return;

            const pc = new RTCPeerConnection(ICE);
            this.hostPeers.set(guestId, pc);
            for (const track of peerStream.getTracks()) {
                pc.addTrack(track, peerStream);
            }
            pc.onicecandidate = (e) => {
                if (e.candidate) {
                    void this.sendSignal({
                        type: 'ice-host',
                        to: guestId,
                        candidate: JSON.stringify(e.candidate.toJSON())
                    });
                }
            };
            pc.oniceconnectionstatechange = () => {
                if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
                    console.warn('[WtScreencast] host peer ice', pc.iceConnectionState, guestId);
                }
            };
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                await this.sendSignal({
                    type: 'offer',
                    to: guestId,
                    sdp: JSON.stringify(pc.localDescription)
                });
            } catch (e) {
                console.warn('[WtScreencast] host offer', e);
            }
        }

        /**
         * @param {Record<string, unknown>} payload
         */
        async _guestHandleOffer(payload) {
            this.leaveGuestReceiver();
            this._guestIcePending = [];
            const hostId = typeof payload.from === 'string' ? payload.from : '';
            if (!hostId || !payload.sdp) return;
            const pc = new RTCPeerConnection(ICE);
            this.guestPc = pc;
            pc.ontrack = (e) => {
                if (e.streams && e.streams[0] && typeof this.onRemoteStream === 'function') {
                    this.onRemoteStream(e.streams[0]);
                }
            };
            pc.onicecandidate = (e) => {
                if (e.candidate) {
                    void this.sendSignal({
                        type: 'ice-guest',
                        to: hostId,
                        candidate: JSON.stringify(e.candidate.toJSON())
                    });
                }
            };
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(String(payload.sdp))));
                for (const c of this._guestIcePending.splice(0)) {
                    await pc.addIceCandidate(c).catch((e) => console.warn('[WtScreencast] pending ICE guest', e));
                }
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                await this.sendSignal({
                    type: 'answer',
                    to: hostId,
                    sdp: JSON.stringify(pc.localDescription)
                });
            } catch (e) {
                console.warn('[WtScreencast] guest answer', e);
            }
        }
    }

    global.WtScreencast = WtScreencast;
})(typeof window !== 'undefined' ? window : globalThis);
