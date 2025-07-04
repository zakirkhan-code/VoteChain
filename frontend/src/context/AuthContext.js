import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

// API base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('votechain_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('votechain_token');
      localStorage.removeItem('votechain_user');
      
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      const savedToken = localStorage.getItem('votechain_token');
      const savedUser = localStorage.getItem('votechain_user');

      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
        
        // Verify token is still valid
        try {
          await verifyToken();
        } catch (verifyError) {
          console.error('Token verification failed:', verifyError);
          logout();
        }
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const verifyToken = async () => {
    try {
      const response = await api.post('/auth/verify-token');
      if (response.data.success && response.data.data?.user) {
        const updatedUser = response.data.data.user;
        setUser(updatedUser);
        localStorage.setItem('votechain_user', JSON.stringify(updatedUser));
      }
      return response.data;
    } catch (error) {
      console.error('Token verification failed:', error);
      logout();
      throw error;
    }
  };

  const register = async (userData) => {
    try {
      setLoading(true);
      setError(null);

      if (!userData.username || !userData.email || !userData.password) {
        throw new Error('All fields are required');
      }

      const response = await api.post('/auth/register', {
        username: userData.username.trim(),
        email: userData.email.trim().toLowerCase(),
        password: userData.password,
        walletAddress: userData.walletAddress?.trim() || null
      });
      
      if (response.data.success) {
        const { token, user } = response.data.data;
        
        localStorage.setItem('votechain_token', token);
        localStorage.setItem('votechain_user', JSON.stringify(user));
        
        setToken(token);
        setUser(user);
        
        return response.data;
      } else {
        throw new Error(response.data.message || 'Registration failed');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Registration failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials) => {
    try {
      setLoading(true);
      setError(null);

      if (!credentials.email || !credentials.password) {
        throw new Error('Email and password are required');
      }

      const response = await api.post('/auth/login', {
        email: credentials.email.trim().toLowerCase(),
        password: credentials.password
      });
      
      if (response.data.success) {
        const { token, user } = response.data.data;
        
        localStorage.setItem('votechain_token', token);
        localStorage.setItem('votechain_user', JSON.stringify(user));
        
        setToken(token);
        setUser(user);
        
        return response.data;
      } else {
        throw new Error(response.data.message || 'Login failed');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Login failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('votechain_token');
    localStorage.removeItem('votechain_user');
    setToken(null);
    setUser(null);
    setError(null);
  };

  const updateProfile = async (profileData) => {
    try {
      setLoading(true);
      setError(null);

      console.log('Updating profile with data:', profileData);

      const response = await api.put('/auth/profile', profileData);
      
      if (response.data.success) {
        const updatedUser = response.data.data.user;
        setUser(updatedUser);
        localStorage.setItem('votechain_user', JSON.stringify(updatedUser));
        
        console.log('Profile updated successfully:', updatedUser);
        return response.data;
      } else {
        throw new Error(response.data.message || 'Profile update failed');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Profile update failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getProfile = async () => {
    try {
      const response = await api.get('/auth/profile');
      if (response.data.success) {
        const userData = response.data.data.user;
        setUser(userData);
        localStorage.setItem('votechain_user', JSON.stringify(userData));
        return userData;
      } else {
        throw new Error(response.data.message || 'Failed to get profile');
      }
    } catch (error) {
      console.error('Get profile error:', error);
      throw error;
    }
  };

  const refreshUserData = async () => {
    try {
      await getProfile();
    } catch (error) {
      console.error('Failed to refresh user data:', error);
    }
  };

  const changePassword = async (passwordData) => {
    try {
      setLoading(true);
      setError(null);

      if (!passwordData.currentPassword || !passwordData.newPassword) {
        throw new Error('Current password and new password are required');
      }

      if (passwordData.newPassword.length < 6) {
        throw new Error('New password must be at least 6 characters long');
      }

      const response = await api.put('/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });

      if (response.data.success) {
        return response.data;
      } else {
        throw new Error(response.data.message || 'Password change failed');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Password change failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    // State
    user,
    token,
    loading,
    error,
    isAuthenticated: !!token && !!user,
    isAdmin: user?.role === 'admin',
    
    // Actions
    register,
    login,
    logout,
    updateProfile,
    getProfile,
    refreshUserData,
    verifyToken,
    changePassword,
    
    // API instance for other components
    api,
    
    // Helper functions
    clearError: () => setError(null),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;