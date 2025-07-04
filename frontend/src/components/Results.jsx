import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, Trophy, RefreshCw, ExternalLink, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const Results = () => {
  const [results, setResults] = useState({
    candidates: [],
    totalVotes: 0,
    winner: null
  });
  const [recentVotes, setRecentVotes] = useState([]);
  const [stats, setStats] = useState({
    totalVotes: 0,
    registeredVoters: 0,
    turnoutPercentage: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { api } = useAuth();
  const { error } = useToast();

  useEffect(() => {
    fetchResults();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchResults(true);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchResults = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // Fetch blockchain results
      const [resultsResponse, recentResponse, statsResponse] = await Promise.all([
        api.get('/blockchain/results'),
        api.get('/votes/recent?limit=10'),
        api.get('/votes/stats')
      ]);

      if (resultsResponse.data.success) {
        setResults(resultsResponse.data.data);
      }

      if (recentResponse.data.success) {
        setRecentVotes(recentResponse.data.data.votes);
      }

      if (statsResponse.data.success) {
        setStats(statsResponse.data.data.summary);
      }

    } catch (err) {
      console.error('Failed to fetch results:', err);
      error('Failed to load results');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getVotePercentage = (voteCount, totalVotes) => {
    if (totalVotes === 0) return 0;
    return ((voteCount / totalVotes) * 100).toFixed(1);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Voting Results</h1>
          <p className="text-gray-600 mt-2">Real-time blockchain voting results</p>
        </div>
        <button
          onClick={() => fetchResults(true)}
          disabled={refreshing}
          className="btn-outline flex items-center space-x-2"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Votes Cast</p>
              <p className="text-2xl font-bold text-gray-900">{results.totalVotes}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

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

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Voter Turnout</p>
              <p className="text-2xl font-bold text-gray-900">{stats.turnoutPercentage}%</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Winner Announcement */}
      {results.winner && results.totalVotes > 0 && (
        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl p-6 text-white">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-1">Current Leader</h2>
              <p className="text-xl font-semibold">{results.winner.name}</p>
              <p className="text-yellow-100">
                {results.winner.voteCount} votes ({getVotePercentage(results.winner.voteCount, results.totalVotes)}%)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Results Chart */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-xl font-semibold text-gray-900">Candidate Results</h2>
        </div>
        
        {results.candidates.length > 0 ? (
          <div className="space-y-4">
            {results.candidates.map((candidate, index) => (
              <div key={candidate.id} className="relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg font-bold text-gray-400">
                        #{index + 1}
                      </span>
                      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{candidate.name}</h3>
                      <p className="text-sm text-gray-600">{candidate.party}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">{candidate.voteCount}</p>
                    <p className="text-sm text-gray-600">
                      {getVotePercentage(candidate.voteCount, results.totalVotes)}%
                    </p>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="result-bar">
                  <div 
                    className="result-fill"
                    style={{ 
                      width: `${getVotePercentage(candidate.voteCount, results.totalVotes)}%` 
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Results Yet
            </h3>
            <p className="text-gray-600">
              Results will appear here once voting begins
            </p>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      {recentVotes.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="text-xl font-semibold text-gray-900">Recent Votes</h2>
          </div>
          <div className="space-y-3">
            {recentVotes.map((vote, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-green-600" />
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
                <div className="flex items-center space-x-2">
                  <span className="badge badge-success">Confirmed</span>
                  <a
                    href={`https://sepolia.etherscan.io/tx/${vote.transactionHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Blockchain Info */}
      <div className="bg-blue-50 rounded-lg p-6">
        <h3 className="font-medium text-blue-900 mb-3">Blockchain Transparency</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center text-blue-800">
            <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
            All votes are recorded on the Ethereum blockchain
          </div>
          <div className="flex items-center text-blue-800">
            <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
            Results are tamper-proof and verifiable
          </div>
          <div className="flex items-center text-blue-800">
            <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
            Real-time updates from the blockchain
          </div>
          <div className="flex items-center text-blue-800">
            <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
            Complete transparency and auditability
          </div>
        </div>
      </div>

      {/* Last Updated */}
      <div className="text-center text-sm text-gray-500">
        <p>Last updated: {new Date().toLocaleString()}</p>
        <p>Data refreshes automatically every 30 seconds</p>
      </div>
    </div>
  );
};

export default Results;