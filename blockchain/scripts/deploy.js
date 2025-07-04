const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("🚀 Starting VoteChain deployment...");
  
  // Get the contract factory
  const Voting = await ethers.getContractFactory("Voting");
  
  // Deploy contract
  console.log("📦 Deploying contract...");
  const voting = await Voting.deploy();
  
  // Wait for deployment to complete
  await voting.waitForDeployment();
  
  const contractAddress = await voting.getAddress();
  const network = await ethers.provider.getNetwork();
  
  // Get deployer address (fixed)
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  
  console.log("✅ Contract deployed successfully!");
  console.log("📍 Contract Address:", contractAddress);
  console.log("🌐 Network:", network.name);
  console.log("👤 Deployer:", deployerAddress);
  
  // Verify on Etherscan if on testnet/mainnet
  if (network.chainId !== 31337n) { // Not localhost
    console.log("🔗 Verify contract at:");
    if (network.chainId === 11155111n) { // Sepolia
      console.log(`https://sepolia.etherscan.io/address/${contractAddress}`);
    }
  }
  
  // Save deployment info
  const deploymentInfo = {
    contractAddress: contractAddress,
    network: network.name,
    chainId: Number(network.chainId),
    deployedAt: new Date().toISOString(),
    deployer: deployerAddress
  };
  
  // Save to file
  const deploymentPath = path.join(__dirname, '../deployment.json');
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("📄 Deployment info saved to deployment.json");
  
  // Generate ABI file for frontend
  const artifactPath = path.join(__dirname, '../artifacts/contracts/Voting.sol/Voting.json');
  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    const abiPath = path.join(__dirname, '../abi.json');
    fs.writeFileSync(abiPath, JSON.stringify(artifact.abi, null, 2));
    console.log("📋 ABI saved to abi.json");
  }
  
  console.log("\n🎉 Deployment completed successfully!");
  console.log("Next steps:");
  console.log("1. Save the contract address");
  console.log("2. Copy ABI to frontend");
  console.log("3. Update frontend configuration");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });