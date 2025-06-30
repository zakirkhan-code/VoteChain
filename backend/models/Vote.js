const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
  voterAddress: {
    type: String,
    required: true
  },
  candidateId: {
    type: Number,
    required: true
  },
  candidateName: {
    type: String,
    required: true
  },
  transactionHash: {
    type: String,
    required: true,
    unique: true
  },
  blockNumber: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Vote', voteSchema);