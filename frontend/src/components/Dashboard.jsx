import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Vote, Users, TrendingUp, CheckCircle, Clock, AlertCircle, Wallet, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWeb3 } from '../context/Web3Context';
import { useToast } from '../context/ToastContext';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalVotes: 0,
    totalCandidates: 0,
    registeredVoters: 0,
    turnoutPercentage: 0
  });
  const [recentVotes, setRecentVotes] = useState([]);
  const [votingStatus, setVotingStatus] = useState({
    votingActive: false,
    candidateCount: 0
  });
  const [loading, setLoading] = useState(true);

  const { user, isAuthenticated, api } = useAuth();
  const { account, isConnected, connectWallet } = useWeb3();
  const { error } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
    fetchDashboardData();
  }, [isAuthenticated, navigate]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch voting statistics
      const [statsResponse, recentResponse, statusResponse] = await Promise.all([
        api.get('/votes/stats'),
        api.get('/votes/recent?limit=5'),
        api.get('/blockchain/voting-status')
      ]);

      if (statsResponse.data.success) {
        setStats(statsResponse.data.data.summary);
      }

      if (recentResponse.data.success) {
        setRecentVotes(recentResponse.data.data.votes);
      }

      if (statusResponse.data.success) {
        setVotingStatus(statusResponse.data.data);
      }

    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectWallet = async () => {
    try {
      await connectWallet();
    } catch (err) {
      error('Failed to connect wallet');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="loading-spinner w-8 h-8"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
        <h1 className="text-3xl font-bold mb-2">
          Welcome back, {user?.username}!
        </h1>
        <p className="text-blue-100">
          {user?.role === 'admin' ? 'Manage your voting system' : 'Your voice matters in the democratic process'}
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Voting Status */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Voting Status</p>
              <p className={`text-2xl font-bold ${votingStatus.votingActive ? 'text-green-600' : 'text-red-600'}`}>
                {votingStatus.votingActive ? 'Active' : 'Inactive'}
              </p>
            </div>
            <div className={`p-3 rounded-full ${votingStatus.votingActive ? 'bg-green-100' : 'bg-red-100'}`}>
              {votingStatus.votingActive ? 
                <CheckCircle className="w-6 h-6 text-green-600" /> :
                <Clock className="w-6 h-6 text-red-600" />
              }
            </div>
          </div>
        </div>

        {/* Total Votes */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Votes</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalVotes}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Vote className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Registered Voters */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Registered Voters</p>
              <p className="text-2xl font-bold text-gray-900">{stats.registeredVoters}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Turnout */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Turnout</p>
              <p className="text-2xl font-bold text-gray-900">{stats.turnoutPercentage}%</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Wallet Connection Alert */}
      {!isConnected && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-orange-600 mr-3" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-orange-800">
                Wallet Not Connected
              </h3>
              <p className="text-sm text-orange-700 mt-1">
                Connect your wallet to participate in voting
              </p>
            </div>
            <button
              onClick={handleConnectWallet}
              className="btn-primary text-sm ml-4"
            >
              Connect Wallet
            </button>
          </div>
        </div>
      )}

      {/* User Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Info Card */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900">Your Status</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Account Type</span>
              <span className={`badge ${user?.role === 'admin' ? 'badge-danger' : 'badge-info'}`}>
                {user?.role === 'admin' ? 'Administrator' : 'Voter'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Registration Status</span>
              <span className={`badge ${user?.isRegistered ? 'badge-success' : 'badge-warning'}`}>
                {user?.isRegistered ? 'Registered' : 'Not Registered'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Voting Status</span>
              <span className={`badge ${user?.hasVoted ? 'badge-success' : 'badge-warning'}`}>
                {user?.hasVoted ? 'Voted' : 'Not Voted'}
              </span>
            </div>
            {isConnected && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Wallet</span>
                <span className="text-sm font-medium text-gray-900">
                  {account?.slice(0, 6)}...{account?.slice(-4)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
          </div>
          <div className="space-y-3">
            {votingStatus.votingActive && user?.isRegistered && !user?.hasVoted && (
              <Link
                to="/vote"
                className="flex items-center p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors duration-200"
              >
                <Vote className="w-5 h-5 text-blue-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Cast Your Vote</p>
                  <p className="text-xs text-blue-700">Voting is currently active</p>
                </div>
              </Link>
            )}
            
            <Link
              to="/results"
              className="flex items-center p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors duration-200"
            >
              <TrendingUp className="w-5 h-5 text-green-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-green-900">View Results</p>
                <p className="text-xs text-green-700">Real-time voting results</p>
              </div>
            </Link>

            {user?.role === 'admin' && (
              <Link
                to="/admin"
                className="flex items-center p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors duration-200"
              >
                <Shield className="w-5 h-5 text-purple-600 mr-3" />
                <div>
                  <p className="text-sm font-medium text-purple-900">Admin Panel</p>
                  <p className="text-xs text-purple-700">Manage voting system</p>
                </div>
              </Link>
            )}

            {!isConnected && (
              <button
                onClick={handleConnectWallet}
                className="flex items-center w-full p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors duration-200"
              >
                <Wallet className="w-5 h-5 text-orange-600 mr-3" />
                <div className="text-left">
                  <p className="text-sm font-medium text-orange-900">Connect Wallet</p>
                  <p className="text-xs text-orange-700">Required for voting</p>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      {recentVotes.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900">Recent Votes</h2>
          </div>
          <div className="space-y-3">
            {recentVotes.map((vote, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Vote className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {vote.voterUsername} voted for {vote.candidateName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(vote.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <span className="badge badge-success">Confirmed</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Need Help?</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Vote className="w-6 h-6 text-blue-600" />
            </div>
            <h4 className="font-medium text-gray-900 mb-2">How to Vote</h4>
            <p className="text-sm text-gray-600">
              Connect your wallet and select your preferred candidate
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Shield className="w-6 h-6 text-green-600" />
            </div>
            <h4 className="font-medium text-gray-900 mb-2">Security</h4>
            <p className="text-sm text-gray-600">
              All votes are secured by blockchain technology
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <h4 className="font-medium text-gray-900 mb-2">Transparency</h4>
            <p className="text-sm text-gray-600">
              View real-time results and transaction history
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;