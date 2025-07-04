require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const updateUserToAdmin = async () => {
  try {
    // MongoDB connection
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/votechain');
    console.log('✅ Connected to MongoDB');

    // Find user by email
    const userEmail = 'admin@votechain.com';
    const user = await User.findOne({ email: userEmail });

    if (!user) {
      console.log('❌ User not found with email:', userEmail);
      return;
    }

    console.log('📋 Current user details:');
    console.log('Username:', user.username);
    console.log('Email:', user.email);
    console.log('Current Role:', user.role);
    console.log('Is Registered:', user.isRegistered);

    // Update user to admin
    user.role = 'admin';
    user.isRegistered = true; // Admin should be auto-registered
    await user.save();

    console.log('✅ User updated successfully!');
    console.log('New Role:', user.role);
    console.log('Is Registered:', user.isRegistered);

  } catch (error) {
    console.error('❌ Error updating user:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('📝 Database connection closed');
  }
};

updateUserToAdmin();