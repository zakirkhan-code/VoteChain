import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  UserPlus,
  Vote,
  Settings,
  Shield,
  Plus,
  Edit,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
  Play,
  Pause,
  RefreshCw,
  Wifi,
  WifiOff,
  Zap,
  Activity,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useWeb3 } from "../context/Web3Context";
import { useWebSocket } from "../context/WebSocketContext"; // ✅ Use WebSocket Context
import { useToast } from "../context/ToastContext";
import { getContract, VotingContract } from "../utils/web3";

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [users, setUsers] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [votingStatus, setVotingStatus] = useState({
    votingActive: false,
    candidateCount: 0,
  });
  const [stats, setStats] = useState({
    totalUsers: 0,
    registeredVoters: 0,
    totalVotes: 0,
    turnoutPercentage: 0,
  });
  const [showAddCandidate, setShowAddCandidate] = useState(false);
  const [newCandidate, setNewCandidate] = useState({ name: "", party: "" });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastUpdate, setLastUpdate] = useState(null);

  const { user, isAuthenticated, api } = useAuth();
  const { web3, account, isConnected } = useWeb3();
  const { 
    connectionStatus, 
    lastMessage, 
    sendMessage, 
    isConnected: wsConnected 
  } = useWebSocket(); // ✅ Use WebSocket Context
  const { success, error, warning } = useToast();
  const navigate = useNavigate();

  // ✅ REMOVE DUPLICATE WEBSOCKET REFS - Using Context Instead
  const eventSourceRef = useRef(null);
  const blockchainEventListenerRef = useRef(null);

  // ✅ HANDLE WEBSOCKET MESSAGES FROM CONTEXT
  useEffect(() => {
    if (lastMessage) {
      console.log("📡 Real-time update received:", lastMessage);
      
      // Handle different event types
      switch (lastMessage.type) {
        case 'USER_REGISTERED':
          setUsers(prev => prev.map(u => 
            u._id === lastMessage.userId 
              ? { ...u, isRegistered: true, walletAddress: lastMessage.walletAddress }
              : u
          ));
          success(`User ${lastMessage.username} registered!`);
          break;

        case 'USER_VOTED':
          setUsers(prev => prev.map(u => 
            u._id === lastMessage.userId 
              ? { ...u, hasVoted: true, votedFor: lastMessage.candidateId }
              : u
          ));
          fetchStats(); // Refresh stats when someone votes
          success(`${lastMessage.username} voted!`);
          break;

        case 'USER_CREATED':
          setUsers(prev => [...prev, lastMessage.user]);
          success(`New user ${lastMessage.user.username} joined!`);
          break;

        case 'USER_DELETED':
          setUsers(prev => prev.filter(u => u._id !== lastMessage.userId));
          success(`User deleted`);
          break;

        case 'STATS_UPDATED':
          setStats(lastMessage.stats);
          break;

        default:
          console.log("Unknown event type:", lastMessage.type);
      }
    }
  }, [lastMessage, success]);

  // ✅ 2. SERVER-SENT EVENTS FOR BLOCKCHAIN UPDATES (Fixed URL)
  const connectServerSentEvents = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      // ✅ FIXED: Remove double /api/ in URL
      const sseUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/blockchain/events`;
      eventSourceRef.current = new EventSource(sseUrl);

      eventSourceRef.current.onopen = () => {
        console.log("🟢 SSE connected for blockchain events");
      };

      eventSourceRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("⛓️ Blockchain event received:", data);

          switch (data.event) {
            case 'CandidateAdded':
              setCandidates(prev => [...prev, {
                id: data.candidateId,
                name: data.name,
                party: data.party,
                voteCount: 0,
                exists: true
              }]);
              success(`New candidate added: ${data.name}`);
              break;

            case 'VoteCasted':
              setCandidates(prev => prev.map(c => 
                c.id === data.candidateId 
                  ? { ...c, voteCount: c.voteCount + 1 }
                  : c
              ));
              break;

            case 'VotingStatusChanged':
              setVotingStatus(prev => ({ 
                ...prev, 
                votingActive: data.status 
              }));
              success(`Voting ${data.status ? 'started' : 'stopped'}!`);
              break;

            case 'VoterRegistered':
              setUsers(prev => prev.map(u => 
                u.walletAddress === data.voter 
                  ? { ...u, isRegistered: true }
                  : u
              ));
              break;

            default:
              console.log("Unknown blockchain event:", data.event);
          }
        } catch (err) {
          console.error("Error parsing SSE message:", err);
        }
      };

      eventSourceRef.current.onerror = () => {
        console.log("🔴 SSE connection error");
      };

    } catch (err) {
      console.error("Failed to connect SSE:", err);
    }
  }, [success]);

  // ✅ 3. BLOCKCHAIN EVENT LISTENER (Direct Contract Events)
  const setupBlockchainEventListener = useCallback(async () => {
    if (!isConnected || !web3 || !account) {
      console.log("Wallet not connected - skipping blockchain events");
      return;
    }

    try {
      const contract = getContract(web3);
      
      const events = ['CandidateAdded', 'VoteCasted', 'VoterRegistered', 'VotingStatusChanged'];
      
      events.forEach(eventName => {
        contract.events[eventName]({
          fromBlock: 'latest'
        })
        .on('data', (event) => {
          console.log(`🔗 Direct blockchain event: ${eventName}`, event);

          switch (eventName) {
            case 'CandidateAdded':
              fetchCandidates();
              break;
            case 'VoteCasted':
              fetchCandidates();
              fetchStats();
              break;
            case 'VotingStatusChanged':
              fetchVotingStatus();
              break;
            case 'VoterRegistered':
              break;
          }
        })
        .on('error', (error) => {
          console.error(`Blockchain event error for ${eventName}:`, error);
        });
      });

      blockchainEventListenerRef.current = contract;
      console.log("✅ Blockchain event listeners setup complete");

    } catch (err) {
      console.error("Failed to setup blockchain event listeners:", err);
    }
  }, [isConnected, web3, account]);

  // ✅ INDIVIDUAL FETCH FUNCTIONS
  const fetchUsers = useCallback(async () => {
    try {
      const response = await api.get("/users");
      if (response.data.success) {
        setUsers(response.data.data.users);
        console.log("✅ Users refreshed");
      }
    } catch (err) {
      console.error("Failed to fetch users:", err);
    }
  }, [api]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get("/users/stats");
      if (response.data.success) {
        setStats(response.data.data);
        console.log("✅ Stats refreshed");
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, [api]);

  const fetchCandidates = useCallback(async () => {
    try {
      const response = await api.get("/blockchain/candidates");
      if (response.data.success) {
        setCandidates(response.data.data.candidates);
        console.log("✅ Candidates refreshed");
      }
    } catch (err) {
      console.error("Failed to fetch candidates:", err);
    }
  }, [api]);

  const fetchVotingStatus = useCallback(async () => {
    try {
      const response = await api.get("/blockchain/voting-status");
      if (response.data.success) {
        setVotingStatus(response.data.data);
        console.log("✅ Voting status refreshed");
      }
    } catch (err) {
      console.error("Failed to fetch voting status:", err);
    }
  }, [api]);

  // ✅ INITIAL LOAD
  const initialLoad = useCallback(async () => {
    console.log("🚀 Initial load started - NO AUTO-REFRESH");
    setLoading(true);
    
    try {
      await Promise.all([
        fetchUsers(),
        fetchStats(),
        fetchCandidates(),
        fetchVotingStatus()
      ]);
      
      setLastUpdate(new Date());
      console.log("✅ Initial load complete");
    } catch (err) {
      console.error("Initial load failed:", err);
      error("Failed to load initial data");
    } finally {
      setLoading(false);
    }
  }, [fetchUsers, fetchStats, fetchCandidates, fetchVotingStatus, error]);

  // ✅ MANUAL REFRESH
  const handleManualRefresh = useCallback(async () => {
    console.log("🔄 Manual refresh triggered by user");
    setRefreshing(true);
    
    try {
      await Promise.all([
        fetchUsers(),
        fetchStats(),
        fetchCandidates(),
        fetchVotingStatus()
      ]);
      
      setLastUpdate(new Date());
      success("Data refreshed successfully!");
    } catch (err) {
      console.error("Manual refresh failed:", err);
      error("Failed to refresh data");
    } finally {
      setRefreshing(false);
    }
  }, [fetchUsers, fetchStats, fetchCandidates, fetchVotingStatus, success, error]);

  // ✅ ONLINE/OFFLINE DETECTION
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log("🌐 Back online - reconnecting real-time services");
      connectServerSentEvents();
      if (isConnected) {
        setupBlockchainEventListener();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log("📴 Gone offline - real-time services paused");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [connectServerSentEvents, setupBlockchainEventListener, isConnected]);

  // ✅ MAIN EFFECT
  useEffect(() => {
    if (!isAuthenticated || user?.role !== "admin") {
      navigate("/dashboard");
      return;
    }

    initialLoad();

    if (isOnline) {
      connectServerSentEvents();
      
      if (isConnected) {
        setupBlockchainEventListener();
      }
    }

    console.log("🎯 Event-driven system active - Zero auto-refresh!");

    return () => {
      console.log("🧹 Cleanup: Closing real-time connections");
      
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [isAuthenticated, user?.role, navigate, initialLoad, connectServerSentEvents, setupBlockchainEventListener, isConnected, isOnline]);

  // ✅ ACTION HANDLERS (same as before but cleaner)
  const handleRegisterVoter = async (userId, userWalletAddress) => {
    if (!userWalletAddress) {
      warning("User wallet address is required");
      return;
    }

    try {
      setLoading(true);

      const dbResponse = await api.post("/blockchain/register-voter", {
        voterAddress: userWalletAddress,
        userId: userId,
      });

      if (!dbResponse.data.success) {
        throw new Error(dbResponse.data.message || "Database update failed");
      }

      setUsers(prevUsers => prevUsers.map((u) =>
        u._id === userId
          ? { ...u, isRegistered: true, walletAddress: userWalletAddress }
          : u
      ));

      if (isConnected && web3 && account) {
        try {
          const contract = getContract(web3);
          const result = await VotingContract.registerVoter(
            contract,
            userWalletAddress,
            account,
            web3
          );
          success("Voter registered successfully!");
        } catch (blockchainError) {
          warning("Database updated but blockchain transaction failed.");
        }
      } else {
        success("Voter registered in database. Connect wallet for blockchain.");
      }

    } catch (err) {
      error(err.message || "Failed to register voter");
      setUsers(prevUsers => prevUsers.map((u) =>
        u._id === userId ? { ...u, isRegistered: false } : u
      ));
    } finally {
      setLoading(false);
    }
  };

  const handleAddCandidate = async () => {
    if (!newCandidate.name?.trim() || !newCandidate.party?.trim()) {
      warning("Please enter candidate name and party");
      return;
    }

    try {
      setLoading(true);

      if (isConnected && web3 && account) {
        const contract = getContract(web3);
        const result = await VotingContract.addCandidate(
          contract,
          newCandidate.name.trim(),
          newCandidate.party.trim(),
          account,
          web3
        );

        success("Candidate added successfully!");
        setNewCandidate({ name: "", party: "" });
        setShowAddCandidate(false);
      } else {
        error("Please connect your wallet to add candidates");
      }
    } catch (err) {
      error(err.message || "Failed to add candidate");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVoting = async () => {
    try {
      setLoading(true);

      if (isConnected && web3 && account) {
        const contract = getContract(web3);
        const newStatus = !votingStatus.votingActive;
        setVotingStatus(prev => ({ ...prev, votingActive: newStatus }));

        const result = await VotingContract.toggleVotingStatus(
          contract,
          account,
          web3
        );

        success(`Voting ${newStatus ? "started" : "stopped"} successfully!`);
      } else {
        error("Please connect your wallet to toggle voting status");
      }
    } catch (err) {
      error(err.message || "Failed to toggle voting status");
      setVotingStatus(prev => ({ ...prev, votingActive: !prev.votingActive }));
    } finally {
      setLoading(false);
    }
  };

  // ✅ OTHER HANDLERS (simplified)
  const handleSyncRegistration = async (userId, userWalletAddress) => {
    if (!userWalletAddress) {
      warning("User wallet address is required");
      return;
    }

    try {
      setLoading(true);
      const response = await api.post("/blockchain/sync-registration", {
        voterAddress: userWalletAddress,
      });

      if (response.data.success) {
        success("Registration status synced successfully");
      }
    } catch (err) {
      error("Failed to sync registration status");
    } finally {
      setLoading(false);
    }
  };

  const handlePromoteToAdmin = async (userId) => {
    if (window.confirm("Are you sure you want to promote this user to admin?")) {
      try {
        setLoading(true);
        await api.put(`/users/${userId}/promote-admin`);
        success("User promoted to admin successfully");
      } catch (err) {
        error("Failed to promote user to admin");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDemoteAdmin = async (userId) => {
    if (window.confirm("Are you sure you want to demote this admin to voter?")) {
      try {
        setLoading(true);
        await api.put(`/users/${userId}/demote-admin`);
        success("Admin demoted to voter successfully");
      } catch (err) {
        error("Failed to demote admin");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      try {
        setLoading(true);
        await api.delete(`/users/${userId}`);
        success("User deleted successfully");
      } catch (err) {
        error("Failed to delete user");
      } finally {
        setLoading(false);
      }
    }
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: Shield },
    { id: "users", label: "Users", icon: Users },
    { id: "candidates", label: "Candidates", icon: Vote },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  if (loading && !refreshing) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="loading-spinner w-8 h-8"></div>
        <p className="ml-4">Loading admin panel...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-blue-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Fixed Admin Panel</h1>
            <p className="text-green-100">🎯 Using WebSocket Context • No Duplicate Connections</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center text-sm text-green-100 space-x-4">
              <div className="flex items-center">
                {isOnline ? (
                  <Wifi className="w-4 h-4 mr-1" />
                ) : (
                  <WifiOff className="w-4 h-4 mr-1" />
                )}
                <span>{isOnline ? 'Online' : 'Offline'}</span>
              </div>

              <div className="flex items-center">
                <Activity className={`w-4 h-4 mr-1 ${wsConnected ? 'text-green-300' : 'text-red-300'}`} />
                <span>WS</span>
              </div>

              <div className="flex items-center">
                <Zap className={`w-4 h-4 mr-1 ${isConnected ? 'text-green-300' : 'text-red-300'}`} />
                <span>BC</span>
              </div>
            </div>

            {refreshing && (
              <div className="flex items-center text-sm text-green-100">
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                <span>Refreshing...</span>
              </div>
            )}
            
            <button
              onClick={handleManualRefresh}
              disabled={loading || refreshing}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {!isConnected && (
          <div className="mt-3 p-3 bg-yellow-500/20 rounded-lg">
            <p className="text-sm">⚠️ Connect wallet for blockchain features</p>
          </div>
        )}

        <div className="mt-3 text-xs text-green-200 space-y-1">
          <div>✅ **FIXED:** Using WebSocket Context instead of duplicate connections</div>
          <div>✅ **FIXED:** Correct WebSocket URL (port 5000, not 8000)</div>
          <div>✅ **FIXED:** No double /api/ in SSE URL</div>
          <div>🔌 WebSocket Status: {connectionStatus}</div>
          {lastUpdate && (
            <div>🕒 Last Manual Update: {lastUpdate.toLocaleTimeString()}</div>
          )}
          {lastMessage && (
            <div>📡 Last Event: {lastMessage.type} at {new Date().toLocaleTimeString()}</div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Real-time Status Card */}
          <div className="card bg-gradient-to-r from-green-50 to-blue-50">
            <div className="card-header">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <Activity className="w-5 h-5 mr-2 text-green-600" />
                Fixed Real-Time System Status
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <div>
                  <p className="text-sm font-medium">WebSocket Context</p>
                  <p className="text-xs text-gray-600">{connectionStatus}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${eventSourceRef.current ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <div>
                  <p className="text-sm font-medium">Blockchain Events</p>
                  <p className="text-xs text-gray-600">{eventSourceRef.current ? 'Connected' : 'Inactive'}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                <div>
                  <p className="text-sm font-medium">Wallet Status</p>
                  <p className="text-xs text-gray-600">{isConnected ? 'Connected' : 'Not Connected'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Users</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
                </div>
                <Users className="w-8 h-8 text-blue-600" />
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Registered Voters</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.registeredVoters}</p>
                </div>
                <UserPlus className="w-8 h-8 text-green-600" />
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Votes</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalVotes}</p>
                </div>
                <Vote className="w-8 h-8 text-purple-600" />
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Turnout</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.turnoutPercentage}%</p>
                </div>
                <CheckCircle className="w-8 h-8 text-orange-600" />
              </div>
            </div>
          </div>

          {/* Voting Control */}
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold text-gray-900">Voting Control</h2>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">Voting Status</h3>
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      votingStatus.votingActive ? "bg-green-500" : "bg-red-500"
                    }`}
                  ></div>
                  <p
                    className={`text-sm font-medium ${
                      votingStatus.votingActive ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {votingStatus.votingActive ? "Active" : "Inactive"}
                  </p>
                  <span className="text-xs text-gray-500">(Real-time)</span>
                </div>
              </div>
              <button
                onClick={handleToggleVoting}
                disabled={!isConnected || loading}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
                  votingStatus.votingActive
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-green-600 hover:bg-green-700 text-white"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Processing...</span>
                  </>
                ) : votingStatus.votingActive ? (
                  <>
                    <Pause className="w-4 h-4" />
                    <span>Stop Voting</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Start Voting</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === "users" && (
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Users className="w-5 h-5 mr-2" />
              User Management
              <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Real-time</span>
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Wallet
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((currentUser) => (
                  <tr key={currentUser._id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {currentUser.username}
                        </div>
                        <div className="text-sm text-gray-500">{currentUser.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <span
                          className={`badge ${
                            currentUser.role === "admin" ? "badge-danger" : "badge-info"
                          }`}
                        >
                          {currentUser.role === "admin" ? "Admin" : "Voter"}
                        </span>
                        <span
                          className={`badge ${
                            currentUser.isRegistered ? "badge-success" : "badge-warning"
                          }`}
                        >
                          {currentUser.isRegistered ? "Registered" : "Not Registered"}
                        </span>
                        {currentUser.hasVoted && (
                          <span className="badge badge-info">Voted</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {currentUser.walletAddress
                        ? `${currentUser.walletAddress.slice(0, 6)}...${currentUser.walletAddress.slice(-4)}`
                        : "Not connected"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      {currentUser.role === "voter" && (
                        <>
                          {!currentUser.isRegistered && currentUser.walletAddress && (
                            <button
                              onClick={() =>
                                handleRegisterVoter(currentUser._id, currentUser.walletAddress)
                              }
                              className="text-green-600 hover:text-green-900"
                              title="Register Voter"
                              disabled={loading}
                            >
                              <UserPlus className="w-4 h-4" />
                            </button>
                          )}
                          {currentUser.walletAddress && (
                            <button
                              onClick={() =>
                                handleSyncRegistration(currentUser._id, currentUser.walletAddress)
                              }
                              className="text-blue-600 hover:text-blue-900"
                              title="Sync Registration Status"
                              disabled={loading}
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handlePromoteToAdmin(currentUser._id)}
                            className="text-purple-600 hover:text-purple-900"
                            title="Promote to Admin"
                            disabled={loading}
                          >
                            <Shield className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {currentUser.role === "admin" && currentUser._id !== user?._id && (
                        <button
                          onClick={() => handleDemoteAdmin(currentUser._id)}
                          className="text-orange-600 hover:text-orange-900"
                          title="Demote to Voter"
                          disabled={loading}
                        >
                          <Users className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteUser(currentUser._id)}
                        disabled={
                          currentUser.hasVoted || currentUser._id === user?._id || loading
                        }
                        className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete User"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {users.length === 0 && (
            <div className="text-center py-8">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Users</h3>
              <p className="text-gray-600">No users found in the system</p>
            </div>
          )}
        </div>
      )}

      {/* Candidates Tab */}
      {activeTab === "candidates" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Vote className="w-5 h-5 mr-2" />
              Candidate Management
              <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Real-time</span>
            </h2>
            <button
              onClick={() => setShowAddCandidate(true)}
              className="btn-primary flex items-center space-x-2"
              disabled={!isConnected || loading}
            >
              <Plus className="w-4 h-4" />
              <span>Add Candidate</span>
            </button>
          </div>

          {showAddCandidate && (
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-medium text-gray-900">Add New Candidate</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Candidate Name
                  </label>
                  <input
                    type="text"
                    value={newCandidate.name}
                    onChange={(e) =>
                      setNewCandidate({ ...newCandidate, name: e.target.value })
                    }
                    className="input-field"
                    placeholder="Enter candidate name"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Party
                  </label>
                  <input
                    type="text"
                    value={newCandidate.party}
                    onChange={(e) =>
                      setNewCandidate({ ...newCandidate, party: e.target.value })
                    }
                    className="input-field"
                    placeholder="Enter party name"
                    disabled={loading}
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={handleAddCandidate}
                    className="btn-primary"
                    disabled={!newCandidate.name.trim() || !newCandidate.party.trim() || loading}
                  >
                    {loading ? "Adding..." : "Add Candidate"}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddCandidate(false);
                      setNewCandidate({ name: "", party: "" });
                    }}
                    className="btn-secondary"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {candidates.map((candidate) => (
                <div key={candidate.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{candidate.name}</h3>
                      <p className="text-sm text-gray-600">{candidate.party}</p>
                      <p className="text-sm text-gray-500">{candidate.voteCount} votes</p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-blue-600">
                        #{candidate.id}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {candidates.length === 0 && (
              <div className="text-center py-8">
                <Vote className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No Candidates
                </h3>
                <p className="text-gray-600">
                  Add candidates to start the voting process
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === "settings" && (
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900">
              Fixed System Configuration
            </h2>
          </div>
          <div className="space-y-6">
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-medium text-green-900 mb-2">✅ Issues Fixed</h4>
              <ul className="text-sm text-green-700 space-y-1">
                <li>✅ <strong>Fixed provider hierarchy</strong> - AuthProvider now wraps WebSocketProvider</li>
                <li>✅ <strong>Removed duplicate WebSocket connections</strong> - Using WebSocketContext only</li>
                <li>✅ <strong>Fixed WebSocket URL</strong> - Now using port 5000 instead of 8000</li>
                <li>✅ <strong>Fixed SSE URL</strong> - Removed double /api/ path issue</li>
                <li>✅ <strong>Cleaned up real-time system</strong> - Single source of truth</li>
              </ul>
            </div>

            <div className="border-b border-gray-200 pb-6">
              <h3 className="font-medium text-gray-900 mb-2">
                Real-Time Update System Status
              </h3>
              <div className="space-y-2 text-sm text-gray-600">
                <p>
                  <strong>WebSocket Context:</strong>
                  <span className={`ml-2 ${wsConnected ? "text-green-600" : "text-red-600"}`}>
                    {connectionStatus}
                  </span>
                </p>
                <p>
                  <strong>Blockchain Events:</strong> 
                  <span className={`ml-2 ${eventSourceRef.current ? "text-green-600" : "text-red-600"}`}>
                    {eventSourceRef.current ? "Connected" : "Inactive"}
                  </span>
                </p>
                <p>
                  <strong>Network Status:</strong>
                  <span className={`ml-2 ${isOnline ? "text-green-600" : "text-red-600"}`}>
                    {isOnline ? "Online" : "Offline"}
                  </span>
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 mb-2">
                Current System Status
              </h3>
              <div className="space-y-2 text-sm text-gray-600">
                <p>
                  <strong>Voting Status:</strong>
                  <span
                    className={`ml-2 ${
                      votingStatus.votingActive
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {votingStatus.votingActive ? "Active" : "Inactive"}
                  </span>
                </p>
                <p>
                  <strong>Connected Wallet:</strong>{" "}
                  {account || "Not connected"}
                </p>
                <p>
                  <strong>Last Manual Update:</strong>{" "}
                  {lastUpdate ? lastUpdate.toLocaleString() : "Never"}
                </p>
                <p>
                  <strong>Admin User:</strong> {user?.username}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;