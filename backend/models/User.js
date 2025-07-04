const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ✅ FIXED: Remove WebSocket import to prevent circular dependency
// ❌ DON'T DO THIS: const { broadcastToAdmins } = require('../websocket-handler');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['voter', 'admin'],
    default: 'voter'
  },
  isRegistered: {
    type: Boolean,
    default: false
  },
  hasVoted: {
    type: Boolean,
    default: false
  },
  votedFor: {
    type: Number,
    default: null
  },
  walletAddress: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// ✅ PASSWORD HASHING MIDDLEWARE
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// ✅ FIXED: Remove auto WebSocket events from model
// WebSocket events will be handled manually in routes where we have access to broadcast functions

// ✅ SIMPLE CHANGE DETECTION (for routes to use)
userSchema.methods.getChanges = function() {
  return {
    isNew: this.isNew,
    modifiedPaths: this.modifiedPaths(),
    wasRegistered: this._wasRegistered,
    hadVoted: this._hadVoted
  };
};

// ✅ TRACK CHANGES FOR MANUAL EVENT EMISSION
userSchema.pre('save', function(next) {
  // Store previous values for change detection
  if (!this.isNew) {
    this._wasRegistered = this.isRegistered;
    this._hadVoted = this.hasVoted;
  }
  next();
});

// ✅ PASSWORD COMPARISON METHOD
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ✅ EXCLUDE PASSWORD FROM JSON
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user._wasRegistered; // Remove internal tracking fields
  delete user._hadVoted;
  return user;
};

// ✅ STATIC METHOD FOR SAFE USER UPDATES WITH EVENTS
userSchema.statics.updateWithEvents = async function(userId, updates, broadcastFn = null) {
  const user = await this.findById(userId);
  if (!user) throw new Error('User not found');
  
  // Track changes
  const wasNew = user.isNew;
  const wasRegistered = user.isRegistered;
  const hadVoted = user.hasVoted;
  
  // Apply updates
  Object.assign(user, updates);
  
  // Save user
  const savedUser = await user.save();
  
  // Emit events if broadcast function provided
  if (broadcastFn) {
    if (wasNew) {
      broadcastFn({
        type: 'USER_CREATED',
        user: savedUser.toJSON()
      });
    } else {
      if (!wasRegistered && savedUser.isRegistered) {
        broadcastFn({
          type: 'USER_REGISTERED',
          userId: savedUser._id,
          username: savedUser.username,
          walletAddress: savedUser.walletAddress
        });
      }
      
      if (!hadVoted && savedUser.hasVoted) {
        broadcastFn({
          type: 'USER_VOTED',
          userId: savedUser._id,
          username: savedUser.username,
          candidateId: savedUser.votedFor
        });
      }
    }
  }
  
  return savedUser;
};

// ✅ STATIC METHOD FOR SAFE USER DELETION WITH EVENTS
userSchema.statics.deleteWithEvents = async function(userId, broadcastFn = null) {
  const user = await this.findById(userId);
  if (!user) throw new Error('User not found');
  
  const userInfo = {
    _id: user._id,
    username: user.username,
    email: user.email
  };
  
  await this.findByIdAndDelete(userId);
  
  // Emit deletion event
  if (broadcastFn) {
    broadcastFn({
      type: 'USER_DELETED',
      userId: userInfo._id,
      username: userInfo.username
    });
  }
  
  return userInfo;
};

module.exports = mongoose.model('User', userSchema);