import express from 'express';
import bcrypt from 'bcrypt';
import { userDb } from '../database/db.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';
import { logAudit } from '../middleware/auditLog.js';
import { DISABLE_LOCAL_AUTH } from '../constants/config.js';

const router = express.Router();

// Check auth status and setup requirements
router.get('/status', async (req, res) => {
  try {
    if (DISABLE_LOCAL_AUTH) {
      return res.json({
        needsSetup: false,
        isAuthenticated: true,
        authDisabled: true,
      });
    }
    const hasUsers = await userDb.hasUsers();
    res.json({ 
      needsSetup: !hasUsers,
      isAuthenticated: false, // Will be overridden by frontend if token exists
    });
  } catch (error) {
    console.error('Auth status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User registration (email-based)
router.post('/register', async (req, res) => {
  try {
    if (DISABLE_LOCAL_AUTH) {
      return res.status(403).json({ error: 'Registration is disabled (NUKEMAI_DISABLE_LOCAL_AUTH)' });
    }
    const { email, password, username } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    // Check if email is already registered
    const existingUser = userDb.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    
    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Create user
    const user = userDb.createEmailUser({ 
      email, 
      passwordHash, 
      username: username || email.split('@')[0] 
    });
    
    // Generate token
    const token = generateToken(user);
    
    // Update last login (non-fatal)
    userDb.updateLastLogin(user.id);

    res.json({
      success: true,
      user: { id: user.id, username: user.username, email: user.email },
      token
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(409).json({ error: 'Email already registered' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// User login
router.post('/login', async (req, res) => {
  try {
    if (DISABLE_LOCAL_AUTH) {
      return res.status(403).json({ error: 'Login is disabled (NUKEMAI_DISABLE_LOCAL_AUTH)' });
    }
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Get user from database
    const user = userDb.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Generate token
    const token = generateToken(user);
    
    // Update last login
    userDb.updateLastLogin(user.id);
    
    logAudit(req, 'login', 'user', user.id, { email: user.email });

    res.json({
      success: true,
      user: { id: user.id, username: user.username, email: user.email },
      token
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user (protected route)
router.get('/user', authenticateToken, (req, res) => {
  res.json({
    user: req.user
  });
});

// Logout (client-side token removal, but this endpoint can be used for logging)
router.post('/logout', authenticateToken, (req, res) => {
  // In a simple JWT system, logout is mainly client-side
  // This endpoint exists for consistency and potential future logging
  logAudit(req, 'logout', 'user', req.user.id, { username: req.user.username });
  res.json({ success: true, message: 'Logged out successfully' });
});

export default router;