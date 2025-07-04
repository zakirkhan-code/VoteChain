// backend/routes/votes.js
const express = require('express');
const Vote = require('../models/Vote');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/votes/cast
// @desc    Record a vote in database after blockchain transaction
// @access  Private
router.post('/cast', auth, async (req, res) => {
  try {
    const {
      candidateId,
      candidateName,
      candidateParty,
      transactionHash,
      blockNumber,
      gasUsed,
      gasPrice,
      walletAddress
    } = req.body;

    const userId = req.user.id || req.user.userId;

    // Validation
    if (!candidateId || !candidateName || !transactionHash || !walletAddress) {
      return res.status(400).json({
        success: false,
        message: 'Required fields missing: candidateId, candidateName, transactionHash, walletAddress'
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user has already voted
    const existingVote = await Vote.findOne({ 
      $or: [
        { voterAddress: walletAddress },
        { userId: userId }
      ]
    });
    
    if (existingVote) {
      return res.status(400).json({
        success: false,
        message: 'Vote already recorded for this user'
      });
    }

    // Create vote record
    const vote = new Vote({
      voterAddress: walletAddress.toLowerCase(),
      voterUsername: user.username,
      userId: user._id,
      candidateId: parseInt(candidateId),
      candidateName: candidateName.trim(),
      candidateParty: candidateParty?.trim() || '',
      transactionHash: transactionHash.toLowerCase(),
      blockNumber: parseInt(blockNumber) || 0,
      gasUsed: parseInt(gasUsed) || 0,
      gasPrice: gasPrice?.toString() || '0',
      status: 'confirmed',
      confirmations: 1,
      network: 'sepolia'
    });

    await vote.save();

    // Update user vote status
    user.hasVoted = true;
    user.votedFor = parseInt(candidateId);
    user.blockchainSynced = true;
    user.lastBlockchainSync = new Date();
    await user.save();

    console.log('Vote recorded successfully:', {
      userId: user._id,
      username: user.username,
      candidateId,
      transactionHash
    });

    res.status(201).json({
      success: true,
      message: 'Vote recorded successfully',
      data: {
        vote: vote.toObject(),
        user: {
          hasVoted: user.hasVoted,
          votedFor: user.votedFor
        }
      }
    });

  } catch (error) {
    console.error('Cast vote error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Transaction hash already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to record vote',
      error: error.message
    });
  }
});

// @route   GET /api/votes/my-vote
// @desc    Get current user's vote information
// @access  Private
router.get('/my-vote', auth, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    
    const user = await User.findById(userId).select('hasVoted votedFor');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    let vote = null;
    if (user.hasVoted) {
      vote = await Vote.findOne({ userId: user._id })
        .select('candidateId candidateName candidateParty transactionHash createdAt')
        .lean();
    }

    res.json({
      success: true,
      data: {
        hasVoted: user.hasVoted,
        votedFor: user.votedFor,
        vote
      }
    });

  } catch (error) {
    console.error('Get my vote error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get vote information',
      error: error.message
    });
  }
});

// @route   GET /api/votes/stats
// @desc    Get voting statistics
// @access  Public
router.get('/stats', async (req, res) => {
  try {
    const stats = await Vote.getVoteStats();
    
    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get vote stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get voting statistics',
      error: error.message
    });
  }
});

// @route   GET /api/votes/recent
// @desc    Get recent votes
// @access  Public
router.get('/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const votes = await Vote.getRecentVotes(limit);
    
    res.json({
      success: true,
      data: {
        votes,
        count: votes.length
      }
    });

  } catch (error) {
    console.error('Get recent votes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get recent votes',
      error: error.message
    });
  }
});

// @route   GET /api/votes/results
// @desc    Get detailed voting results
// @access  Public
router.get('/results', async (req, res) => {
  try {
    const stats = await Vote.getVoteStats();
    
    // Add percentage calculations
    const totalVotes = stats.summary.totalVotes;
    const candidatesWithPercentage = stats.candidates.map(candidate => ({
      ...candidate,
      percentage: totalVotes > 0 ? 
        parseFloat(((candidate.voteCount / totalVotes) * 100).toFixed(2)) : 0
    }));

    // Find winner
    const winner = candidatesWithPercentage.length > 0 ? 
      candidatesWithPercentage[0] : null;

    res.json({
      success: true,
      data: {
        candidates: candidatesWithPercentage,
        totalVotes,
        winner,
        summary: stats.summary
      }
    });

  } catch (error) {
    console.error('Get voting results error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get voting results',
      error: error.message
    });
  }
});

// @route   POST /api/votes/sync-blockchain
// @desc    Sync vote from blockchain transaction
// @access  Private
router.post('/sync-blockchain', auth, async (req, res) => {
  try {
    const {
      voterAddress,
      candidateId,
      transactionHash
    } = req.body;

    if (!voterAddress || !candidateId || !transactionHash) {
      return res.status(400).json({
        success: false,
        message: 'Voter address, candidate ID, and transaction hash are required'
      });
    }

    // Sync user vote status
    const user = await Vote.syncUserVoteStatus(voterAddress, candidateId, transactionHash);
    
    res.json({
      success: true,
      message: 'Vote status synced successfully',
      data: {
        user: user ? {
          id: user._id,
          username: user.username,
          hasVoted: user.hasVoted,
          votedFor: user.votedFor
        } : null
      }
    });

  } catch (error) {
    console.error('Sync blockchain vote error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync vote from blockchain',
      error: error.message
    });
  }
});

// @route   GET /api/votes/user/:address
// @desc    Get votes by wallet address
// @access  Public
router.get('/user/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wallet address'
      });
    }

    const votes = await Vote.find({ voterAddress: address.toLowerCase() })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: {
        votes,
        count: votes.length
      }
    });

  } catch (error) {
    console.error('Get user votes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user votes',
      error: error.message
    });
  }
});

// @route   GET /api/votes/candidate/:id
// @desc    Get votes for a specific candidate
// @access  Public
router.get('/candidate/:id', async (req, res) => {
  try {
    const candidateId = parseInt(req.params.id);
    
    if (isNaN(candidateId) || candidateId < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid candidate ID'
      });
    }

    const votes = await Vote.find({ 
      candidateId,
      status: 'confirmed' 
    })
    .select('voterUsername transactionHash createdAt')
    .sort({ createdAt: -1 })
    .lean();

    const voteCount = votes.length;
    
    res.json({
      success: true,
      data: {
        candidateId,
        voteCount,
        votes
      }
    });

  } catch (error) {
    console.error('Get candidate votes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get candidate votes',
      error: error.message
    });
  }
});

// @route   GET /api/votes/transaction/:hash
// @desc    Get vote by transaction hash
// @access  Public
router.get('/transaction/:hash', async (req, res) => {
  try {
    const { hash } = req.params;
    
    if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid transaction hash'
      });
    }

    const vote = await Vote.findOne({ transactionHash: hash.toLowerCase() })
      .populate('userId', 'username email')
      .lean();

    if (!vote) {
      return res.status(404).json({
        success: false,
        message: 'Vote not found for this transaction'
      });
    }

    res.json({
      success: true,
      data: {
        vote
      }
    });

  } catch (error) {
    console.error('Get vote by transaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get vote by transaction',
      error: error.message
    });
  }
});

// @route   DELETE /api/votes/:id
// @desc    Delete a vote (Admin only - for testing purposes)
// @access  Private/Admin
router.delete('/:id', auth, async (req, res) => {
  try {
    // Check if user is admin
    const user = await User.findById(req.user.id || req.user.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const vote = await Vote.findById(req.params.id);
    if (!vote) {
      return res.status(404).json({
        success: false,
        message: 'Vote not found'
      });
    }

    // Also update the user's vote status
    await User.findByIdAndUpdate(vote.userId, {
      hasVoted: false,
      votedFor: null,
      blockchainSynced: false
    });

    await Vote.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Vote deleted successfully'
    });

  } catch (error) {
    console.error('Delete vote error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete vote',
      error: error.message
    });
  }
});

module.exports = router;