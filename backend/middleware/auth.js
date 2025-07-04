const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Basic authentication middleware
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'Access denied. No token provided.' 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid token or user not found' 
      });
    }

    // Add user to request object
    req.user = user;
    req.userId = user._id;
    req.userRole = user.role;
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ 
      success: false,
      message: 'Invalid token' 
    });
  }
};

// Admin-only middleware
const adminAuth = async (req, res, next) => {
  try {
    // Pehle basic auth check karo
    await auth(req, res, () => {});
    
    // Check if user is admin
    if (req.userRole !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied. Admin privileges required.' 
      });
    }
    
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(403).json({ 
      success: false,
      message: 'Access denied' 
    });
  }
};

// Wallet verification middleware
const verifyWallet = async (req, res, next) => {
  try {
    const { walletAddress } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address is required'
      });
    }
    
    // Check if wallet address matches user's wallet
    if (req.user.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: 'Wallet address mismatch'
      });
    }
    
    next();
  } catch (error) {
    console.error('Wallet verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Wallet verification failed'
    });
  }
};

// Rate limiting middleware (simple implementation)
const rateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const identifier = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    if (!requests.has(identifier)) {
      requests.set(identifier, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    const requestInfo = requests.get(identifier);
    
    if (now > requestInfo.resetTime) {
      requestInfo.count = 1;
      requestInfo.resetTime = now + windowMs;
      return next();
    }
    
    if (requestInfo.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.'
      });
    }
    
    requestInfo.count++;
    next();
  };
};

module.exports = {
  auth,
  adminAuth,
  verifyWallet,
  rateLimit
};