const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
  voterAddress: {
    type: String,
    required: [true, 'Voter address is required'],
    lowercase: true,
    match: [/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'],
    index: true // Single index definition
  },
  voterUsername: {
    type: String,
    required: [true, 'Voter username is required']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  candidateId: {
    type: Number,
    required: [true, 'Candidate ID is required'],
    min: [1, 'Candidate ID must be positive'],
    index: true
  },
  candidateName: {
    type: String,
    required: [true, 'Candidate name is required'],
    trim: true
  },
  candidateParty: {
    type: String,
    trim: true
  },
  transactionHash: {
    type: String,
    required: [true, 'Transaction hash is required'],
    unique: true, // This automatically creates an index
    match: [/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash']
  },
  blockNumber: {
    type: Number,
    required: [true, 'Block number is required'],
    min: [0, 'Block number must be non-negative']
  },
  gasUsed: {
    type: Number,
    min: [0, 'Gas used must be non-negative']
  },
  gasPrice: {
    type: String // Wei mein store karenge as string
  },
  network: {
    type: String,
    default: 'sepolia',
    enum: ['localhost', 'sepolia', 'mainnet']
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'failed'],
    default: 'confirmed',
    index: true
  },
  confirmations: {
    type: Number,
    default: 1,
    min: [0, 'Confirmations must be non-negative']
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Only define compound indexes here (no single field indexes)
voteSchema.index({ voterAddress: 1, candidateId: 1 });
voteSchema.index({ candidateId: 1, status: 1 });
voteSchema.index({ createdAt: -1, status: 1 });

// Static method to get vote statistics
voteSchema.statics.getVoteStats = async function() {
  try {
    const stats = await this.aggregate([
      { $match: { status: 'confirmed' } },
      {
        $group: {
          _id: '$candidateId',
          candidateName: { $first: '$candidateName' },
          candidateParty: { $first: '$candidateParty' },
          voteCount: { $sum: 1 },
          voters: { $addToSet: '$voterAddress' }
        }
      },
      {
        $project: {
          candidateId: '$_id',
          candidateName: 1,
          candidateParty: 1,
          voteCount: 1,
          uniqueVoters: { $size: '$voters' },
          _id: 0
        }
      },
      { $sort: { voteCount: -1 } }
    ]);
    
    // Get total votes and summary
    const totalVotes = await this.countDocuments({ status: 'confirmed' });
    const User = mongoose.model('User');
    const registeredVoters = await User.countDocuments({ isRegistered: true });
    
    const summary = {
      totalVotes,
      registeredVoters,
      turnoutPercentage: registeredVoters > 0 ? 
        parseFloat(((totalVotes / registeredVoters) * 100).toFixed(2)) : 0
    };
    
    return { candidates: stats, summary };
  } catch (error) {
    throw error;
  }
};

// Static method to get recent votes
voteSchema.statics.getRecentVotes = function(limit = 10) {
  return this.find({ status: 'confirmed' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('voterUsername candidateName candidateParty transactionHash createdAt')
    .lean();
};

// Method to update vote status
voteSchema.methods.updateStatus = async function(status, confirmations = 0) {
  this.status = status;
  this.confirmations = confirmations;
  return await this.save();
};

// Static method to sync user vote status
voteSchema.statics.syncUserVoteStatus = async function(voterAddress, candidateId, transactionHash) {
  try {
    const User = mongoose.model('User');
    const user = await User.findOne({ walletAddress: voterAddress });
    
    if (user && !user.hasVoted) {
      user.hasVoted = true;
      user.votedFor = candidateId;
      user.blockchainSynced = true;
      user.lastBlockchainSync = new Date();
      await user.save();
      
      console.log('User vote status synced:', {
        userId: user._id,
        username: user.username,
        votedFor: candidateId,
        transactionHash
      });
    }
    
    return user;
  } catch (error) {
    console.error('Error syncing user vote status:', error);
    throw error;
  }
};

module.exports = mongoose.model('Vote', voteSchema);