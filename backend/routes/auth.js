// backend/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, walletAddress } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase().trim() },
        { username: username.trim() }
      ]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or username already exists'
      });
    }

    // Check wallet address if provided
    if (walletAddress) {
      const existingWallet = await User.findOne({ walletAddress: walletAddress.toLowerCase() });
      if (existingWallet) {
        return res.status(400).json({
          success: false,
          message: 'This wallet address is already registered'
        });
      }
    }

    // Create user
    const user = new User({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password, // Will be hashed by pre-save middleware
      walletAddress: walletAddress?.trim() || null,
      role: 'voter',
      isRegistered: false,
      hasVoted: false,
      isActive: true,
      profile: {
        firstName: '',
        lastName: '',
        phone: '',
        dateOfBirth: null,
        isActive: true,
        lastLogin: new Date(),
        lastUpdated: new Date()
      }
    });

    await user.save();

    // Generate JWT
    const payload = {
      id: user._id,
      userId: user._id,
      username: user.username,
      email: user.email,
      role: user.role
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        token,
        user: user.toJSON()
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const user = await User.findOne({ 
      email: email.toLowerCase().trim() 
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    if (!user.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Account is deactivated. Please contact administrator.'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last login
    user.profile.lastLogin = new Date();
    await user.save();

    const payload = {
      id: user._id,
      userId: user._id,
      username: user.username,
      email: user.email,
      role: user.role
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: user.toJSON()
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { username, email, walletAddress, profile = {} } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const updateData = {};
    
    // Update username if provided
    if (username !== undefined && username.trim() !== user.username) {
      const trimmedUsername = username.trim();
      if (!trimmedUsername) {
        return res.status(400).json({
          success: false,
          message: 'Username cannot be empty'
        });
      }
      
      const existingUser = await User.findOne({ 
        username: trimmedUsername,
        _id: { $ne: userId }
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username already taken'
        });
      }
      
      updateData.username = trimmedUsername;
    }

    // Update email if provided
    if (email !== undefined && email.toLowerCase().trim() !== user.email) {
      const trimmedEmail = email.toLowerCase().trim();
      if (!trimmedEmail) {
        return res.status(400).json({
          success: false,
          message: 'Email cannot be empty'
        });
      }
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }
      
      const existingUser = await User.findOne({ 
        email: trimmedEmail,
        _id: { $ne: userId }
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already taken'
        });
      }
      
      updateData.email = trimmedEmail;
    }

    // Update wallet address if provided
    if (walletAddress !== undefined) {
      const trimmedAddress = walletAddress?.trim() || null;
      if (trimmedAddress && trimmedAddress.length > 0) {
        if (!/^0x[a-fA-F0-9]{40}$/.test(trimmedAddress)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid wallet address format'
          });
        }
        
        const existingWallet = await User.findOne({ 
          walletAddress: trimmedAddress,
          _id: { $ne: userId }
        });
        
        if (existingWallet) {
          return res.status(400).json({
            success: false,
            message: 'Wallet address already registered'
          });
        }
      }
      updateData.walletAddress = trimmedAddress;
    }

    // Update profile fields
    if (profile && typeof profile === 'object') {
      updateData.profile = { 
        ...user.profile,
        ...profile,
        lastUpdated: new Date()
      };
    }

    // If no updates, return current user
    if (Object.keys(updateData).length === 0) {
      return res.json({
        success: true,
        message: 'No changes to update',
        data: {
          user: user.toJSON()
        }
      });
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { 
        new: true,
        runValidators: true
      }
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: updatedUser.toJSON()
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
});

// @route   GET /api/auth/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id || req.user.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user: user.toJSON()
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile',
      error: error.message
    });
  }
});

// @route   POST /api/auth/verify-token
// @desc    Verify JWT token
// @access  Private
router.post('/verify-token', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id || req.user.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    res.json({
      success: true,
      message: 'Token is valid',
      data: {
        user: user.toJSON()
      }
    });

  } catch (error) {
    console.error('Verify token error:', error);
    res.status(500).json({
      success: false,
      message: 'Token verification failed',
      error: error.message
    });
  }
});

module.exports = router;