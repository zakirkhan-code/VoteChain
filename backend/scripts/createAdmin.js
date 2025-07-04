require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const createAdmin = async () => {
  try {
    // MongoDB connection
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/votechain');
    console.log('✅ Connected to MongoDB');

    // Admin user data
    const adminData = {
      username: 'admin',
      email: 'admin@votechain.com',
      password: 'admin123', // Will be hashed automatically
      walletAddress: '0x31fDE8Da4747B34C3bA910126c0B823c1f87333B', // Replace with your admin wallet
      role: 'admin',
      isRegistered: true,
      profile: {
        firstName: 'Admin',
        lastName: 'User'
      }
    };

    // Check if admin already exists
    const existingAdmin = await User.findOne({ 
      $or: [
        { email: adminData.email },
        { username: adminData.username }
      ]
    });

    if (existingAdmin) {
      console.log('❌ Admin user already exists');
      console.log('Username:', existingAdmin.username);
      console.log('Email:', existingAdmin.email);
      console.log('Role:', existingAdmin.role);
      return;
    }

    // Create admin user
    const admin = new User(adminData);
    await admin.save();

    console.log('✅ Admin user created successfully!');
    console.log('Username:', admin.username);
    console.log('Email:', admin.email);
    console.log('Role:', admin.role);
    console.log('Wallet:', admin.walletAddress);

  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('📝 Database connection closed');
  }
};

createAdmin();