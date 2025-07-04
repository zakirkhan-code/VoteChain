import Web3 from 'web3';

// Contract configuration
export const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS || '0x0FFF0E2294716661F63dd718c25c9B4E21dbB0EF';
export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_RPC_URL = process.env.REACT_APP_SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/63ad9c645e86405a87dfddbd095bdfa3';
export const CONTRACT_ABI = [
    {
      "inputs": [],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "candidateId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "name",
          "type": "string"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "party",
          "type": "string"
        }
      ],
      "name": "CandidateAdded",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "voter",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "candidateId",
          "type": "uint256"
        }
      ],
      "name": "VoteCasted",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "voter",
          "type": "address"
        }
      ],
      "name": "VoterRegistered",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false,
          "internalType": "bool",
          "name": "status",
          "type": "bool"
        }
      ],
      "name": "VotingStatusChanged",
      "type": "event"
    },
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "_name",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "_party",
          "type": "string"
        }
      ],
      "name": "addCandidate",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "admin",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "candidateCount",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "candidates",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "id",
          "type": "uint256"
        },
        {
          "internalType": "string",
          "name": "name",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "party",
          "type": "string"
        },
        {
          "internalType": "uint256",
          "name": "voteCount",
          "type": "uint256"
        },
        {
          "internalType": "bool",
          "name": "exists",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_candidateId",
          "type": "uint256"
        }
      ],
      "name": "castVote",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getAllCandidates",
      "outputs": [
        {
          "components": [
            {
              "internalType": "uint256",
              "name": "id",
              "type": "uint256"
            },
            {
              "internalType": "string",
              "name": "name",
              "type": "string"
            },
            {
              "internalType": "string",
              "name": "party",
              "type": "string"
            },
            {
              "internalType": "uint256",
              "name": "voteCount",
              "type": "uint256"
            },
            {
              "internalType": "bool",
              "name": "exists",
              "type": "bool"
            }
          ],
          "internalType": "struct Voting.Candidate[]",
          "name": "",
          "type": "tuple[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_candidateId",
          "type": "uint256"
        }
      ],
      "name": "getCandidate",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        },
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        },
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getTotalVotes",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_voter",
          "type": "address"
        }
      ],
      "name": "getVoterInfo",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        },
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        },
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getWinner",
      "outputs": [
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        },
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_voter",
          "type": "address"
        }
      ],
      "name": "registerVoter",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "toggleVotingStatus",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "voters",
      "outputs": [
        {
          "internalType": "bool",
          "name": "isRegistered",
          "type": "bool"
        },
        {
          "internalType": "bool",
          "name": "hasVoted",
          "type": "bool"
        },
        {
          "internalType": "uint256",
          "name": "votedFor",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "votingActive",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ];

// Network configurations
export const NETWORKS = {
  localhost: {
    chainId: 31337,
    name: 'Localhost',
    rpcUrl: 'http://localhost:8545',
    explorer: null
  },
  sepolia: {
    chainId: 11155111,
    name: 'Sepolia Testnet',
    rpcUrl: SEPOLIA_RPC_URL,
    explorer: 'https://sepolia.etherscan.io'
  }
};

// Helper function to safely convert BigInt to number
const safeToNumber = (value) => {
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (typeof value === 'string') {
    return parseInt(value, 10);
  }
  return Number(value);
};

// Helper function to safely handle gas calculations
const safeGasCalculation = (gasEstimate) => {
  try {
    const gas = safeToNumber(gasEstimate);
    return Math.floor(gas * 1.2); // Add 20% buffer
  } catch (error) {
    console.warn('Gas calculation fallback:', error);
    return 300000; // Fallback gas limit
  }
};

// Check if user is on correct network
export const checkChainId = async (currentChainId) => {
  const chainId = safeToNumber(currentChainId);
  if (chainId !== SEPOLIA_CHAIN_ID && chainId !== 31337) {
    throw new Error('Please switch to Sepolia testnet or localhost');
  }
};

// Switch to Sepolia network
export const switchToSepolia = async () => {
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${SEPOLIA_CHAIN_ID.toString(16)}` }],
    });
  } catch (switchError) {
    // This error code indicates that the chain has not been added to MetaMask
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: `0x${SEPOLIA_CHAIN_ID.toString(16)}`,
            chainName: 'Sepolia Test Network',
            nativeCurrency: {
              name: 'Sepolia ETH',
              symbol: 'SEP',
              decimals: 18
            },
            rpcUrls: [SEPOLIA_RPC_URL],
            blockExplorerUrls: ['https://sepolia.etherscan.io/']
          }]
        });
      } catch (addError) {
        throw new Error('Failed to add Sepolia network');
      }
    } else {
      throw new Error('Failed to switch to Sepolia network');
    }
  }
};

// Get Web3 contract instance
export const getContract = (web3) => {
  if (!CONTRACT_ADDRESS) {
    throw new Error('Contract address not configured');
  }
  return new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);
};

// Format Wei to Ether
export const fromWei = (value, unit = 'ether') => {
  try {
    return Web3.utils.fromWei(value.toString(), unit);
  } catch (error) {
    console.error('fromWei error:', error);
    return '0';
  }
};

// Format Ether to Wei
export const toWei = (value, unit = 'ether') => {
  try {
    return Web3.utils.toWei(value.toString(), unit);
  } catch (error) {
    console.error('toWei error:', error);
    return '0';
  }
};

// Validate Ethereum address
export const isValidAddress = (address) => {
  return Web3.utils.isAddress(address);
};

// Shorten address for display
export const shortenAddress = (address, chars = 4) => {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
};

// Get transaction receipt with retries
export const waitForTransaction = async (web3, txHash, maxRetries = 30) => {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      const receipt = await web3.eth.getTransactionReceipt(txHash);
      if (receipt) {
        return receipt;
      }
    } catch (error) {
      console.error('Error getting transaction receipt:', error);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    retries++;
  }
  
  throw new Error('Transaction receipt not found after maximum retries');
};

// Estimate gas for transaction with proper error handling
export const estimateGas = async (contract, method, params, from) => {
  try {
    const gasEstimate = await contract.methods[method](...params).estimateGas({ from });
    return safeGasCalculation(gasEstimate);
  } catch (error) {
    console.error('Gas estimation failed, using fallback:', error);
    
    // Return fallback gas limits based on method
    const fallbackGasLimits = {
      addCandidate: 200000,
      castVote: 150000,
      registerVoter: 100000,
      toggleVotingStatus: 80000
    };
    
    return fallbackGasLimits[method] || 200000;
  }
};

// Get current gas price with error handling
export const getGasPrice = async (web3) => {
  try {
    const gasPrice = await web3.eth.getGasPrice();
    return gasPrice.toString();
  } catch (error) {
    console.error('Failed to get gas price, using fallback:', error);
    return Web3.utils.toWei('20', 'gwei'); // Fallback gas price
  }
};

// Voting contract helper functions with improved error handling
export const VotingContract = {
  // Get all candidates
  getAllCandidates: async (contract) => {
    try {
      const candidates = await contract.methods.getAllCandidates().call();
      return candidates.map(candidate => ({
        id: safeToNumber(candidate.id),
        name: candidate.name,
        party: candidate.party,
        voteCount: safeToNumber(candidate.voteCount),
        exists: candidate.exists
      }));
    } catch (error) {
      console.error('Error getting candidates:', error);
      throw error;
    }
  },

  // Check voting status
  getVotingStatus: async (contract) => {
    try {
      const [votingActive, candidateCount] = await Promise.all([
        contract.methods.votingActive().call(),
        contract.methods.candidateCount().call()
      ]);
      
      return {
        votingActive,
        candidateCount: safeToNumber(candidateCount)
      };
    } catch (error) {
      console.error('Error getting voting status:', error);
      throw error;
    }
  },

  // Get voter information
  getVoterInfo: async (contract, voterAddress) => {
    try {
      const voterInfo = await contract.methods.getVoterInfo(voterAddress).call();
      return {
        isRegistered: voterInfo[0],
        hasVoted: voterInfo[1],
        votedFor: safeToNumber(voterInfo[2])
      };
    } catch (error) {
      console.error('Error getting voter info:', error);
      throw error;
    }
  },

  // Cast vote with improved error handling
  castVote: async (contract, candidateId, from, web3) => {
    try {
      console.log('Casting vote for candidate:', candidateId);
      
      // Get gas estimate with fallback
      let gas;
      try {
        const gasEstimate = await contract.methods.castVote(candidateId).estimateGas({ from });
        gas = safeGasCalculation(gasEstimate);
      } catch (gasError) {
        console.warn('Gas estimation failed, using fallback:', gasError);
        gas = 150000; // Fallback gas limit
      }
      
      // Get gas price with fallback
      let gasPrice;
      try {
        gasPrice = await getGasPrice(web3);
      } catch (priceError) {
        console.warn('Gas price fetch failed, using fallback:', priceError);
        gasPrice = Web3.utils.toWei('20', 'gwei');
      }

      // Send transaction
      const result = await contract.methods.castVote(candidateId).send({
        from,
        gas,
        gasPrice
      });

      return result;
    } catch (error) {
      console.error('Error casting vote:', error);
      throw error;
    }
  },

  // Add candidate with improved error handling
  addCandidate: async (contract, name, party, from, web3) => {
    try {
      console.log('Adding candidate:', { name, party });
      
      // Get gas estimate with fallback
      let gas;
      try {
        const gasEstimate = await contract.methods.addCandidate(name, party).estimateGas({ from });
        gas = safeGasCalculation(gasEstimate);
      } catch (gasError) {
        console.warn('Gas estimation failed, using fallback:', gasError);
        gas = 200000; // Fallback gas limit
      }
      
      // Get gas price with fallback
      let gasPrice;
      try {
        gasPrice = await getGasPrice(web3);
      } catch (priceError) {
        console.warn('Gas price fetch failed, using fallback:', priceError);
        gasPrice = Web3.utils.toWei('20', 'gwei');
      }

      // Send transaction
      const result = await contract.methods.addCandidate(name, party).send({
        from,
        gas,
        gasPrice
      });

      return result;
    } catch (error) {
      console.error('Error adding candidate:', error);
      throw error;
    }
  },

  // Register voter with improved error handling
  registerVoter: async (contract, voterAddress, from, web3) => {
    try {
      console.log('Registering voter:', voterAddress);
      
      // Get gas estimate with fallback
      let gas;
      try {
        const gasEstimate = await contract.methods.registerVoter(voterAddress).estimateGas({ from });
        gas = safeGasCalculation(gasEstimate);
      } catch (gasError) {
        console.warn('Gas estimation failed, using fallback:', gasError);
        gas = 100000; // Fallback gas limit
      }
      
      // Get gas price with fallback
      let gasPrice;
      try {
        gasPrice = await getGasPrice(web3);
      } catch (priceError) {
        console.warn('Gas price fetch failed, using fallback:', priceError);
        gasPrice = Web3.utils.toWei('20', 'gwei');
      }

      // Send transaction
      const result = await contract.methods.registerVoter(voterAddress).send({
        from,
        gas,
        gasPrice
      });

      return result;
    } catch (error) {
      console.error('Error registering voter:', error);
      throw error;
    }
  },

  // Toggle voting status with improved error handling
  toggleVotingStatus: async (contract, from, web3) => {
    try {
      console.log('Toggling voting status');
      
      // Get gas estimate with fallback
      let gas;
      try {
        const gasEstimate = await contract.methods.toggleVotingStatus().estimateGas({ from });
        gas = safeGasCalculation(gasEstimate);
      } catch (gasError) {
        console.warn('Gas estimation failed, using fallback:', gasError);
        gas = 80000; // Fallback gas limit
      }
      
      // Get gas price with fallback
      let gasPrice;
      try {
        gasPrice = await getGasPrice(web3);
      } catch (priceError) {
        console.warn('Gas price fetch failed, using fallback:', priceError);
        gasPrice = Web3.utils.toWei('20', 'gwei');
      }

      // Send transaction
      const result = await contract.methods.toggleVotingStatus().send({
        from,
        gas,
        gasPrice
      });

      return result;
    } catch (error) {
      console.error('Error toggling voting status:', error);
      throw error;
    }
  }
};

// Event listener helpers
export const subscribeToContractEvents = (contract, eventName, callback) => {
  const subscription = contract.events[eventName]()
    .on('data', callback)
    .on('error', (error) => {
      console.error(`${eventName} event error:`, error);
    });

  return subscription;
};

// Format transaction for display
export const formatTransaction = (tx, receipt = null) => {
  return {
    hash: tx.transactionHash || tx.hash,
    blockNumber: receipt?.blockNumber || tx.blockNumber,
    gasUsed: receipt?.gasUsed ? safeToNumber(receipt.gasUsed) : null,
    gasPrice: tx.gasPrice,
    from: tx.from,
    to: tx.to,
    status: receipt?.status ? 'Success' : 'Failed',
    timestamp: new Date().toISOString()
  };
};

// Error handler for Web3 errors
export const handleWeb3Error = (error) => {
  console.error('Web3 Error:', error);
  
  if (error.code === 4001) {
    return 'Transaction rejected by user';
  } else if (error.code === -32603) {
    return 'Internal JSON-RPC error';
  } else if (error.message?.includes('insufficient funds')) {
    return 'Insufficient funds for transaction';
  } else if (error.message?.includes('gas')) {
    return 'Gas estimation failed or gas limit too low';
  } else if (error.message?.includes('revert')) {
    return 'Transaction reverted by smart contract';
  } else if (error.message?.includes('BigInt')) {
    return 'BigInt conversion error - please try again';
  }
  
  return error.message || 'Unknown Web3 error occurred';
};