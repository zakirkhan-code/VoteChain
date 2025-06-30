const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Starting deployment...");
  
  // Get the contract factory
  const Voting = await ethers.getContractFactory("Voting");
  
  // Deploy contract
  const voting = await Voting.deploy();
  
  await voting.waitForDeployment();
  
  const contractAddress = await voting.getAddress();
  
  console.log("✅ Voting contract deployed to:", contractAddress);
  console.log("🔗 Verify contract at:", `https://sepolia.etherscan.io/address/${contractAddress}`);
  
  // Save deployment info
  const fs = require('fs');
  const deploymentInfo = {
    contractAddress: contractAddress,
    network: "sepolia",
    deployedAt: new Date().toISOString()
  };
  
  fs.writeFileSync('deployment.json', JSON.stringify(deploymentInfo, null, 2));
  console.log("📄 Deployment info saved to deployment.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });