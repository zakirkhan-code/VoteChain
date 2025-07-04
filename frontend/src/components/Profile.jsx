import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Wallet, Edit, Save, X, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWeb3 } from '../context/Web3Context';
import { useToast } from '../context/ToastContext';
import { shortenAddress } from '../utils/web3';

const Profile = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    dateOfBirth: ''
  });
  const [userVoteInfo, setUserVoteInfo] = useState({
    hasVoted: false,
    votedFor: null,
    vote: null
  });
  const [loading, setLoading] = useState(false);

  const { user, updateProfile, api, refreshUserData } = useAuth();
  const { account, isConnected } = useWeb3();
  const { success, error } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    // Initialize form data with proper handling of nested profile object
    setFormData({
      firstName: user.profile?.firstName || '',
      lastName: user.profile?.lastName || '',
      phone: user.profile?.phone || '',
      dateOfBirth: user.profile?.dateOfBirth ? 
        new Date(user.profile.dateOfBirth).toISOString().split('T')[0] : ''
    });

    fetchVoteInfo();
  }, [user, navigate]);

  const fetchVoteInfo = async () => {
    try {
      const response = await api.get('/votes/my-vote');
      if (response.data.success) {
        setUserVoteInfo(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch vote info:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      
      // Prepare profile data
      const profileData = {
        profile: {
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          phone: formData.phone.trim(),
          dateOfBirth: formData.dateOfBirth || null
        }
      };

      console.log('Updating profile with data:', profileData);

      await updateProfile(profileData);
      
      // Refresh user data to get latest updates
      await refreshUserData();
      
      success('Profile updated successfully');
      setIsEditing(false);
    } catch (err) {
      console.error('Profile update error:', err);
      error(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // Reset form data to original values
    setFormData({
      firstName: user.profile?.firstName || '',
      lastName: user.profile?.lastName || '',
      phone: user.profile?.phone || '',
      dateOfBirth: user.profile?.dateOfBirth ? 
        new Date(user.profile.dateOfBirth).toISOString().split('T')[0] : ''
    });
    setIsEditing(false);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="loading-spinner w-8 h-8"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center space-x-4">
          <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
            <User className="w-10 h-10 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{user.username}</h1>
            <p className="text-blue-100">{user.email}</p>
            <div className="flex items-center space-x-2 mt-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                user.role === 'admin' 
                  ? 'bg-red-100 text-red-800' 
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {user.role === 'admin' ? 'Administrator' : 'Voter'}
              </span>
              {user.profile?.firstName && user.profile?.lastName && (
                <span className="text-sm text-blue-100">
                  {user.profile.firstName} {user.profile.lastName}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Information */}
        <div className="lg:col-span-2 card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Profile Information</h2>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="btn-outline flex items-center space-x-2"
              >
                <Edit className="w-4 h-4" />
                <span>Edit</span>
              </button>
            ) : (
              <div className="flex space-x-2">
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="btn-primary flex items-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>{loading ? 'Saving...' : 'Save'}</span>
                </button>
                <button
                  onClick={handleCancel}
                  disabled={loading}
                  className="btn-secondary flex items-center space-x-2"
                >
                  <X className="w-4 h-4" />
                  <span>Cancel</span>
                </button>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {/* Basic Info */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={user.username}
                    disabled
                    className="input-field bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={user.email}
                    disabled
                    className="input-field bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className={`input-field ${!isEditing ? 'bg-gray-50' : ''}`}
                    placeholder="Enter first name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className={`input-field ${!isEditing ? 'bg-gray-50' : ''}`}
                    placeholder="Enter last name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className={`input-field ${!isEditing ? 'bg-gray-50' : ''}`}
                    placeholder="Enter phone number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className={`input-field ${!isEditing ? 'bg-gray-50' : ''}`}
                  />
                </div>
              </div>
            </div>

            {/* Wallet Info */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Wallet Information</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Wallet className="w-5 h-5 text-gray-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Registered Wallet
                      </p>
                      <p className="text-sm text-gray-600">
                        {user.walletAddress ? shortenAddress(user.walletAddress) : 'Not connected'}
                      </p>
                    </div>
                  </div>
                  {isConnected && account?.toLowerCase() === user.walletAddress?.toLowerCase() ? (
                    <span className="badge badge-success">Connected</span>
                  ) : (
                    <span className="badge badge-warning">Not Connected</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Status & Activity */}
        <div className="space-y-6">
          {/* Account Status */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">Account Status</h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Registration Status</span>
                <span className={`badge ${user.isRegistered ? 'badge-success' : 'badge-warning'}`}>
                  {user.isRegistered ? 'Registered' : 'Not Registered'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Voting Status</span>
                <span className={`badge ${user.hasVoted ? 'badge-success' : 'badge-warning'}`}>
                  {user.hasVoted ? 'Voted' : 'Not Voted'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Account Type</span>
                <span className={`badge ${user.role === 'admin' ? 'badge-danger' : 'badge-info'}`}>
                  {user.role === 'admin' ? 'Administrator' : 'Voter'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Member Since</span>
                <span className="text-sm font-medium text-gray-900">
                  {new Date(user.createdAt).toLocaleDateString()}
                </span>
              </div>

              {user.profile?.lastUpdated && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Profile Updated</span>
                  <span className="text-sm font-medium text-gray-900">
                    {new Date(user.profile.lastUpdated).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Voting History */}
          {userVoteInfo.hasVoted && userVoteInfo.vote && (
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold text-gray-900">Voting History</h3>
              </div>
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-green-900">
                        Voted for {userVoteInfo.vote.candidateName}
                      </p>
                      <p className="text-xs text-green-700">
                        {userVoteInfo.vote.candidateParty}
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        {new Date(userVoteInfo.vote.createdAt).toLocaleString()}
                      </p>
                      {userVoteInfo.vote.transactionHash && (
                        <a
                          href={`https://sepolia.etherscan.io/tx/${userVoteInfo.vote.transactionHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-green-600 underline"
                        >
                          View on Etherscan
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Security */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">Security</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center text-sm text-gray-600">
                <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                <span>Email verified</span>
              </div>
              {user.walletAddress && (
                <div className="flex items-center text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  <span>Wallet connected</span>
                </div>
              )}
              <div className="flex items-center text-sm text-gray-600">
                <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                <span>Password protected</span>
              </div>
              {user.isActive && (
                <div className="flex items-center text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  <span>Account active</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
              >
                Go to Dashboard
              </button>
              <button
                onClick={() => navigate('/results')}
                className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
              >
                View Results
              </button>
              {user.role === 'admin' && (
                <button
                  onClick={() => navigate('/admin')}
                  className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                >
                  Admin Panel
                </button>
              )}
              {!user.hasVoted && user.isRegistered && (
                <button
                  onClick={() => navigate('/vote')}
                  className="w-full text-left px-3 py-2 text-sm text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200"
                >
                  Cast Your Vote
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Profile Completion Status */}
      <div className="bg-blue-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-blue-900 mb-4">Profile Completion</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-blue-800">Basic Information</span>
            <span className="text-blue-600">✓ Complete</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-blue-800">Personal Details</span>
            <span className={formData.firstName && formData.lastName ? "text-green-600" : "text-orange-600"}>
              {formData.firstName && formData.lastName ? "✓ Complete" : "⚠ Incomplete"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-blue-800">Wallet Connection</span>
            <span className={user.walletAddress ? "text-green-600" : "text-orange-600"}>
              {user.walletAddress ? "✓ Connected" : "⚠ Not Connected"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-blue-800">Voting Registration</span>
            <span className={user.isRegistered ? "text-green-600" : "text-orange-600"}>
              {user.isRegistered ? "✓ Registered" : "⚠ Pending"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;