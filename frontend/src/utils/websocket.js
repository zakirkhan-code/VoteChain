// frontend/src/utils/websocket.js
class WebSocketManager {
  constructor() {
    this.ws = null;
    this.url = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 1000; // Start with 1 second
    this.isReconnecting = false;
    this.eventListeners = new Map();
    this.connectionState = 'disconnected';
    this.heartbeatInterval = null;
    this.lastHeartbeat = null;
    this.messageQueue = [];
    this.isAuthenticated = false;
    this.userRole = null;
    this.subscriptions = new Set();
  }

  // ✅ CONNECT TO WEBSOCKET
  connect(url, token = null) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return Promise.resolve();
    }

    this.url = url;
    
    return new Promise((resolve, reject) => {
      try {
        console.log('🔄 Connecting to WebSocket...', url);
        this.ws = new WebSocket(url);
        this.connectionState = 'connecting';

        // Connection opened
        this.ws.onopen = () => {
          console.log('🟢 WebSocket connected');
          this.connectionState = 'connected';
          this.reconnectAttempts = 0;
          this.isReconnecting = false;
          
          // Authenticate if token provided
          if (token) {
            this.authenticate(token);
          }
          
          // Start heartbeat
          this.startHeartbeat();
          
          // Process queued messages
          this.processMessageQueue();
          
          // Emit connection event
          this.emit('connected');
          
          resolve();
        };

        // Message received
        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        // Connection closed
        this.ws.onclose = (event) => {
          console.log('🔴 WebSocket disconnected', { code: event.code, reason: event.reason });
          this.connectionState = 'disconnected';
          this.isAuthenticated = false;
          this.stopHeartbeat();
          
          // Emit disconnection event
          this.emit('disconnected', { code: event.code, reason: event.reason });
          
          // Auto-reconnect if not manual close
          if (event.code !== 1000 && !this.isReconnecting) {
            this.attemptReconnect();
          }
        };

        // Connection error
        this.ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          this.connectionState = 'error';
          this.emit('error', error);
          reject(error);
        };

      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        this.connectionState = 'error';
        reject(error);
      }
    });
  }

  // ✅ AUTHENTICATE USER
  authenticate(token) {
    if (!this.isConnected()) {
      console.warn('WebSocket not connected. Queuing authentication.');
      this.queueMessage({ type: 'authenticate', token });
      return;
    }

    this.send({
      type: 'authenticate',
      token: token
    });
  }

  // ✅ SUBSCRIBE TO CHANNEL
  subscribe(channel) {
    if (!this.isConnected()) {
      console.warn(`WebSocket not connected. Queuing subscription to ${channel}.`);
      this.queueMessage({ type: 'subscribe', channel });
      return;
    }

    this.subscriptions.add(channel);
    this.send({
      type: 'subscribe',
      channel: channel
    });
  }

  // ✅ UNSUBSCRIBE FROM CHANNEL
  unsubscribe(channel) {
    if (!this.isConnected()) {
      return;
    }

    this.subscriptions.delete(channel);
    this.send({
      type: 'unsubscribe',
      channel: channel
    });
  }

  // ✅ SEND MESSAGE
  send(message) {
    if (!this.isConnected()) {
      console.warn('WebSocket not connected. Queuing message.', message);
      this.queueMessage(message);
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
      this.queueMessage(message);
      return false;
    }
  }

  // ✅ HANDLE INCOMING MESSAGES
  handleMessage(data) {
    console.log('📡 WebSocket message received:', data);

    // Update last heartbeat
    this.lastHeartbeat = Date.now();

    // Handle specific message types
    switch (data.type) {
      case 'welcome':
        console.log('Welcome message received:', data.message);
        break;

      case 'authenticated':
        this.isAuthenticated = true;
        this.userRole = data.userRole;
        console.log(`✅ Authenticated as ${data.userRole}: ${data.username}`);
        this.emit('authenticated', data);
        break;

      case 'subscription_confirmed':
        console.log(`✅ Subscribed to channel: ${data.channel}`);
        this.emit('subscribed', data);
        break;

      case 'pong':
        // Heartbeat response - connection is alive
        break;

      case 'error':
        console.error('WebSocket server error:', data.message);
        this.emit('error', data);
        break;

      // Real-time data updates
      case 'USER_CREATED':
      case 'USER_REGISTERED':
      case 'USER_VOTED':
      case 'USER_DELETED':
      case 'USER_ROLE_CHANGED':
      case 'STATS_UPDATED':
      case 'BLOCKCHAIN_CANDIDATE_ADDED':
      case 'BLOCKCHAIN_VOTE_CASTED':
      case 'BLOCKCHAIN_VOTER_REGISTERED':
      case 'BLOCKCHAIN_VOTING_STATUS_CHANGED':
        this.emit('realtime_update', data);
        break;

      default:
        console.log('Unknown message type:', data.type);
        this.emit('message', data);
    }
  }

  // ✅ QUEUE MESSAGES WHEN DISCONNECTED
  queueMessage(message) {
    this.messageQueue.push({
      message,
      timestamp: Date.now()
    });

    // Limit queue size (last 50 messages)
    if (this.messageQueue.length > 50) {
      this.messageQueue = this.messageQueue.slice(-50);
    }
  }

  // ✅ PROCESS QUEUED MESSAGES
  processMessageQueue() {
    if (this.messageQueue.length === 0) return;

    console.log(`📤 Processing ${this.messageQueue.length} queued messages`);

    const currentQueue = [...this.messageQueue];
    this.messageQueue = [];

    currentQueue.forEach(({ message, timestamp }) => {
      // Skip old messages (older than 5 minutes)
      if (Date.now() - timestamp > 300000) {
        console.log('Skipping old queued message:', message.type);
        return;
      }

      this.send(message);
    });
  }

  // ✅ HEARTBEAT MECHANISM
  startHeartbeat() {
    this.stopHeartbeat(); // Clear any existing heartbeat
    
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        this.send({ type: 'ping' });
        
        // Check if we received pong recently
        if (this.lastHeartbeat && Date.now() - this.lastHeartbeat > 90000) {
          console.warn('⚠️ No heartbeat response - connection may be dead');
          this.disconnect();
          this.attemptReconnect();
        }
      }
    }, 30000); // Send ping every 30 seconds
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // ✅ RECONNECTION LOGIC
  attemptReconnect() {
    if (this.isReconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached or already reconnecting');
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    const delay = Math.min(this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1), 30000);
    
    console.log(`🔄 Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      if (this.url) {
        this.connect(this.url)
          .then(() => {
            // Re-subscribe to previous channels
            this.subscriptions.forEach(channel => {
              this.subscribe(channel);
            });
          })
          .catch((error) => {
            console.error('Reconnection failed:', error);
            this.isReconnecting = false;
            
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
              this.attemptReconnect();
            } else {
              this.emit('max_reconnect_attempts_reached');
            }
          });
      }
    }, delay);
  }

  // ✅ DISCONNECT
  disconnect() {
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }
    
    this.connectionState = 'disconnected';
    this.isAuthenticated = false;
    this.subscriptions.clear();
    this.messageQueue = [];
  }

  // ✅ CONNECTION STATE HELPERS
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  isConnecting() {
    return this.connectionState === 'connecting';
  }

  getConnectionState() {
    return this.connectionState;
  }

  getReconnectAttempts() {
    return this.reconnectAttempts;
  }

  // ✅ EVENT MANAGEMENT
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event, data = null) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // ✅ ADMIN ACTIONS
  sendAdminAction(action, data = {}) {
    if (this.userRole !== 'admin') {
      console.warn('Admin actions require admin role');
      return false;
    }

    return this.send({
      type: 'admin_action',
      action,
      data
    });
  }

  // ✅ VOTING ACTIONS
  sendVoteAction(candidateId) {
    return this.send({
      type: 'vote_cast',
      candidateId
    });
  }

  // ✅ GET CONNECTION INFO
  getConnectionInfo() {
    return {
      state: this.connectionState,
      isConnected: this.isConnected(),
      isAuthenticated: this.isAuthenticated,
      userRole: this.userRole,
      reconnectAttempts: this.reconnectAttempts,
      subscriptions: Array.from(this.subscriptions),
      queuedMessages: this.messageQueue.length,
      lastHeartbeat: this.lastHeartbeat
    };
  }

  // ✅ CLEANUP
  destroy() {
    this.disconnect();
    this.eventListeners.clear();
    this.subscriptions.clear();
    this.messageQueue = [];
    console.log('🧹 WebSocket manager destroyed');
  }
}

// ✅ WEBSOCKET UTILS
export const createWebSocketConnection = (url, options = {}) => {
  const {
    token = null,
    autoReconnect = true,
    maxReconnectAttempts = 5,
    channels = []
  } = options;

  const ws = new WebSocketManager();
  
  if (autoReconnect) {
    ws.maxReconnectAttempts = maxReconnectAttempts;
  } else {
    ws.maxReconnectAttempts = 0;
  }

  // Connect and setup
  ws.connect(url, token).then(() => {
    // Subscribe to channels
    channels.forEach(channel => {
      ws.subscribe(channel);
    });
  }).catch(error => {
    console.error('Failed to establish WebSocket connection:', error);
  });

  return ws;
};

// ✅ CONNECTION STATES
export const CONNECTION_STATES = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  ERROR: 'error'
};

// ✅ MESSAGE TYPES
export const MESSAGE_TYPES = {
  // Authentication
  AUTHENTICATE: 'authenticate',
  AUTHENTICATED: 'authenticated',
  
  // Subscriptions
  SUBSCRIBE: 'subscribe',
  UNSUBSCRIBE: 'unsubscribe',
  SUBSCRIPTION_CONFIRMED: 'subscription_confirmed',
  
  // Heartbeat
  PING: 'ping',
  PONG: 'pong',
  
  // Real-time updates
  USER_CREATED: 'USER_CREATED',
  USER_REGISTERED: 'USER_REGISTERED',
  USER_VOTED: 'USER_VOTED',
  USER_DELETED: 'USER_DELETED',
  STATS_UPDATED: 'STATS_UPDATED',
  
  // Blockchain events
  BLOCKCHAIN_CANDIDATE_ADDED: 'BLOCKCHAIN_CANDIDATE_ADDED',
  BLOCKCHAIN_VOTE_CASTED: 'BLOCKCHAIN_VOTE_CASTED',
  BLOCKCHAIN_VOTER_REGISTERED: 'BLOCKCHAIN_VOTER_REGISTERED',
  BLOCKCHAIN_VOTING_STATUS_CHANGED: 'BLOCKCHAIN_VOTING_STATUS_CHANGED'
};

// ✅ CHANNELS
export const CHANNELS = {
  ADMIN_PANEL: 'admin-panel',
  VOTER_DASHBOARD: 'voter-dashboard',
  GLOBAL: 'global'
};

// ✅ DEFAULT EXPORT
export default WebSocketManager;