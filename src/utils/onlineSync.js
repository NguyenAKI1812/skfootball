import Peer from 'peerjs';
import { supabase, isSupabaseConfigured } from './supabaseClient';

class OnlineSyncManager {
  constructor() {
    this.peer = null;
    this.conn = null;
    this.supabaseChannel = null;
    this.roomCode = null;
    this.role = null; // 'host' (p1) or 'guest' (p2)
    this.onMessageCallback = null;
    this.onConnectionCallback = null;
    this.onDisconnectCallback = null;
    this.broadcastChannel = null;
    this.hasNotifiedConnect = false;
  }

  getTransportMode() {
    return isSupabaseConfigured ? 'supabase' : 'p2p';
  }

  initBroadcast() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      if (this.broadcastChannel) {
        this.broadcastChannel.close();
      }
      this.broadcastChannel = new BroadcastChannel('football-auction-sync');
      this.broadcastChannel.onmessage = (event) => {
        if (event.data && event.data._roomCode && event.data._roomCode !== this.roomCode) {
          return;
        }
        if (this.onMessageCallback) {
          this.onMessageCallback(event.data);
        }
      };
    }
  }

  _notifyConnected() {
    if (this.hasNotifiedConnect) return;
    this.hasNotifiedConnect = true;
    if (this.onConnectionCallback) {
      this.onConnectionCallback({ role: this.role, roomCode: this.roomCode });
    }
  }

  _setupSupabaseChannel() {
    if (!supabase || !this.roomCode) return;

    if (this.supabaseChannel) {
      supabase.removeChannel(this.supabaseChannel);
      this.supabaseChannel = null;
    }

    this.hasNotifiedConnect = false;
    const channelName = `room:${this.roomCode}`;

    this.supabaseChannel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
        presence: { key: this.role }
      }
    });

    this.supabaseChannel
      .on('broadcast', { event: 'room_event' }, ({ payload }) => {
        if (payload && payload._roomCode && payload._roomCode !== this.roomCode) {
          return;
        }
        // Fast handshake over Broadcast so joining doesn't stall on presence sync
        if (payload?.type === '_PEER_HELLO' && payload.role !== this.role) {
          this.send({ type: '_PEER_WELCOME', role: this.role });
          this._notifyConnected();
          return;
        }
        if (payload?.type === '_PEER_WELCOME' && payload.role !== this.role) {
          this._notifyConnected();
          return;
        }
        if (this.onMessageCallback) {
          this.onMessageCallback(payload);
        }
      })
      .on('presence', { event: 'sync' }, () => {
        if (!this.supabaseChannel) return;
        const state = this.supabaseChannel.presenceState();
        const hasHost = Boolean(state.host && state.host.length > 0);
        const hasGuest = Boolean(state.guest && state.guest.length > 0);

        // Both Host and Guest are present in the room
        if (hasHost && hasGuest) {
          this._notifyConnected();
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        // Opponent left the room
        if (key && key !== this.role && this.hasNotifiedConnect) {
          this.hasNotifiedConnect = false;
          if (this.onDisconnectCallback) {
            this.onDisconnectCallback();
          }
        }
      })
      .subscribe(async (status, err) => {
        if (status === 'SUBSCRIBED' && this.supabaseChannel) {
          await this.supabaseChannel.track({
            role: this.role,
            joinedAt: Date.now()
          });
          this.send({ type: '_PEER_HELLO', role: this.role });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('Supabase Realtime channel issue:', status, err);
        }
      });
  }

  // Create a Room (Host / Player 1)
  createRoom(roomCode, onConnect, onMessage, onDisconnect) {
    this.roomCode = roomCode.toUpperCase();
    this.role = 'host';
    this.onConnectionCallback = onConnect;
    this.onMessageCallback = onMessage;
    this.onDisconnectCallback = onDisconnect;
    this.hasNotifiedConnect = false;
    this.initBroadcast();

    if (isSupabaseConfigured && supabase) {
      this._setupSupabaseChannel();
      return;
    }

    const peerId = `foot-auc-${this.roomCode}-host`;

    if (this.peer) this.peer.destroy();

    this.peer = new Peer(peerId, {
      debug: 1
    });

    this.peer.on('open', (id) => {
      console.log('Room created with Peer ID:', id);
    });

    this.peer.on('connection', (connection) => {
      this.conn = connection;
      this.setupConnectionEvents();
      this._notifyConnected();
    });

    this.peer.on('error', (err) => {
      console.warn('PeerJS Host Error:', err);
    });
  }

  // Join a Room (Guest / Player 2)
  joinRoom(roomCode, onConnect, onMessage, onDisconnect) {
    this.roomCode = roomCode.toUpperCase();
    this.role = 'guest';
    this.onConnectionCallback = onConnect;
    this.onMessageCallback = onMessage;
    this.onDisconnectCallback = onDisconnect;
    this.hasNotifiedConnect = false;
    this.initBroadcast();

    if (isSupabaseConfigured && supabase) {
      this._setupSupabaseChannel();
      return;
    }

    const guestPeerId = `foot-auc-${this.roomCode}-guest-${Math.floor(Math.random() * 9999)}`;
    const hostPeerId = `foot-auc-${this.roomCode}-host`;

    if (this.peer) this.peer.destroy();

    this.peer = new Peer(guestPeerId, {
      debug: 1
    });

    this.peer.on('open', () => {
      this.conn = this.peer.connect(hostPeerId, { reliable: true });
      this.setupConnectionEvents();
    });

    this.peer.on('error', (err) => {
      console.warn('PeerJS Guest Error:', err);
    });
  }

  setupConnectionEvents() {
    if (!this.conn) return;

    this.conn.on('open', () => {
      console.log('Connected to remote peer!');
      this._notifyConnected();
    });

    this.conn.on('data', (data) => {
      if (this.onMessageCallback) {
        this.onMessageCallback(data);
      }
    });

    this.conn.on('close', () => {
      console.log('Connection closed');
      this.hasNotifiedConnect = false;
      if (this.onDisconnectCallback) {
        this.onDisconnectCallback();
      }
    });
  }

  // Send message to opponent
  send(message) {
    const payload = { ...message, _roomCode: this.roomCode };

    // 1. Send via Supabase Realtime Broadcast if active
    if (this.supabaseChannel) {
      this.supabaseChannel
        .send({
          type: 'broadcast',
          event: 'room_event',
          payload
        })
        .catch((e) => console.warn('Send Supabase Broadcast error:', e));
    }

    // 2. Send via WebRTC DataChannel if open (fallback P2P mode)
    if (this.conn && this.conn.open) {
      try {
        this.conn.send(payload);
      } catch (e) {
        console.warn('Send WebRTC error:', e);
      }
    }

    // 3. Also send via BroadcastChannel for same-machine tabs
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(payload);
      } catch (e) {
        console.warn('Send Broadcast error:', e);
      }
    }
  }

  disconnect() {
    if (this.supabaseChannel && supabase) {
      supabase.removeChannel(this.supabaseChannel);
      this.supabaseChannel = null;
    }
    if (this.conn) this.conn.close();
    if (this.peer) this.peer.destroy();
    if (this.broadcastChannel) this.broadcastChannel.close();
    this.conn = null;
    this.peer = null;
    this.broadcastChannel = null;
    this.roomCode = null;
    this.role = null;
    this.hasNotifiedConnect = false;
  }
}

export const onlineSync = new OnlineSyncManager();
