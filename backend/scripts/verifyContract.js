// backend/scripts/verifyContract.js
// Ye script run karo check karne ke liye ke kon sa contract address valid hai

const Web3 = require('web3');
require('dotenv').config();

const CONTRACT_ABI = [/* Your contract ABI */];
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL;

const addresses = [
  '0x324aB46f5fC4d79a96def5e1BefFB67949F82dE9'
];

async function verifyContracts() {
  const web3 = new Web3(SEPOLIA_RPC_URL);
  
  for (const address of addresses) {
    try {
      console.log(`\n🔍 Checking contract: ${address}`);
      
      // Check if address has code
      const code = await web3.eth.getCode(address);
      if (code === '0x') {
        console.log('❌ No contract code found');
        continue;
      }
      
      // Try to interact with contract
      const contract = new web3.eth.Contract(CONTRACT_ABI, address);
      
      const votingActive = await contract.methods.votingActive().call();
      const candidateCount = await contract.methods.candidateCount().call();
      const admin = await contract.methods.admin().call();
      
      console.log('✅ Contract is working!');
      console.log(`   - Voting Active: ${votingActive}`);
      console.log(`   - Candidate Count: ${candidateCount}`);
      console.log(`   - Admin: ${admin}`);
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

verifyContracts();