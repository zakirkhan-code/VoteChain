// backend/middleware/websocket-auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ✅ WEBSOCKET AUTHENTICATION MIDDLEWARE
const authenticateWebSocket = async (token) => {
  try {
    if (!token) {
      throw new Error('No token provided');
    }

    // Remove 'Bearer ' prefix if present
    const cleanToken = token.replace('Bearer ', '');
    
    // Verify JWT token
    const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET);
    
    // Find user
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      throw new Error('User not found');
    }

    return {
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        isRegistered: user.isRegistered,
        walletAddress: user.walletAddress
      }
    };

  } catch (error) {
    console.error('WebSocket authentication error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

// ✅ ROLE-BASED ACCESS CONTROL
const checkWebSocketPermission = (userRole, channel) => {
  const permissions = {
    'admin': ['admin-panel', 'global', 'voter-dashboard'], // Admin can access all channels
    'voter': ['voter-dashboard', 'global'], // Voters can access limited channels
  };

  return permissions[userRole]?.includes(channel) || false;
};

// ✅ RATE LIMITING FOR WEBSOCKET MESSAGES
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_MESSAGES_PER_WINDOW = 30; // Max 30 messages per minute

const checkRateLimit = (clientId) => {
  const now = Date.now();
  const clientLimit = rateLimitMap.get(clientId);

  if (!clientLimit) {
    rateLimitMap.set(clientId, {
      count: 1,
      windowStart: now
    });
    return { allowed: true, remaining: MAX_MESSAGES_PER_WINDOW - 1 };
  }

  // Reset window if expired
  if (now - clientLimit.windowStart > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(clientId, {
      count: 1,
      windowStart: now
    });
    return { allowed: true, remaining: MAX_MESSAGES_PER_WINDOW - 1 };
  }

  // Check if limit exceeded
  if (clientLimit.count >= MAX_MESSAGES_PER_WINDOW) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: clientLimit.windowStart + RATE_LIMIT_WINDOW
    };
  }

  // Increment count
  clientLimit.count++;
  return {
    allowed: true,
    remaining: MAX_MESSAGES_PER_WINDOW - clientLimit.count
  };
};

// ✅ CLEAN UP RATE LIMIT MAP
setInterval(() => {
  const now = Date.now();
  for (const [clientId, limit] of rateLimitMap.entries()) {
    if (now - limit.windowStart > RATE_LIMIT_WINDOW) {
      rateLimitMap.delete(clientId);
    }
  }
}, 300000); // Clean every 5 minutes

// ✅ MESSAGE VALIDATION
const validateWebSocketMessage = (message) => {
  try {
    const parsed = JSON.parse(message);
    
    // Required fields
    if (!parsed.type) {
      return { valid: false, error: 'Message type is required' };
    }

    // Validate message type
    const allowedTypes = [
      'authenticate',
      'subscribe',
      'unsubscribe',
      'ping',
      'message',
      'admin_action',
      'vote_cast',
      'candidate_add'
    ];

    if (!allowedTypes.includes(parsed.type)) {
      return { valid: false, error: 'Invalid message type' };
    }

    // Message size limit (10KB)
    if (message.length > 10240) {
      return { valid: false, error: 'Message too large' };
    }

    return { valid: true, message: parsed };

  } catch (error) {
    return { valid: false, error: 'Invalid JSON format' };
  }
};

// ✅ SANITIZE MESSAGE DATA
const sanitizeMessage = (data) => {
  const sanitized = { ...data };
  
  // Remove sensitive fields
  const sensitiveFields = ['password', 'token', 'secret', 'key'];
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      delete sanitized[field];
    }
  });

  // Sanitize strings
  Object.keys(sanitized).forEach(key => {
    if (typeof sanitized[key] === 'string') {
      // Basic XSS protection
      sanitized[key] = sanitized[key]
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .trim()
        .substring(0, 1000); // Limit string length
    }
  });

  return sanitized;
};

// ✅ LOG WEBSOCKET ACTIVITY
const logWebSocketActivity = (clientId, userRole, action, details = {}) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    clientId,
    userRole,
    action,
    details
  };

  // Log to console (in production, use proper logging service)
  console.log(`📡 WebSocket: ${action} by ${userRole} client ${clientId}`, details);

  // You can add database logging here if needed
  // await ActivityLog.create(logEntry);
};

// ✅ HEARTBEAT VALIDATION
const heartbeatMap = new Map();
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const HEARTBEAT_TIMEOUT = 90000; // 90 seconds

const updateHeartbeat = (clientId) => {
  heartbeatMap.set(clientId, Date.now());
};

const checkHeartbeat = (clientId) => {
  const lastHeartbeat = heartbeatMap.get(clientId);
  if (!lastHeartbeat) return false;
  
  return Date.now() - lastHeartbeat < HEARTBEAT_TIMEOUT;
};

const cleanupHeartbeats = () => {
  const now = Date.now();
  for (const [clientId, lastHeartbeat] of heartbeatMap.entries()) {
    if (now - lastHeartbeat > HEARTBEAT_TIMEOUT) {
      heartbeatMap.delete(clientId);
      console.log(`🧹 Cleaned up heartbeat for inactive client: ${clientId}`);
    }
  }
};

// Clean up heartbeats every minute
setInterval(cleanupHeartbeats, 60000);

// ✅ CONNECTION LIMITS
const MAX_CONNECTIONS_PER_USER = 3;
const connectionMap = new Map(); // userId -> [clientIds]

const checkConnectionLimit = (userId, clientId) => {
  if (!userId) return { allowed: true };

  const userConnections = connectionMap.get(userId) || [];
  
  // Remove this client if already connected (reconnection)
  const filteredConnections = userConnections.filter(id => id !== clientId);
  
  if (filteredConnections.length >= MAX_CONNECTIONS_PER_USER) {
    return {
      allowed: false,
      error: `Maximum ${MAX_CONNECTIONS_PER_USER} connections per user exceeded`
    };
  }

  // Add current connection
  connectionMap.set(userId, [...filteredConnections, clientId]);
  
  return { allowed: true };
};

const removeConnection = (userId, clientId) => {
  if (!userId) return;
  
  const userConnections = connectionMap.get(userId) || [];
  const filteredConnections = userConnections.filter(id => id !== clientId);
  
  if (filteredConnections.length === 0) {
    connectionMap.delete(userId);
  } else {
    connectionMap.set(userId, filteredConnections);
  }
};

// ✅ SECURITY HEADERS FOR WEBSOCKET
const getSecurityHeaders = () => {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'",
  };
};

module.exports = {
  authenticateWebSocket,
  checkWebSocketPermission,
  checkRateLimit,
  validateWebSocketMessage,
  sanitizeMessage,
  logWebSocketActivity,
  updateHeartbeat,
  checkHeartbeat,
  checkConnectionLimit,
  removeConnection,
  getSecurityHeaders,
  
  // Constants
  RATE_LIMIT_WINDOW,
  MAX_MESSAGES_PER_WINDOW,
  HEARTBEAT_INTERVAL,
  HEARTBEAT_TIMEOUT,
  MAX_CONNECTIONS_PER_USER
};