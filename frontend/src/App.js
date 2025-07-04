import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Web3 from "web3";
import "./App.css";

// Components
import Navbar from "./components/Navbar";
import Login from "./components/Login";
import Register from "./components/Register";
import Dashboard from "./components/Dashboard";
import VotingPanel from "./components/VotingPanel";
import Results from "./components/Results";
import AdminPanel from "./components/AdminPanel";
import Profile from "./components/Profile";
import Footer from "./components/Footer";

// Context - CRITICAL: Import order matters!
import { ToastProvider } from "./context/ToastContext";
import { AuthProvider } from "./context/AuthContext";
import { WebSocketProvider } from './context/WebSocketContext';
import { Web3Provider } from "./context/Web3Context";

// Utils
import { checkChainId, switchToSepolia } from "./utils/web3";

function App() {
  const [web3, setWeb3] = useState(null);
  const [account, setAccount] = useState(null);
  const [networkId, setNetworkId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  useEffect(() => {
    initWeb3();

    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener(
          "accountsChanged",
          handleAccountsChanged
        );
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, []);

  const initWeb3 = async () => {
    try {
      setIsConnecting(true);
      setConnectionError(null);

      if (window.ethereum) {
        const web3Instance = new Web3(window.ethereum);
        setWeb3(web3Instance);

        // Get network ID
        const networkId = await web3Instance.eth.net.getId();
        setNetworkId(Number(networkId));

        // Check if already connected
        const accounts = await web3Instance.eth.getAccounts();
        if (accounts.length > 0) {
          setAccount(accounts[0]);

          // Verify correct network
          await checkChainId(Number(networkId));
        }

        console.log("✅ Web3 initialized successfully");
      } else {
        setConnectionError(
          "MetaMask not found. Please install MetaMask to use this application."
        );
      }
    } catch (error) {
      console.error("Web3 initialization error:", error);
      setConnectionError(
        "Failed to connect to Web3. Please check your wallet connection."
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const connectWallet = async () => {
    try {
      setIsConnecting(true);
      setConnectionError(null);

      if (!window.ethereum) {
        throw new Error("MetaMask not found");
      }

      // Request account access
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      if (accounts.length > 0) {
        setAccount(accounts[0]);

        // Switch to Sepolia if needed
        const currentChainId = await window.ethereum.request({
          method: "eth_chainId",
        });

        if (parseInt(currentChainId, 16) !== 11155111) {
          await switchToSepolia();
        }

        console.log("✅ Wallet connected:", accounts[0]);
      }
    } catch (error) {
      console.error("Wallet connection error:", error);
      setConnectionError(error.message || "Failed to connect wallet");
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setNetworkId(null);
    console.log("💔 Wallet disconnected");
  };

  const handleAccountsChanged = (accounts) => {
    if (accounts.length === 0) {
      disconnectWallet();
    } else {
      setAccount(accounts[0]);
      console.log("🔄 Account changed:", accounts[0]);
    }
  };

  const handleChainChanged = (chainId) => {
    const newNetworkId = parseInt(chainId, 16);
    setNetworkId(newNetworkId);
    console.log("🌐 Network changed:", newNetworkId);

    // Reload page to avoid any issues
    window.location.reload();
  };

  const web3Context = {
    web3,
    account,
    networkId,
    isConnecting,
    connectionError,
    connectWallet,
    disconnectWallet,
    isConnected: !!account,
  };

  return (
    <div className="App">
      {/* 
        🎯 CRITICAL PROVIDER HIERARCHY - DO NOT CHANGE ORDER!
        
        1. ToastProvider - No dependencies
        2. AuthProvider - Provides authentication context
        3. WebSocketProvider - DEPENDS ON AuthProvider (uses useAuth hook)
        4. Web3Provider - Provides web3 context
        5. Router - Contains all components
      */}
      <ToastProvider>
        <AuthProvider>
          <WebSocketProvider>
            <Web3Provider value={web3Context}>
              <Router>
                <div className="min-h-screen bg-gray-50 flex flex-col">
                  <Navbar />

                  <main className="flex-grow container mx-auto px-4 py-8">
                    {connectionError && (
                      <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                        <div className="flex items-center">
                          <svg
                            className="w-5 h-5 mr-2"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span className="font-medium">Connection Error:</span>
                          <span className="ml-2">{connectionError}</span>
                        </div>
                      </div>
                    )}

                    <Routes>
                      <Route path="/login" element={<Login />} />
                      <Route path="/register" element={<Register />} />
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/vote" element={<VotingPanel />} />
                      <Route path="/results" element={<Results />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/admin" element={<AdminPanel />} />
                      <Route
                        path="/"
                        element={<Navigate to="/dashboard" replace />}
                      />
                    </Routes>
                  </main>

                  <Footer />
                </div>
              </Router>
            </Web3Provider>
          </WebSocketProvider>
        </AuthProvider>
      </ToastProvider>
    </div>
  );
}

export default App;