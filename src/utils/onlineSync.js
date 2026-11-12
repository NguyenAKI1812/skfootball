import Peer from 'peerjs';

class OnlineSyncManager {
  constructor() {
    this.peer = null;
    this.conn = null;
    this.roomCode = null;
    this.role = null; // 'host' (p1) or 'guest' (p2)
    this.onMessageCallback = null;
    this.onConnectionCallback = null;
    this.onDisconnectCallback = null;
    this.broadcastChannel = null;
  }

  initBroadcast() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.broadcastChannel = new BroadcastChannel('football-auction-sync');
      this.broadcastChannel.onmessage = (event) => {
        if (this.onMessageCallback) {
          this.onMessageCallback(event.data);
        }
      };
    }
  }

  // Create a Room (Host / Player 1)
  createRoom(roomCode, onConnect, onMessage, onDisconnect) {
    this.roomCode = roomCode.toUpperCase();
    this.role = 'host';
    this.onConnectionCallback = onConnect;
    this.onMessageCallback = onMessage;
    this.onDisconnectCallback = onDisconnect;
    this.initBroadcast();

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
      if (this.onConnectionCallback) {
        this.onConnectionCallback({ role: 'host', roomCode: this.roomCode });
      }
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
    this.initBroadcast();

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
      if (this.onConnectionCallback) {
        this.onConnectionCallback({ role: this.role, roomCode: this.roomCode });
      }
    });

    this.conn.on('data', (data) => {
      if (this.onMessageCallback) {
        this.onMessageCallback(data);
      }
    });

    this.conn.on('close', () => {
      console.log('Connection closed');
      if (this.onDisconnectCallback) {
        this.onDisconnectCallback();
      }
    });
  }

  // Send message to opponent
  send(message) {
    // 1. Send via WebRTC DataChannel if open
    if (this.conn && this.conn.open) {
      try {
        this.conn.send(message);
      } catch (e) {
        console.warn('Send WebRTC error:', e);
      }
    }

    // 2. Also send via BroadcastChannel for same-machine tabs
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(message);
      } catch (e) {
        console.warn('Send Broadcast error:', e);
      }
    }
  }

  disconnect() {
    if (this.conn) this.conn.close();
    if (this.peer) this.peer.destroy();
    if (this.broadcastChannel) this.broadcastChannel.close();
    this.conn = null;
    this.peer = null;
    this.roomCode = null;
    this.role = null;
  }
}

export const onlineSync = new OnlineSyncManager();
