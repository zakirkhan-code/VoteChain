const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Voting Contract", function () {
  let voting;
  let admin;
  let voter1;
  let voter2;

  beforeEach(async function () {
    [admin, voter1, voter2] = await ethers.getSigners();
    
    const Voting = await ethers.getContractFactory("Voting");
    voting = await Voting.deploy();
    await voting.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right admin", async function () {
      expect(await voting.admin()).to.equal(admin.address);
    });

    it("Should have voting inactive initially", async function () {
      expect(await voting.votingActive()).to.equal(false);
    });
  });

  describe("Candidate Management", function () {
    it("Should add candidates", async function () {
      await voting.addCandidate("Alice", "Party A");
      expect(await voting.candidateCount()).to.equal(1);
      
      const [id, name, party, voteCount] = await voting.getCandidate(1);
      expect(name).to.equal("Alice");
      expect(party).to.equal("Party A");
      expect(voteCount).to.equal(0);
    });
  });

  describe("Voting Process", function () {
    beforeEach(async function () {
      await voting.addCandidate("Alice", "Party A");
      await voting.addCandidate("Bob", "Party B");
      await voting.registerVoter(voter1.address);
      await voting.toggleVotingStatus();
    });

    it("Should allow registered voters to vote", async function () {
      await voting.connect(voter1).castVote(1);
      
      const [, , , voteCount] = await voting.getCandidate(1);
      expect(voteCount).to.equal(1);
    });

    it("Should prevent double voting", async function () {
      await voting.connect(voter1).castVote(1);
      
      await expect(
        voting.connect(voter1).castVote(2)
      ).to.be.revertedWith("You have already voted");
    });
  });
});