import React from 'react';
import { Link } from 'react-router-dom';
import { Vote, Github, Twitter, Mail, ExternalLink } from 'lucide-react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1">
            <div className="flex items-center space-x-2 mb-4">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Vote className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold">VoteChain</span>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Secure, transparent, and decentralized voting powered by blockchain technology.
            </p>
            <div className="flex space-x-4">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors duration-200"
              >
                <Github className="w-5 h-5" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors duration-200"
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a
                href="mailto:contact@votechain.com"
                className="text-gray-400 hover:text-white transition-colors duration-200"
              >
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="col-span-1">
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link 
                  to="/dashboard" 
                  className="text-gray-400 hover:text-white transition-colors duration-200 text-sm"
                >
                  Dashboard
                </Link>
              </li>
              <li>
                <Link 
                  to="/vote" 
                  className="text-gray-400 hover:text-white transition-colors duration-200 text-sm"
                >
                  Vote
                </Link>
              </li>
              <li>
                <Link 
                  to="/results" 
                  className="text-gray-400 hover:text-white transition-colors duration-200 text-sm"
                >
                  Results
                </Link>
              </li>
              <li>
                <Link 
                  to="/profile" 
                  className="text-gray-400 hover:text-white transition-colors duration-200 text-sm"
                >
                  Profile
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div className="col-span-1">
            <h3 className="text-lg font-semibold mb-4">Resources</h3>
            <ul className="space-y-2">
              <li>
                <a 
                  href="https://docs.ethereum.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors duration-200 text-sm flex items-center space-x-1"
                >
                  <span>Ethereum Docs</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                <a 
                  href="https://metamask.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors duration-200 text-sm flex items-center space-x-1"
                >
                  <span>MetaMask</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                <a 
                  href="https://sepolia.etherscan.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors duration-200 text-sm flex items-center space-x-1"
                >
                  <span>Sepolia Explorer</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                <Link 
                  to="/help" 
                  className="text-gray-400 hover:text-white transition-colors duration-200 text-sm"
                >
                  Help Center
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="col-span-1">
            <h3 className="text-lg font-semibold mb-4">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link 
                  to="/privacy" 
                  className="text-gray-400 hover:text-white transition-colors duration-200 text-sm"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link 
                  to="/terms" 
                  className="text-gray-400 hover:text-white transition-colors duration-200 text-sm"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link 
                  to="/security" 
                  className="text-gray-400 hover:text-white transition-colors duration-200 text-sm"
                >
                  Security
                </Link>
              </li>
              <li>
                <Link 
                  to="/contact" 
                  className="text-gray-400 hover:text-white transition-colors duration-200 text-sm"
                >
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-gray-800 mt-8 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-gray-400 text-sm mb-4 md:mb-0">
              © {currentYear} VoteChain. All rights reserved. Built with blockchain technology.
            </div>
            <div className="flex items-center space-x-6 text-sm text-gray-400">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Blockchain Active</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>Sepolia Network</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Technical Info */}
      <div className="bg-gray-800 py-4">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center text-xs text-gray-500">
            <div>
              Smart Contract: {process.env.REACT_APP_CONTRACT_ADDRESS ? 
                `${process.env.REACT_APP_CONTRACT_ADDRESS.slice(0, 10)}...` : 
                'Not configured'
              }
            </div>
            <div className="flex items-center space-x-4 mt-2 md:mt-0">
              <span>Version 1.0.0</span>
              <span>•</span>
              <span>React + Web3</span>
              <span>•</span>
              <span>Solidity</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;