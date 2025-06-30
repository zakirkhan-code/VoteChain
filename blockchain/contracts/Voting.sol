// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract Voting {
    // Structures
    struct Candidate {
        uint256 id;
        string name;
        string party;
        uint256 voteCount;
        bool exists;
    }
    
    struct Voter {
        bool isRegistered;
        bool hasVoted;
        uint256 votedFor;
    }
    
    // State variables
    address public admin;
    uint256 public candidateCount;
    bool public votingActive;
    
    // Mappings
    mapping(uint256 => Candidate) public candidates;
    mapping(address => Voter) public voters;
    
    // Events
    event CandidateAdded(uint256 indexed candidateId, string name, string party);
    event VoteCasted(address indexed voter, uint256 indexed candidateId);
    event VotingStatusChanged(bool status);
    event VoterRegistered(address indexed voter);
    
    // Modifiers
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }
    
    modifier onlyWhenVotingActive() {
        require(votingActive, "Voting is not active");
        _;
    }
    
    modifier onlyRegisteredVoter() {
        require(voters[msg.sender].isRegistered, "You are not registered to vote");
        _;
    }
    
    // Constructor
    constructor() {
        admin = msg.sender;
        votingActive = false;
        candidateCount = 0;
    }
    
    // Admin functions
    function addCandidate(string memory _name, string memory _party) 
        public 
        onlyAdmin 
    {
        require(!votingActive, "Cannot add candidates during active voting");
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(bytes(_party).length > 0, "Party cannot be empty");
        
        candidateCount++;
        candidates[candidateCount] = Candidate({
            id: candidateCount,
            name: _name,
            party: _party,
            voteCount: 0,
            exists: true
        });
        
        emit CandidateAdded(candidateCount, _name, _party);
    }
    
    function toggleVotingStatus() public onlyAdmin {
        votingActive = !votingActive;
        emit VotingStatusChanged(votingActive);
    }
    
    function registerVoter(address _voter) public onlyAdmin {
        require(!voters[_voter].isRegistered, "Voter already registered");
        
        voters[_voter] = Voter({
            isRegistered: true,
            hasVoted: false,
            votedFor: 0
        });
        
        emit VoterRegistered(_voter);
    }
    
    // Voter functions
    function castVote(uint256 _candidateId) 
        public 
        onlyWhenVotingActive 
        onlyRegisteredVoter 
    {
        require(!voters[msg.sender].hasVoted, "You have already voted");
        require(candidates[_candidateId].exists, "Invalid candidate");
        
        voters[msg.sender].hasVoted = true;
        voters[msg.sender].votedFor = _candidateId;
        candidates[_candidateId].voteCount++;
        
        emit VoteCasted(msg.sender, _candidateId);
    }
    
    // View functions
    function getCandidate(uint256 _candidateId) 
        public 
        view 
        returns (uint256, string memory, string memory, uint256) 
    {
        require(candidates[_candidateId].exists, "Candidate does not exist");
        Candidate memory candidate = candidates[_candidateId];
        return (candidate.id, candidate.name, candidate.party, candidate.voteCount);
    }
    
    function getAllCandidates() public view returns (Candidate[] memory) {
        Candidate[] memory allCandidates = new Candidate[](candidateCount);
        
        for (uint256 i = 1; i <= candidateCount; i++) {
            allCandidates[i - 1] = candidates[i];
        }
        
        return allCandidates;
    }
    
    function getVoterInfo(address _voter) 
        public 
        view 
        returns (bool, bool, uint256) 
    {
        Voter memory voter = voters[_voter];
        return (voter.isRegistered, voter.hasVoted, voter.votedFor);
    }
    
    function getWinner() public view returns (string memory, uint256) {
        require(candidateCount > 0, "No candidates available");
        
        uint256 winningVoteCount = 0;
        string memory winnerName = "";
        
        for (uint256 i = 1; i <= candidateCount; i++) {
            if (candidates[i].voteCount > winningVoteCount) {
                winningVoteCount = candidates[i].voteCount;
                winnerName = candidates[i].name;
            }
        }
        
        return (winnerName, winningVoteCount);
    }
    
    function getTotalVotes() public view returns (uint256) {
        uint256 totalVotes = 0;
        for (uint256 i = 1; i <= candidateCount; i++) {
            totalVotes += candidates[i].voteCount;
        }
        return totalVotes;
    }
}