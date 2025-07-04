const express = require('express');
const User = require('../models/User');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// ✅ WebSocket functions will be available via middleware
let broadcastToAdmins;

// ✅ MIDDLEWARE TO GET WEBSOCKET FUNCTIONS
router.use((req, res, next) => {
  broadcastToAdmins = req.broadcastToAdmins;
  next();
});

// @route   GET /api/users
// @desc    Get all users (Admin only)
// @access  Private/Admin
router.get('/', [auth, adminAuth], async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.isRegistered !== undefined) filter.isRegistered = req.query.isRegistered === 'true';
    if (req.query.hasVoted !== undefined) filter.hasVoted = req.query.hasVoted === 'true';

    // Get users with pagination
    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalUsers = await User.countDocuments(filter);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalUsers / limit),
          totalUsers,
          hasNextPage: page < Math.ceil(totalUsers / limit),
          hasPrevPage: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
});

// @route   GET /api/users/stats
// @desc    Get user statistics (Admin only)
// @access  Private/Admin
router.get('/stats', [auth, adminAuth], async (req, res) => {
  try {
    // Use aggregation pipeline for better performance
    const stats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          totalVoters: { $sum: { $cond: [{ $eq: ['$role', 'voter'] }, 1, 0] } },
          totalAdmins: { $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] } },
          registeredVoters: { $sum: { $cond: ['$isRegistered', 1, 0] } },
          totalVotes: { $sum: { $cond: ['$hasVoted', 1, 0] } },
          activeUsers: { $sum: { $cond: [{ $ifNull: ['$isActive', true] }, 1, 0] } }
        }
      }
    ]);

    const result = stats[0] || {
      totalUsers: 0,
      totalVoters: 0,
      totalAdmins: 0,
      registeredVoters: 0,
      totalVotes: 0,
      activeUsers: 0
    };

    // Calculate additional metrics
    result.registrationRate = result.totalVoters > 0 ? 
      parseFloat(((result.registeredVoters / result.totalVoters) * 100).toFixed(2)) : 0;
    
    result.turnoutPercentage = result.registeredVoters > 0 ? 
      parseFloat(((result.totalVotes / result.registeredVoters) * 100).toFixed(2)) : 0;

    // ✅ BROADCAST STATS UPDATE
    if (broadcastToAdmins) {
      broadcastToAdmins({
        type: 'STATS_UPDATED',
        stats: result
      });
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user statistics',
      error: error.message
    });
  }
});

// @route   GET /api/users/:id
// @desc    Get specific user (Admin only)
// @access  Private/Admin
router.get('/:id', [auth, adminAuth], async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: { user }
    });

  } catch (error) {
    console.error('Get user error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: error.message
    });
  }
});

// @route   PUT /api/users/:id/promote-admin
// @desc    Promote user to admin (Admin only)
// @access  Private/Admin
router.put('/:id/promote-admin', [auth, adminAuth], async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'User is already an admin'
      });
    }

    // ✅ MANUAL UPDATE WITH EVENTS
    const wasRole = user.role;
    user.role = 'admin';
    user.isRegistered = true; // Admin users are auto-registered
    await user.save();

    // ✅ EMIT WEBSOCKET EVENT
    if (broadcastToAdmins && wasRole !== 'admin') {
      broadcastToAdmins({
        type: 'USER_ROLE_CHANGED',
        userId: user._id,
        username: user.username,
        oldRole: wasRole,
        newRole: user.role
      });
    }

    // Return user without password
    const updatedUser = await User.findById(req.params.id).select('-password');

    res.json({
      success: true,
      message: 'User promoted to admin successfully',
      data: { user: updatedUser }
    });

  } catch (error) {
    console.error('Promote admin error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to promote user',
      error: error.message
    });
  }
});

// @route   PUT /api/users/:id/demote-admin
// @desc    Demote admin to voter (Admin only)
// @access  Private/Admin
router.put('/:id/demote-admin', [auth, adminAuth], async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'User is not an admin'
      });
    }

    // Don't allow admin to demote themselves
    const currentUserId = req.user.id || req.user.userId;
    if (user._id.toString() === currentUserId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot demote yourself'
      });
    }

    // ✅ MANUAL UPDATE WITH EVENTS
    const wasRole = user.role;
    user.role = 'voter';
    user.isRegistered = false; // Reset registration status
    await user.save();

    // ✅ EMIT WEBSOCKET EVENT
    if (broadcastToAdmins) {
      broadcastToAdmins({
        type: 'USER_ROLE_CHANGED',
        userId: user._id,
        username: user.username,
        oldRole: wasRole,
        newRole: user.role
      });
    }

    // Return user without password
    const updatedUser = await User.findById(req.params.id).select('-password');

    res.json({
      success: true,
      message: 'Admin demoted to voter successfully',
      data: { user: updatedUser }
    });

  } catch (error) {
    console.error('Demote admin error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to demote admin',
      error: error.message
    });
  }
});

// @route   PUT /api/users/:id/register
// @desc    Register user for voting (Admin only)
// @access  Private/Admin
router.put('/:id/register', [auth, adminAuth], async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.isRegistered) {
      return res.status(400).json({
        success: false,
        message: 'User is already registered for voting'
      });
    }

    // ✅ MANUAL UPDATE WITH EVENTS
    const wasRegistered = user.isRegistered;
    user.isRegistered = true;
    await user.save();

    // ✅ EMIT WEBSOCKET EVENT
    if (broadcastToAdmins && !wasRegistered) {
      broadcastToAdmins({
        type: 'USER_REGISTERED',
        userId: user._id,
        username: user.username,
        walletAddress: user.walletAddress
      });
    }

    // Return user without password
    const updatedUser = await User.findById(req.params.id).select('-password');

    res.json({
      success: true,
      message: 'User registered for voting successfully',
      data: { user: updatedUser }
    });

  } catch (error) {
    console.error('Register user error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to register user',
      error: error.message
    });
  }
});

// @route   PUT /api/users/:id/unregister
// @desc    Unregister user from voting (Admin only)
// @access  Private/Admin
router.put('/:id/unregister', [auth, adminAuth], async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.hasVoted) {
      return res.status(400).json({
        success: false,
        message: 'Cannot unregister user who has already voted'
      });
    }

    // ✅ MANUAL UPDATE WITH EVENTS
    const wasRegistered = user.isRegistered;
    user.isRegistered = false;
    await user.save();

    // ✅ EMIT WEBSOCKET EVENT
    if (broadcastToAdmins && wasRegistered) {
      broadcastToAdmins({
        type: 'USER_UNREGISTERED',
        userId: user._id,
        username: user.username
      });
    }

    // Return user without password
    const updatedUser = await User.findById(req.params.id).select('-password');

    res.json({
      success: true,
      message: 'User unregistered from voting successfully',
      data: { user: updatedUser }
    });

  } catch (error) {
    console.error('Unregister user error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to unregister user',
      error: error.message
    });
  }
});

// @route   PUT /api/users/:id/toggle-status
// @desc    Toggle user active status (Admin only)
// @access  Private/Admin
router.put('/:id/toggle-status', [auth, adminAuth], async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Default isActive to true if undefined
    const wasActive = user.isActive;
    user.isActive = user.isActive !== undefined ? !user.isActive : false;
    await user.save();

    // ✅ EMIT WEBSOCKET EVENT
    if (broadcastToAdmins) {
      broadcastToAdmins({
        type: 'USER_STATUS_CHANGED',
        userId: user._id,
        username: user.username,
        isActive: user.isActive,
        wasActive: wasActive
      });
    }

    // Return user without password
    const updatedUser = await User.findById(req.params.id).select('-password');

    res.json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      data: { user: updatedUser }
    });

  } catch (error) {
    console.error('Toggle user status error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to toggle user status',
      error: error.message
    });
  }
});

// @route   DELETE /api/users/:id
// @desc    Delete user (Admin only)
// @access  Private/Admin
router.delete('/:id', [auth, adminAuth], async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Don't allow deletion of users who have voted
    if (user.hasVoted) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete user who has voted'
      });
    }

    // Don't allow admin to delete themselves
    const currentUserId = req.user.id || req.user.userId;
    if (user._id.toString() === currentUserId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    // ✅ STORE INFO BEFORE DELETION
    const userInfo = {
      _id: user._id,
      username: user.username,
      email: user.email
    };

    await User.findByIdAndDelete(req.params.id);

    // ✅ EMIT WEBSOCKET EVENT
    if (broadcastToAdmins) {
      broadcastToAdmins({
        type: 'USER_DELETED',
        userId: userInfo._id,
        username: userInfo.username
      });
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message
    });
  }
});

// @route   GET /api/users/search/:query
// @desc    Search users (Admin only)
// @access  Private/Admin
router.get('/search/:query', [auth, adminAuth], async (req, res) => {
  try {
    const { query } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters long'
      });
    }

    const searchRegex = new RegExp(query.trim(), 'i');
    const users = await User.find({
      $or: [
        { username: searchRegex },
        { email: searchRegex },
        { 'profile.firstName': searchRegex },
        { 'profile.lastName': searchRegex },
        { walletAddress: searchRegex }
      ]
    })
    .select('-password')
    .limit(limit)
    .lean();

    res.json({
      success: true,
      data: { 
        users, 
        count: users.length,
        query: query.trim()
      }
    });

  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search users',
      error: error.message
    });
  }
});

// @route   GET /api/users/export
// @desc    Export users data (Admin only)
// @access  Private/Admin
router.get('/export', [auth, adminAuth], async (req, res) => {
  try {
    const format = req.query.format || 'json';
    
    const users = await User.find()
      .select('-password -__v')
      .sort({ createdAt: -1 })
      .lean();

    if (format === 'csv') {
      // Simple CSV export
      const csvHeaders = 'ID,Username,Email,Role,Registered,HasVoted,WalletAddress,CreatedAt\n';
      const csvData = users.map(user => 
        `${user._id},${user.username},${user.email},${user.role},${user.isRegistered},${user.hasVoted},${user.walletAddress || ''},${user.createdAt}`
      ).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
      res.send(csvHeaders + csvData);
    } else {
      res.json({
        success: true,
        data: {
          users,
          exportedAt: new Date().toISOString(),
          totalCount: users.length
        }
      });
    }

  } catch (error) {
    console.error('Export users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export users',
      error: error.message
    });
  }
});

module.exports = router;