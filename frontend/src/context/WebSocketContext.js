import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthContext';

const WebSocketContext = createContext();

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

export const WebSocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [lastMessage, setLastMessage] = useState(null);
  const { user, token } = useAuth();
  
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:5000';

  const connect = () => {
    try {
      console.log('🔄 Connecting to WebSocket...', wsUrl);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('🟢 WebSocket connected');
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0;
        
        // Authenticate if user is logged in
        if (user && token) {
          ws.send(JSON.stringify({
            type: 'authenticate',
            token: token
          }));
        }
        
        // Subscribe to appropriate channels
        if (user?.role === 'admin') {
          ws.send(JSON.stringify({
            type: 'subscribe',
            channel: 'admin-panel'
          }));
        } else {
          ws.send(JSON.stringify({
            type: 'subscribe',
            channel: 'voter-dashboard'
          }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📡 WebSocket message received:', data);
          setLastMessage(data);
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        console.log('🔴 WebSocket disconnected');
        setConnectionStatus('disconnected');
        setSocket(null);
        
        // Auto-reconnect with exponential backoff
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setConnectionStatus('error');
      };

      setSocket(ws);
      
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus('error');
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (socket) {
      socket.close();
    }
    
    setSocket(null);
    setConnectionStatus('disconnected');
  };

  const sendMessage = (message) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected. Message not sent:', message);
    }
  };

  useEffect(() => {
    if (user) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [user, token]);

  // Heartbeat to keep connection alive
  useEffect(() => {
    if (socket && connectionStatus === 'connected') {
      const heartbeat = setInterval(() => {
        sendMessage({ type: 'ping' });
      }, 30000); // Every 30 seconds

      return () => clearInterval(heartbeat);
    }
  }, [socket, connectionStatus]);

  const value = {
    socket,
    connectionStatus,
    lastMessage,
    sendMessage,
    connect,
    disconnect,
    isConnected: connectionStatus === 'connected'
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};