import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Vote, CheckCircle, AlertCircle, Clock, User, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWeb3 } from '../context/Web3Context';
import { useToast } from '../context/ToastContext';
import { getContract, VotingContract } from '../utils/web3';

const VotingPanel = () => {
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [votingStatus, setVotingStatus] = useState({
    votingActive: false,
    candidateCount: 0
  });
  const [userVoteInfo, setUserVoteInfo] = useState({
    hasVoted: false,
    votedFor: null
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isVoting, setIsVoting] = useState(false);

  const { user, isAuthenticated, api } = useAuth();
  const { web3, account, isConnected } = useWeb3();
  const { success, error, warning } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (!isConnected) {
      warning('Please connect your wallet to vote');
    }

    fetchVotingData();
  }, [isAuthenticated, isConnected, navigate]);

  const fetchVotingData = async () => {
    try {
      setIsLoading(true);

      // Fetch candidates from blockchain
      const candidatesResponse = await api.get('/blockchain/candidates');
      if (candidatesResponse.data.success) {
        setCandidates(candidatesResponse.data.data.candidates);
      }

      // Fetch voting status
      const statusResponse = await api.get('/blockchain/voting-status');
      if (statusResponse.data.success) {
        setVotingStatus(statusResponse.data.data);
      }

      // Fetch user's vote info
      const voteResponse = await api.get('/votes/my-vote');
      if (voteResponse.data.success) {
        setUserVoteInfo(voteResponse.data.data);
      }

    } catch (err) {
      console.error('Failed to fetch voting data:', err);
      error('Failed to load voting data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVote = async () => {
    if (!selectedCandidate) {
      warning('Please select a candidate');
      return;
    }

    if (!isConnected) {
      error('Please connect your wallet first');
      return;
    }

    if (!user?.isRegistered) {
      error('You are not registered to vote');
      return;
    }

    if (userVoteInfo.hasVoted) {
      error('You have already voted');
      return;
    }

    try {
      setIsVoting(true);

      // Get contract instance
      const contract = getContract(web3);

      // Cast vote on blockchain
      const result = await VotingContract.castVote(
        contract,
        selectedCandidate.id,
        account,
        web3
      );

      // Record vote in database
      const voteData = {
        candidateId: selectedCandidate.id,
        candidateName: selectedCandidate.name,
        candidateParty: selectedCandidate.party,
        transactionHash: result.transactionHash,
        blockNumber: result.blockNumber,
        gasUsed: result.gasUsed,
        gasPrice: result.gasPrice || '0',
        walletAddress: account
      };

      await api.post('/votes/cast', voteData);

      success('Vote cast successfully! Thank you for participating.');
      
      // Refresh data
      await fetchVotingData();

      // Navigate to results
      setTimeout(() => {
        navigate('/results');
      }, 2000);

    } catch (err) {
      console.error('Voting error:', err);
      error(err.message || 'Failed to cast vote. Please try again.');
    } finally {
      setIsVoting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="loading-spinner w-8 h-8"></div>
      </div>
    );
  }

  // Check if user already voted
  if (userVoteInfo.hasVoted) {
    const votedCandidate = candidates.find(c => c.id === userVoteInfo.votedFor);
    
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Thank you for voting!
          </h1>
          <p className="text-gray-600 mb-6">
            Your vote has been recorded on the blockchain
          </p>
          
          {votedCandidate && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-medium text-green-900 mb-2">
                You voted for:
              </h3>
              <div className="flex items-center justify-center space-x-4">
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-2">
                    <User className="w-8 h-8 text-white" />
                  </div>
                  <h4 className="font-semibold text-green-900">{votedCandidate.name}</h4>
                  <p className="text-sm text-green-700">{votedCandidate.party}</p>
                </div>
              </div>
            </div>
          )}
          
          <button
            onClick={() => navigate('/results')}
            className="btn-primary"
          >
            View Results
          </button>
        </div>
      </div>
    );
  }

  // Check voting status
  if (!votingStatus.votingActive) {
    return (
      <div className="max-w-2xl mx-auto text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock className="w-8 h-8 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Voting is Currently Inactive
        </h1>
        <p className="text-gray-600 mb-6">
          Please wait for the voting period to begin
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="btn-primary"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  // Check if user is registered
  if (!user?.isRegistered) {
    return (
      <div className="max-w-2xl mx-auto text-center">
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-yellow-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Registration Required
        </h1>
        <p className="text-gray-600 mb-6">
          You need to be registered by an administrator to vote
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="btn-primary"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Cast Your Vote
        </h1>
        <p className="text-gray-600">
          Select your preferred candidate and make your voice heard
        </p>
      </div>

      {/* Wallet Connection Warning */}
      {!isConnected && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-orange-600 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-orange-800">
                Wallet Required
              </h3>
              <p className="text-sm text-orange-700">
                Please connect your wallet to cast your vote
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Candidates List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {candidates.map((candidate) => (
          <div
            key={candidate.id}
            className={`voting-card cursor-pointer ${
              selectedCandidate?.id === candidate.id ? 'selected' : ''
            }`}
            onClick={() => setSelectedCandidate(candidate)}
          >
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
                <User className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900">
                  {candidate.name}
                </h3>
                <p className="text-gray-600">{candidate.party}</p>
                <div className="flex items-center mt-2 text-sm text-gray-500">
                  <Users className="w-4 h-4 mr-1" />
                  <span>{candidate.voteCount} votes</span>
                </div>
              </div>
              {selectedCandidate?.id === candidate.id && (
                <CheckCircle className="w-6 h-6 text-blue-600" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* No candidates message */}
      {candidates.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Candidates Available
          </h3>
          <p className="text-gray-600">
            Candidates will appear here when they are added by the administrator
          </p>
        </div>
      )}

      {/* Voting Section */}
      {candidates.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-6">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Ready to Vote?
            </h3>
            
            {selectedCandidate ? (
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">You selected:</p>
                <div className="inline-flex items-center space-x-2 bg-blue-50 px-4 py-2 rounded-lg">
                  <User className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-blue-900">
                    {selectedCandidate.name}
                  </span>
                  <span className="text-blue-700">
                    ({selectedCandidate.party})
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 mb-4">
                Please select a candidate to continue
              </p>
            )}

            <div className="space-y-3">
              <button
                onClick={handleVote}
                disabled={!selectedCandidate || !isConnected || isVoting}
                className="btn-primary w-full md:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isVoting ? (
                  <div className="flex items-center">
                    <div className="loading-spinner mr-2"></div>
                    Processing Vote...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Vote className="w-5 h-5 mr-2" />
                    Confirm Vote
                  </div>
                )}
              </button>
              
              <div className="text-xs text-gray-500">
                <p>⚠️ Your vote is final and cannot be changed</p>
                <p>🔒 All votes are secured on the blockchain</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-8 bg-blue-50 rounded-lg p-6">
        <h4 className="font-medium text-blue-900 mb-3">Voting Instructions:</h4>
        <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
          <li>Connect your wallet if you haven't already</li>
          <li>Select your preferred candidate by clicking on their card</li>
          <li>Click "Confirm Vote" to submit your vote to the blockchain</li>
          <li>Confirm the transaction in your wallet</li>
          <li>Wait for the transaction to be confirmed</li>
        </ol>
      </div>
    </div>
  );
};

export default VotingPanel;