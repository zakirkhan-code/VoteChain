const express = require('express');
const http = require('http'); // ✅ NEW: For HTTP server
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app); // ✅ NEW: Create HTTP server

// ✅ NEW: Import WebSocket handler
const { 
  setupWebSocketServer, 
  broadcastToAdmins, 
  broadcastToAll, 
  broadcastToVoters,
  getConnectionStats 
} = require('./websocket-handler');

// Basic Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/votechain')
.then(() => {
  console.log('✅ MongoDB Connected Successfully');
})
.catch(err => {
  console.error('❌ MongoDB Connection Error:', err.message);
});

// ✅ NEW: Setup WebSocket Server
const wss = setupWebSocketServer(server);
console.log('📡 WebSocket server initialized');

// ✅ NEW: Make WebSocket functions available to routes
app.use((req, res, next) => {
  req.wss = wss;
  req.broadcastToAdmins = broadcastToAdmins;
  req.broadcastToAll = broadcastToAll;
  req.broadcastToVoters = broadcastToVoters;
  next();
});

// Simple Routes
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 VoteChain Backend with WebSocket is running!',
    version: '2.0.0',
    features: ['REST API', 'WebSocket Real-time', 'Blockchain Integration'],
    websocket: {
      clients: wss.clients.size,
      url: `ws://localhost:${process.env.PORT || 5000}`
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    status: 'active',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    websocket: {
      server: 'active',
      clients: wss.clients.size,
      ...getConnectionStats()
    },
    uptime: process.uptime()
  });
});

// ✅ NEW: WebSocket Real-time Status
app.get('/api/realtime/status', (req, res) => {
  const stats = getConnectionStats();
  res.json({
    success: true,
    data: {
      websocketServer: 'active',
      connectedClients: wss.clients.size,
      ...stats,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }
  });
});

// ✅ NEW: Test WebSocket Broadcasting (Admin only)
app.post('/api/realtime/test-broadcast', (req, res) => {
  const { message, type = 'TEST_MESSAGE', channel = 'admin' } = req.body;
  
  try {
    const data = {
      type,
      message: message || 'Test broadcast from server',
      timestamp: new Date().toISOString()
    };

    let sentCount = 0;
    if (channel === 'admin') {
      sentCount = broadcastToAdmins(data);
    } else if (channel === 'all') {
      sentCount = broadcastToAll(data);
    } else if (channel === 'voters') {
      sentCount = broadcastToVoters(data);
    }

    res.json({
      success: true,
      message: `Test broadcast sent to ${sentCount} clients`,
      data: { sentCount, channel, ...data }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to send test broadcast',
      error: error.message
    });
  }
});

// Routes - Updated with proper error handling
try {
  app.use('/api/auth', require('./routes/auth'));
  console.log('✅ Auth routes loaded');
} catch (error) {
  console.error('❌ Auth route loading error:', error.message);
}

try {
  app.use('/api/users', require('./routes/users'));
  console.log('✅ Users routes loaded');
} catch (error) {
  console.error('❌ Users route loading error:', error.message);
}

try {
  app.use('/api/votes', require('./routes/votes'));
  console.log('✅ Votes routes loaded');
} catch (error) {
  console.error('❌ Votes route loading error:', error.message);
}

// Try to load blockchain routes if they exist
try {
  app.use('/api/blockchain', require('./routes/blockchain'));
  console.log('✅ Blockchain routes loaded with WebSocket integration');
} catch (error) {
  console.warn('⚠️ Blockchain routes not found, using fallback endpoints');
  
  // ✅ ENHANCED: Fallback blockchain endpoints with WebSocket notifications
  app.get('/api/blockchain/status', (req, res) => {
    res.json({
      success: true,
      data: {
        message: 'Blockchain endpoint working (fallback)',
        contractAddress: process.env.CONTRACT_ADDRESS || 'Not configured',
        isConnected: false,
        networkId: 0,
        blockNumber: 0,
        rpcUrl: 'fallback'
      }
    });
  });

  app.get('/api/blockchain/candidates', (req, res) => {
    res.json({
      success: true,
      data: { candidates: [] },
      message: 'Using fallback - no blockchain connection'
    });
  });

  app.get('/api/blockchain/voting-status', (req, res) => {
    res.json({
      success: true,
      data: {
        votingActive: false,
        candidateCount: 0
      },
      message: 'Using fallback - no blockchain connection'
    });
  });

  app.get('/api/blockchain/results', (req, res) => {
    res.json({
      success: true,
      data: {
        candidates: [],
        totalVotes: 0,
        winner: null
      },
      message: 'Using fallback - no blockchain connection'
    });
  });

  app.post('/api/blockchain/add-candidate', (req, res) => {
    const { name, party } = req.body;
    
    // ✅ NEW: Simulate candidate addition and broadcast
    if (name && party) {
      const mockCandidate = {
        id: Date.now(),
        name: name.trim(),
        party: party.trim(),
        voteCount: 0,
        exists: true
      };

      // Broadcast to admins (fallback simulation)
      broadcastToAdmins({
        type: 'FALLBACK_CANDIDATE_ADDED',
        candidateId: mockCandidate.id,
        name: mockCandidate.name,
        party: mockCandidate.party,
        message: 'Simulated candidate addition (no blockchain)'
      });

      res.json({
        success: true,
        message: 'Candidate added (fallback mode - no blockchain)',
        data: {
          candidate: mockCandidate,
          requiresWalletTransaction: false,
          isFallback: true
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Candidate name and party are required'
      });
    }
  });

  app.post('/api/blockchain/toggle-voting', (req, res) => {
    // ✅ NEW: Simulate voting toggle and broadcast
    const currentStatus = false; // In real app, get from database
    const newStatus = !currentStatus;

    broadcastToAdmins({
      type: 'FALLBACK_VOTING_STATUS_CHANGED',
      status: newStatus,
      message: `Voting ${newStatus ? 'started' : 'stopped'} (fallback mode)`
    });

    res.json({
      success: true,
      message: `Voting ${newStatus ? 'started' : 'stopped'} (fallback mode)`,
      data: {
        currentStatus,
        newStatus,
        requiresWalletTransaction: false,
        isFallback: true
      }
    });
  });

  app.post('/api/blockchain/register-voter', (req, res) => {
    const { voterAddress, userId } = req.body;
    
    if (!voterAddress || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Voter address and user ID are required'
      });
    }

    // ✅ NEW: Try to update user and broadcast
    const User = require('./models/User');
    User.findById(userId)
      .then(user => {
        if (!user) {
          throw new Error('User not found');
        }

        const wasRegistered = user.isRegistered;
        user.isRegistered = true;
        user.walletAddress = voterAddress;
        user.lastBlockchainSync = new Date();
        
        return user.save().then(() => {
          // Broadcast registration event
          if (!wasRegistered) {
            broadcastToAdmins({
              type: 'FALLBACK_USER_REGISTERED',
              userId: user._id,
              username: user.username,
              walletAddress: voterAddress,
              message: 'User registered (fallback mode - no blockchain)'
            });
          }
          return user;
        });
      })
      .then(user => {
        res.json({
          success: true,
          message: 'User registered in database (fallback mode)',
          data: {
            user: {
              id: user._id,
              username: user.username,
              email: user.email,
              isRegistered: user.isRegistered,
              walletAddress: user.walletAddress
            },
            requiresWalletTransaction: false,
            isFallback: true
          }
        });
      })
      .catch(err => {
        res.status(500).json({
          success: false,
          message: 'Failed to register voter',
          error: err.message
        });
      });
  });

  app.get('/api/blockchain/voter-info/:address', (req, res) => {
    res.json({
      success: true,
      data: {
        address: req.params.address,
        isRegistered: false,
        hasVoted: false,
        votedFor: 0
      },
      message: 'Using fallback - no blockchain connection'
    });
  });

  app.post('/api/blockchain/sync-registration', (req, res) => {
    const { voterAddress } = req.body;
    
    if (!voterAddress) {
      return res.status(400).json({
        success: false,
        message: 'Voter address is required'
      });
    }

    // Try to update user in database without blockchain
    const User = require('./models/User');
    User.findOne({ walletAddress: voterAddress })
      .then(user => {
        if (user) {
          user.isRegistered = true;
          user.lastBlockchainSync = new Date();
          return user.save();
        }
        throw new Error('User not found');
      })
      .then(user => {
        // ✅ NEW: Broadcast sync event
        broadcastToAdmins({
          type: 'FALLBACK_REGISTRATION_SYNCED',
          userId: user._id,
          username: user.username,
          walletAddress: voterAddress,
          message: 'Registration synced (fallback mode)'
        });

        res.json({
          success: true,
          message: 'Registration status updated in database (no blockchain sync)',
          data: { user }
        });
      })
      .catch(err => {
        res.status(500).json({
          success: false,
          message: 'Failed to sync registration',
          error: err.message
        });
      });
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      server: 'running',
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      websocket: {
        server: 'active',
        clients: wss.clients.size,
        ...getConnectionStats()
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
      version: '2.0.0'
    }
  });
});

// ✅ NEW: WebSocket Connection Info
app.get('/api/websocket/info', (req, res) => {
  const stats = getConnectionStats();
  res.json({
    success: true,
    data: {
      server: 'WebSocket Server Active',
      url: `ws://localhost:${process.env.PORT || 5000}`,
      clients: {
        total: wss.clients.size,
        ...stats
      },
      features: [
        'Real-time user updates',
        'Live blockchain events',
        'Instant admin notifications',
        'Auto-reconnection support'
      ],
      channels: {
        'admin-panel': 'Admin dashboard updates',
        'voter-dashboard': 'Voter interface updates',
        'global': 'System-wide notifications'
      }
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err.stack);
  res.status(500).json({ 
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false,
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: [
      'GET /',
      'GET /api/status',
      'GET /api/health',
      'GET /api/realtime/status',
      'POST /api/realtime/test-broadcast',
      'GET /api/websocket/info',
      'POST /api/auth/login',
      'POST /api/auth/register',
      'GET /api/users',
      'GET /api/votes/stats',
      'GET /api/blockchain/status'
    ]
  });
});

// ✅ ENHANCED: Graceful shutdown with WebSocket cleanup
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT. Graceful shutdown...');
  
  // Close WebSocket connections
  console.log('📡 Closing WebSocket connections...');
  wss.clients.forEach(ws => {
    ws.close(1000, 'Server shutting down');
  });
  
  // Close database connection
  mongoose.connection.close(() => {
    console.log('📦 MongoDB connection closed.');
    
    // Close HTTP server
    server.close(() => {
      console.log('🚀 HTTP server closed.');
      process.exit(0);
    });
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM. Graceful shutdown...');
  
  // Close WebSocket connections
  console.log('📡 Closing WebSocket connections...');
  wss.clients.forEach(ws => {
    ws.close(1000, 'Server shutting down');
  });
  
  // Close database connection
  mongoose.connection.close(() => {
    console.log('📦 MongoDB connection closed.');
    
    // Close HTTP server
    server.close(() => {
      console.log('🚀 HTTP server closed.');
      process.exit(0);
    });
  });
});

// ✅ UPDATED: Start server with WebSocket support
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log('🎉 =====================================');
  console.log(`🚀 VoteChain Server running on port ${PORT}`);
  console.log(`📱 REST API: http://localhost:${PORT}`);
  console.log(`📡 WebSocket: ws://localhost:${PORT}`);
  console.log(`🔗 Frontend: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`📊 Database: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
  console.log(`📡 WebSocket: Active (${wss.clients.size} clients)`);
  console.log('🎉 =====================================');
  console.log('✨ Features Active:');
  console.log('   💾 Database Operations');
  console.log('   📡 Real-time WebSocket Events');
  console.log('   ⛓️ Blockchain Integration (when available)');
  console.log('   🔄 Auto-reconnection Support');
  console.log('   🎯 Zero Auto-refresh (Event-driven)');
  console.log('🎉 =====================================');
});

// ✅ NEW: Export server and WebSocket for testing
module.exports = { app, server, wss };