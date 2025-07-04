// websocket-handler.js
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

const connectedClients = new Map();

function setupWebSocketServer(server) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', async (ws, req) => {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`🟢 WebSocket client connected: ${clientId}`);

    connectedClients.set(clientId, {
      ws,
      subscriptions: new Set(),
      userRole: null,
      userId: null,
      connectedAt: new Date(),
      lastActivity: new Date()
    });

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        const client = connectedClients.get(clientId);
        if (!client) return;
        client.lastActivity = new Date();

        switch (data.type) {
          case 'authenticate':
            await handleAuthentication(clientId, data.token);
            break;

          case 'subscribe':
            client.subscriptions.add(data.channel);
            console.log(`📡 Client ${clientId} subscribed to ${data.channel}`);
            ws.send(JSON.stringify({
              type: 'subscription_confirmed',
              channel: data.channel,
              timestamp: new Date().toISOString()
            }));
            break;

          case 'unsubscribe':
            client.subscriptions.delete(data.channel);
            break;

          case 'ping':
            ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
            break;

          default:
            console.log(`Unknown WebSocket message type: ${data.type}`);
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    });

    ws.on('close', () => {
      console.log(`🔴 WebSocket client disconnected: ${clientId}`);
      connectedClients.delete(clientId);
    });

    ws.on('error', (err) => {
      console.error(`WebSocket error for ${clientId}:`, err);
      connectedClients.delete(clientId);
    });

    ws.send(JSON.stringify({
      type: 'welcome',
      clientId,
      timestamp: new Date().toISOString(),
      message: 'Connected to VoteChain real-time system'
    }));
  });

  // Cleanup inactive clients
  setInterval(() => {
    const now = Date.now();
    connectedClients.forEach((client, id) => {
      if (now - client.lastActivity > 5 * 60 * 1000) {
        console.log(`🧹 Cleaning up inactive client: ${id}`);
        client.ws.terminate();
        connectedClients.delete(id);
      }
    });
  }, 60000);

  return wss;
}

async function handleAuthentication(clientId, token) {
  try {
    if (!token) return;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('role username');

    if (user) {
      const client = connectedClients.get(clientId);
      if (client) {
        client.userRole = user.role;
        client.userId = user._id;
        client.ws.send(JSON.stringify({
          type: 'authenticated',
          userRole: user.role,
          username: user.username,
          timestamp: new Date().toISOString()
        }));
      }
    }
  } catch (err) {
    console.error('Authentication error:', err);
  }
}

function broadcastToSubscribers(channel, data, filterFn = null) {
  const message = JSON.stringify({ ...data, timestamp: new Date().toISOString() });
  let sentCount = 0;

  connectedClients.forEach((client, id) => {
    const shouldSend = client.subscriptions.has(channel)
      && client.ws.readyState === WebSocket.OPEN
      && (!filterFn || filterFn(client));

    if (shouldSend) {
      try {
        client.ws.send(message);
        sentCount++;
      } catch (err) {
        console.error(`Failed to send to client ${id}:`, err);
        connectedClients.delete(id);
      }
    }
  });

  console.log(`📡 Broadcasted ${data.type} to ${sentCount} clients on ${channel}`);
  return sentCount;
}

function broadcastToAdmins(data) {
  return broadcastToSubscribers('admin-panel', data, (client) => client.userRole === 'admin');
}

function broadcastToAll(data) {
  return broadcastToSubscribers('global', data);
}

function broadcastToVoters(data) {
  return broadcastToSubscribers('voter-dashboard', data, (client) => client.userRole === 'voter');
}

function getConnectionStats() {
  const stats = {
    totalConnections: connectedClients.size,
    adminConnections: 0,
    voterConnections: 0,
    unauthenticatedConnections: 0,
    subscriptions: {}
  };

  connectedClients.forEach(client => {
    if (client.userRole === 'admin') stats.adminConnections++;
    else if (client.userRole === 'voter') stats.voterConnections++;
    else stats.unauthenticatedConnections++;

    client.subscriptions.forEach(channel => {
      stats.subscriptions[channel] = (stats.subscriptions[channel] || 0) + 1;
    });
  });

  return stats;
}

module.exports = {
  setupWebSocketServer,
  broadcastToAdmins,
  broadcastToAll,
  broadcastToVoters,
  getConnectionStats,
  connectedClients
};
