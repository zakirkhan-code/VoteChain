const express = require('express');
const Web3 = require('web3');
const User = require('../models/User');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// ✅ WebSocket functions will be available via middleware
let broadcastToAdmins, broadcastToAll;

// ✅ MIDDLEWARE TO GET WEBSOCKET FUNCTIONS
router.use((req, res, next) => {
  broadcastToAdmins = req.broadcastToAdmins;
  broadcastToAll = req.broadcastToAll;
  next();
});

// ✅ ENHANCED CACHING with Event-Based Invalidation
const cache = new Map();
const CACHE_DURATIONS = {
  BLOCKCHAIN_STATUS: 300000,    // 5 minutes
  CANDIDATES: 600000,           // 10 minutes
  VOTING_STATUS: 180000,        // 3 minutes
  VOTER_INFO: 300000,           // 5 minutes
  RESULTS: 120000,              // 2 minutes
  GAS_PRICE: 60000,             // 1 minute
};

// Cache helper functions
function getCachedResponse(key, customTTL = null) {
  const cached = cache.get(key);
  if (!cached) return null;
  
  const ttl = customTTL || CACHE_DURATIONS[key.split('-')[0].toUpperCase()] || 30000;
  
  if (Date.now() - cached.timestamp < ttl) {
    console.log(`📋 Cache hit: ${key} (age: ${Math.round((Date.now() - cached.timestamp)/1000)}s)`);
    return cached.data;
  }
  
  cache.delete(key);
  console.log(`🗑️ Cache expired: ${key}`);
  return null;
}

function setCachedResponse(key, data, customTTL = null) {
  const ttl = customTTL || CACHE_DURATIONS[key.split('-')[0].toUpperCase()] || 30000;
  cache.set(key, { data, timestamp: Date.now(), ttl });
  console.log(`💾 Cached: ${key} for ${ttl/1000}s`);
}

function clearCacheByPattern(pattern) {
  const keysToDelete = Array.from(cache.keys()).filter(key => key.includes(pattern));
  keysToDelete.forEach(key => {
    cache.delete(key);
    console.log(`🗑️ Cache cleared: ${key}`);
  });
}

const CONTRACT_ABI = [
    {
      "inputs": [],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "candidateId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "name",
          "type": "string"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "party",
          "type": "string"
        }
      ],
      "name": "CandidateAdded",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "voter",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "candidateId",
          "type": "uint256"
        }
      ],
      "name": "VoteCasted",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "voter",
          "type": "address"
        }
      ],
      "name": "VoterRegistered",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false,
          "internalType": "bool",
          "name": "status",
          "type": "bool"
        }
      ],
      "name": "VotingStatusChanged",
      "type": "event"
    },
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "_name",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "_party",
          "type": "string"
        }
      ],
      "name": "addCandidate",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "admin",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "candidateCount",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "candidates",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "id",
          "type": "uint256"
        },
        {
          "internalType": "string",
          "name": "name",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "party",
          "type": "string"
        },
        {
          "internalType": "uint256",
          "name": "voteCount",
          "type": "uint256"
        },
        {
          "internalType": "bool",
          "name": "exists",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_candidateId",
          "type": "uint256"
        }
      ],
      "name": "castVote",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getAllCandidates",
      "outputs": [
        {
          "components": [
            {
              "internalType": "uint256",
              "name": "id",
              "type": "uint256"
            },
            {
              "internalType": "string",
              "name": "name",
              "type": "string"
            },
            {
              "internalType": "string",
              "name": "party",
              "type": "string"
            },
            {
              "internalType": "uint256",
              "name": "voteCount",
              "type": "uint256"
            },
            {
              "internalType": "bool",
              "name": "exists",
              "type": "bool"
            }
          ],
          "internalType": "struct Voting.Candidate[]",
          "name": "",
          "type": "tuple[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_candidateId",
          "type": "uint256"
        }
      ],
      "name": "getCandidate",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        },
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        },
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getTotalVotes",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_voter",
          "type": "address"
        }
      ],
      "name": "getVoterInfo",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        },
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        },
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getWinner",
      "outputs": [
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        },
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_voter",
          "type": "address"
        }
      ],
      "name": "registerVoter",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "toggleVotingStatus",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "voters",
      "outputs": [
        {
          "internalType": "bool",
          "name": "isRegistered",
          "type": "bool"
        },
        {
          "internalType": "bool",
          "name": "hasVoted",
          "type": "bool"
        },
        {
          "internalType": "uint256",
          "name": "votedFor",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "votingActive",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ];

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

// ✅ Web3 Configuration
const RPC_HTTP_URL = process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/63ad9c645e86405a87dfddbd095bdfa3';
const RPC_WS_URL = process.env.SEPOLIA_WS_URL || 'wss://sepolia.infura.io/ws/v3/63ad9c645e86405a87dfddbd095bdfa3';

// Initialize Web3
let web3Http;  // For regular calls
let web3Ws;    // For event subscriptions
let contract;
let wsContract;
let connectionRetries = 0;
const MAX_RETRIES = 3;
let eventSubscriptionsEnabled = false;

// ✅ Initialize Web3 with both HTTP and WebSocket
const initializeWeb3 = async () => {
  try {
    // HTTP provider for regular calls
    web3Http = new Web3(RPC_HTTP_URL);
    await web3Http.eth.net.isListening();
    
    if (CONTRACT_ADDRESS && CONTRACT_ABI) {
      contract = new web3Http.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);
    }
    
    console.log('✅ Web3 HTTP provider initialized');
    connectionRetries = 0;
    
  } catch (error) {
    connectionRetries++;
    console.error(`❌ Web3 initialization failed (attempt ${connectionRetries}):`, error.message);
    
    if (connectionRetries < MAX_RETRIES) {
      console.log(`🔄 Retrying Web3 connection in ${connectionRetries * 2}s...`);
      setTimeout(initializeWeb3, connectionRetries * 2000);
    }
  }
};

// Initialize on module load
initializeWeb3();

// ============================================================================
// ✅ BLOCKCHAIN STATUS & INFO ROUTES
// ============================================================================

// @route   GET /api/blockchain/status
// @desc    Get blockchain connection status
// @access  Public
router.get('/status', async (req, res) => {
  try {
    const cached = getCachedResponse('blockchain-status');
    if (cached) {
      return res.json({ ...cached, fromCache: true });
    }

    if (!web3Http) {
      const fallbackResponse = {
        success: false,
        message: 'Web3 not initialized - service temporarily unavailable',
        retryAfter: 30
      };
      setCachedResponse('blockchain-status', fallbackResponse, 60000);
      return res.status(503).json(fallbackResponse);
    }

    console.log('🔗 Checking blockchain status...');

    const [connectivityResult, networkResult, blockResult] = await Promise.allSettled([
      web3Http.eth.net.isListening(),
      web3Http.eth.net.getId(),
      web3Http.eth.getBlockNumber()
    ]);

    const isConnected = connectivityResult.status === 'fulfilled' ? connectivityResult.value : false;
    const networkId = networkResult.status === 'fulfilled' ? Number(networkResult.value) : null;
    const blockNumber = blockResult.status === 'fulfilled' ? Number(blockResult.value) : null;

    const response = {
      success: isConnected,
      data: {
        isConnected,
        networkId,
        blockNumber,
        contractAddress: CONTRACT_ADDRESS,
        rpcUrl: RPC_HTTP_URL.includes('localhost') ? 'localhost' : 'sepolia',
        connectionRetries,
        eventSubscriptions: eventSubscriptionsEnabled ? 'WebSocket' : 'Polling',
        lastChecked: new Date().toISOString()
      }
    };

    const cacheTime = isConnected ? CACHE_DURATIONS.BLOCKCHAIN_STATUS : 60000;
    setCachedResponse('blockchain-status', response, cacheTime);
    
    res.json(response);

  } catch (error) {
    console.error('Blockchain status error:', error);
    
    const cached = getCachedResponse('blockchain-status');
    if (cached) {
      return res.json({ ...cached, fromCache: true, message: 'Using cached data due to error' });
    }

    res.status(500).json({
      success: false,
      message: 'Blockchain temporarily unavailable',
      retryAfter: 60
    });
  }
});

// ============================================================================
// ✅ VOTING STATUS ROUTES (MISSING IN YOUR CODE)
// ============================================================================

// @route   GET /api/blockchain/voting-status
// @desc    Get current voting status
// @access  Public
router.get('/voting-status', async (req, res) => {
  try {
    const cached = getCachedResponse('voting-status');
    if (cached) {
      return res.json({ ...cached, fromCache: true });
    }

    console.log('🔗 Fetching voting status from blockchain...');

    if (!contract) {
      const fallbackResponse = {
        success: true,
        data: {
          votingActive: false,
          candidateCount: 0
        },
        message: 'Smart contract not initialized - using fallback'
      };
      setCachedResponse('voting-status', fallbackResponse);
      return res.json(fallbackResponse);
    }

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), 10000)
    );

    const [votingActivePromise, candidateCountPromise] = [
      contract.methods.votingActive().call(),
      contract.methods.candidateCount().call()
    ];

    const [votingActive, candidateCount] = await Promise.race([
      Promise.all([votingActivePromise, candidateCountPromise]),
      timeoutPromise
    ]);

    const response = {
      success: true,
      data: {
        votingActive: Boolean(votingActive),
        candidateCount: Number(candidateCount),
        lastUpdated: new Date().toISOString()
      }
    };

    setCachedResponse('voting-status', response);
    res.json(response);

  } catch (error) {
    console.error('Get voting status error:', error);
    
    const cached = getCachedResponse('voting-status');
    if (cached) {
      return res.json({ ...cached, fromCache: true, message: 'Using cached data due to error' });
    }

    res.json({
      success: true,
      data: {
        votingActive: false,
        candidateCount: 0
      },
      message: 'Blockchain unavailable - using fallback'
    });
  }
});

// @route   POST /api/blockchain/toggle-voting
// @desc    Toggle voting status (Admin only - for frontend reference)
// @access  Private/Admin
router.post('/toggle-voting', [auth, adminAuth], async (req, res) => {
  try {
    // This endpoint is for reference - actual blockchain call happens from frontend
    console.log('🔄 Toggle voting status requested');

    if (!contract) {
      return res.status(503).json({
        success: false,
        message: 'Smart contract not available',
        requiresWalletTransaction: true
      });
    }

    // Clear voting status cache
    clearCacheByPattern('voting-status');

    res.json({
      success: true,
      message: 'Voting status toggle requested - complete transaction in wallet',
      data: {
        requiresWalletTransaction: true,
        contractAddress: CONTRACT_ADDRESS,
        methodName: 'toggleVotingStatus'
      }
    });

  } catch (error) {
    console.error('Toggle voting error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle voting status',
      error: error.message
    });
  }
});

// ============================================================================
// ✅ CANDIDATE ROUTES
// ============================================================================

// @route   GET /api/blockchain/candidates
// @desc    Get all candidates from blockchain
// @access  Public
router.get('/candidates', async (req, res) => {
  try {
    const cached = getCachedResponse('candidates');
    if (cached) {
      return res.json({ ...cached, fromCache: true });
    }

    console.log('🔗 Fetching candidates from blockchain...');

    if (!contract) {
      const fallbackResponse = {
        success: true,
        data: { candidates: [] },
        message: 'Smart contract not initialized'
      };
      setCachedResponse('candidates', fallbackResponse);
      return res.json(fallbackResponse);
    }

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), 15000)
    );

    const candidatesPromise = contract.methods.getAllCandidates().call();
    const candidates = await Promise.race([candidatesPromise, timeoutPromise]);
    
    const formattedCandidates = candidates.map(candidate => ({
      id: Number(candidate.id),
      name: candidate.name,
      party: candidate.party,
      voteCount: Number(candidate.voteCount),
      exists: candidate.exists
    }));

    const response = {
      success: true,
      data: { 
        candidates: formattedCandidates,
        totalCandidates: formattedCandidates.length,
        lastUpdated: new Date().toISOString()
      }
    };

    setCachedResponse('candidates', response);
    res.json(response);

  } catch (error) {
    console.error('Get candidates error:', error);
    
    const cached = getCachedResponse('candidates');
    if (cached) {
      return res.json({ ...cached, fromCache: true, message: 'Using cached data due to error' });
    }

    res.json({
      success: true,
      data: { candidates: [], totalCandidates: 0 },
      message: 'Blockchain unavailable'
    });
  }
});

// @route   POST /api/blockchain/add-candidate
// @desc    Add candidate (Admin only - for frontend reference)
// @access  Private/Admin
router.post('/add-candidate', [auth, adminAuth], async (req, res) => {
  try {
    const { name, party } = req.body;

    if (!name || !party) {
      return res.status(400).json({
        success: false,
        message: 'Candidate name and party are required'
      });
    }

    if (!contract) {
      return res.status(503).json({
        success: false,
        message: 'Smart contract not available',
        requiresWalletTransaction: true
      });
    }

    // Clear candidates cache
    clearCacheByPattern('candidates');
    clearCacheByPattern('voting-status');

    // ✅ Broadcast to admins about candidate addition
    if (broadcastToAdmins) {
      broadcastToAdmins({
        type: 'CANDIDATE_ADD_REQUESTED',
        name: name.trim(),
        party: party.trim(),
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'Candidate addition requested - complete transaction in wallet',
      data: {
        name: name.trim(),
        party: party.trim(),
        requiresWalletTransaction: true,
        contractAddress: CONTRACT_ADDRESS,
        methodName: 'addCandidate'
      }
    });

  } catch (error) {
    console.error('Add candidate error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add candidate',
      error: error.message
    });
  }
});

// ============================================================================
// ✅ VOTER REGISTRATION ROUTES (MISSING IN YOUR CODE)
// ============================================================================

// @route   POST /api/blockchain/register-voter
// @desc    Register voter in database and provide blockchain transaction info
// @access  Private/Admin
router.post('/register-voter', [auth, adminAuth], async (req, res) => {
  try {
    const { voterAddress, userId } = req.body;
    
    if (!voterAddress || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Voter address and user ID are required'
      });
    }

    // Validate Ethereum address
    if (!/^0x[a-fA-F0-9]{40}$/.test(voterAddress)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Ethereum address format'
      });
    }

    console.log('🔗 Registering voter:', { voterAddress, userId });

    // Find and update user in database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if already registered
    if (user.isRegistered && user.walletAddress === voterAddress) {
      return res.status(400).json({
        success: false,
        message: 'User is already registered with this wallet address'
      });
    }

    // Update user in database
    const wasRegistered = user.isRegistered;
    user.isRegistered = true;
    user.walletAddress = voterAddress.toLowerCase();
    user.lastBlockchainSync = new Date();
    
    await user.save();

    // ✅ Broadcast registration event
    if (broadcastToAdmins && !wasRegistered) {
      broadcastToAdmins({
        type: 'USER_REGISTERED',
        userId: user._id,
        username: user.username,
        walletAddress: voterAddress,
        timestamp: new Date().toISOString()
      });
    }

    // Clear cache
    clearCacheByPattern(`voter-${voterAddress}`);

    res.json({
      success: true,
      message: 'Voter registered in database successfully',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          isRegistered: user.isRegistered,
          walletAddress: user.walletAddress
        },
        requiresWalletTransaction: true,
        contractAddress: CONTRACT_ADDRESS,
        methodName: 'registerVoter',
        methodParams: [voterAddress]
      }
    });

  } catch (error) {
    console.error('Register voter error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register voter',
      error: error.message
    });
  }
});

// @route   POST /api/blockchain/sync-registration
// @desc    Sync registration status from blockchain
// @access  Private/Admin
router.post('/sync-registration', [auth, adminAuth], async (req, res) => {
  try {
    const { voterAddress } = req.body;
    
    if (!voterAddress) {
      return res.status(400).json({
        success: false,
        message: 'Voter address is required'
      });
    }

    console.log('🔄 Syncing registration status for:', voterAddress);

    // Find user by wallet address
    const user = await User.findOne({ walletAddress: voterAddress.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found with this wallet address'
      });
    }

    let blockchainRegistered = false;
    let blockchainHasVoted = false;
    let blockchainVotedFor = 0;

    // Try to get voter info from blockchain
    if (contract) {
      try {
        const voterInfo = await contract.methods.getVoterInfo(voterAddress).call();
        blockchainRegistered = voterInfo[0];
        blockchainHasVoted = voterInfo[1]; 
        blockchainVotedFor = Number(voterInfo[2]);
      } catch (error) {
        console.warn('Could not fetch voter info from blockchain:', error.message);
      }
    }

    // Update user with blockchain data
    const originalData = {
      isRegistered: user.isRegistered,
      hasVoted: user.hasVoted,
      votedFor: user.votedFor
    };

    user.isRegistered = blockchainRegistered;
    user.hasVoted = blockchainHasVoted;
    user.votedFor = blockchainVotedFor;
    user.blockchainSynced = true;
    user.lastBlockchainSync = new Date();

    await user.save();

    // ✅ Broadcast sync event if status changed
    if (broadcastToAdmins) {
      const changes = {};
      if (originalData.isRegistered !== user.isRegistered) changes.registration = user.isRegistered;
      if (originalData.hasVoted !== user.hasVoted) changes.voted = user.hasVoted;
      if (originalData.votedFor !== user.votedFor) changes.votedFor = user.votedFor;

      if (Object.keys(changes).length > 0) {
        broadcastToAdmins({
          type: 'USER_BLOCKCHAIN_SYNCED',
          userId: user._id,
          username: user.username,
          walletAddress: voterAddress,
          changes,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Clear cache
    clearCacheByPattern(`voter-${voterAddress}`);

    res.json({
      success: true,
      message: 'Registration status synced with blockchain',
      data: {
        user: {
          id: user._id,
          username: user.username,
          isRegistered: user.isRegistered,
          hasVoted: user.hasVoted,
          votedFor: user.votedFor,
          walletAddress: user.walletAddress
        },
        blockchainData: {
          isRegistered: blockchainRegistered,
          hasVoted: blockchainHasVoted,
          votedFor: blockchainVotedFor
        },
        lastSynced: user.lastBlockchainSync
      }
    });

  } catch (error) {
    console.error('Sync registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync registration status',
      error: error.message
    });
  }
});

// @route   GET /api/blockchain/voter-info/:address
// @desc    Get voter information from blockchain
// @access  Public
router.get('/voter-info/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Ethereum address format'
      });
    }

    const cached = getCachedResponse(`voter-${address}`);
    if (cached) {
      return res.json({ ...cached, fromCache: true });
    }

    console.log('🔗 Fetching voter info from blockchain:', address);

    if (!contract) {
      const fallbackResponse = {
        success: true,
        data: {
          address,
          isRegistered: false,
          hasVoted: false,
          votedFor: 0
        },
        message: 'Smart contract not initialized'
      };
      setCachedResponse(`voter-${address}`, fallbackResponse);
      return res.json(fallbackResponse);
    }

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), 10000)
    );

    const voterInfoPromise = contract.methods.getVoterInfo(address).call();
    const voterInfo = await Promise.race([voterInfoPromise, timeoutPromise]);

    const response = {
      success: true,
      data: {
        address,
        isRegistered: Boolean(voterInfo[0]),
        hasVoted: Boolean(voterInfo[1]),
        votedFor: Number(voterInfo[2]),
        lastChecked: new Date().toISOString()
      }
    };

    setCachedResponse(`voter-${address}`, response);
    res.json(response);

  } catch (error) {
    console.error('Get voter info error:', error);
    
    const cached = getCachedResponse(`voter-${address}`);
    if (cached) {
      return res.json({ ...cached, fromCache: true, message: 'Using cached data due to error' });
    }

    res.json({
      success: true,
      data: {
        address: req.params.address,
        isRegistered: false,
        hasVoted: false,
        votedFor: 0
      },
      message: 'Blockchain unavailable'
    });
  }
});

// ============================================================================
// ✅ VOTING RESULTS ROUTES (MISSING IN YOUR CODE)
// ============================================================================

// @route   GET /api/blockchain/results
// @desc    Get voting results from blockchain
// @access  Public
router.get('/results', async (req, res) => {
  try {
    const cached = getCachedResponse('results');
    if (cached) {
      return res.json({ ...cached, fromCache: true });
    }

    console.log('🔗 Fetching voting results from blockchain...');

    if (!contract) {
      const fallbackResponse = {
        success: true,
        data: {
          candidates: [],
          totalVotes: 0,
          winner: null
        },
        message: 'Smart contract not initialized'
      };
      setCachedResponse('results', fallbackResponse);
      return res.json(fallbackResponse);
    }

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), 15000)
    );

    const [candidatesPromise, totalVotesPromise] = [
      contract.methods.getAllCandidates().call(),
      contract.methods.getTotalVotes().call()
    ];

    const [candidates, totalVotes] = await Promise.race([
      Promise.all([candidatesPromise, totalVotesPromise]),
      timeoutPromise
    ]);

    const formattedCandidates = candidates
      .map(candidate => ({
        id: Number(candidate.id),
        name: candidate.name,
        party: candidate.party,
        voteCount: Number(candidate.voteCount),
        exists: candidate.exists,
        percentage: Number(totalVotes) > 0 ? 
          parseFloat(((Number(candidate.voteCount) / Number(totalVotes)) * 100).toFixed(2)) : 0
      }))
      .sort((a, b) => b.voteCount - a.voteCount); // Sort by vote count descending

    // Determine winner
    const winner = formattedCandidates.length > 0 && formattedCandidates[0].voteCount > 0 ? 
      formattedCandidates[0] : null;

    const response = {
      success: true,
      data: {
        candidates: formattedCandidates,
        totalVotes: Number(totalVotes),
        winner,
        lastUpdated: new Date().toISOString()
      }
    };

    setCachedResponse('results', response);
    res.json(response);

  } catch (error) {
    console.error('Get voting results error:', error);
    
    const cached = getCachedResponse('results');
    if (cached) {
      return res.json({ ...cached, fromCache: true, message: 'Using cached data due to error' });
    }

    res.json({
      success: true,
      data: {
        candidates: [],
        totalVotes: 0,
        winner: null
      },
      message: 'Blockchain unavailable'
    });
  }
});

// ============================================================================
// ✅ UTILITY ROUTES
// ============================================================================

// @route   GET /api/blockchain/gas-price
// @desc    Get current gas price
// @access  Public
router.get('/gas-price', async (req, res) => {
  try {
    const cached = getCachedResponse('gas-price');
    if (cached) {
      return res.json({ ...cached, fromCache: true });
    }

    if (!web3Http) {
      return res.status(503).json({
        success: false,
        message: 'Web3 not available'
      });
    }

    const gasPrice = await web3Http.eth.getGasPrice();
    const gasPriceGwei = web3Http.utils.fromWei(gasPrice, 'gwei');

    const response = {
      success: true,
      data: {
        gasPrice: gasPrice.toString(),
        gasPriceGwei: parseFloat(gasPriceGwei).toFixed(2),
        lastUpdated: new Date().toISOString()
      }
    };

    setCachedResponse('gas-price', response);
    res.json(response);

  } catch (error) {
    console.error('Get gas price error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get gas price',
      error: error.message
    });
  }
});

// @route   GET /api/blockchain/events/status
// @desc    Get blockchain event system status (Admin only)
// @access  Private/Admin
router.get('/events/status', [auth, adminAuth], (req, res) => {
  res.json({
    success: true,
    data: {
      eventSubscriptionsEnabled,
      method: eventSubscriptionsEnabled ? 'WebSocket' : 'Polling',
      httpProvider: !!web3Http,
      wsProvider: !!web3Ws,
      contractConnected: !!contract,
      wsContractConnected: !!wsContract,
      cacheSize: cache.size,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }
  });
});

// @route   POST /api/blockchain/clear-cache
// @desc    Clear blockchain cache (Admin only)
// @access  Private/Admin
router.post('/clear-cache', [auth, adminAuth], (req, res) => {
  try {
    const pattern = req.body.pattern || '';
    
    if (pattern) {
      clearCacheByPattern(pattern);
      res.json({
        success: true,
        message: `Cache cleared for pattern: ${pattern}`
      });
    } else {
      cache.clear();
      res.json({
        success: true,
        message: 'All blockchain cache cleared'
      });
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to clear cache',
      error: error.message
    });
  }
});

module.exports = router;