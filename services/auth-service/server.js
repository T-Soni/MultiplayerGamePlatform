const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { createLogger } = require('../shared/logger');
const { authenticateToken, JWT_SECRET } = require('../shared/authMiddleware');
const db = require('./db');

const logger = createLogger('AuthService');
const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
  res.json({ service: 'auth-service', status: 'healthy', timestamp: new Date().toISOString() });
});

/**
 * POST /api/auth/register
 * Body: { username, password, role }
 */
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const existingUser = await db.getUserByUsername(username.trim());
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const userId = `usr-${crypto.randomUUID().slice(0, 8)}`;
    const assignedRole = role === 'admin' ? 'admin' : 'player';

    const user = await db.createUser(userId, username.trim(), passwordHash, assignedRole, 100);

    // Multi-terminal support: Each terminal gets a signed token with terminal/session metadata
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    logger.info(`User registered successfully: ${user.username} (${user.id})`);
    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        credits: user.credits
      }
    });
  } catch (err) {
    logger.error('Registration failed:', err);
    return res.status(500).json({ error: 'Internal server error during registration' });
  }
});

/**
 * POST /api/auth/login
 * Body: { username, password }
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await db.getUserByUsername(username.trim());
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Generate JWT for multi-terminal login
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    logger.info(`User logged in: ${user.username} (${user.id}) from terminal/client`);
    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        credits: user.credits
      }
    });
  } catch (err) {
    logger.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error during login' });
  }
});

/**
 * GET /api/auth/verify
 * Header: Authorization: Bearer <token>
 */
app.get('/api/auth/verify', authenticateToken, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User no longer exists' });
    }
    return res.json({ user });
  } catch (err) {
    logger.error('Token verification error:', err);
    return res.status(500).json({ error: 'Failed to verify user' });
  }
});

/**
 * GET /api/auth/users
 * Returns user list with credits
 */
app.get('/api/auth/users', async (req, res) => {
  try {
    const users = await db.getAllUsers();
    return res.json({ users });
  } catch (err) {
    logger.error('Failed to get users:', err);
    return res.status(500).json({ error: 'Failed to retrieve users' });
  }
});

/**
 * PATCH /api/auth/users/:id/credits
 * Internal endpoint called by Analytics & Scoring Service
 * Body: { delta: number }
 */
app.patch('/api/auth/users/:id/credits', async (req, res) => {
  try {
    const { id } = req.params;
    const { delta } = req.body;
    if (typeof delta !== 'number') {
      return res.status(400).json({ error: 'Numeric credit delta required' });
    }

    const updatedUser = await db.updateUserCredits(id, delta);
    logger.info(`Updated credits for user ${id} by delta ${delta}: new balance ${updatedUser ? updatedUser.credits : 'unknown'}`);
    return res.json({ user: updatedUser });
  } catch (err) {
    logger.error('Failed to update credits:', err);
    return res.status(500).json({ error: 'Failed to update credits' });
  }
});

// Initialize database and start server
db.seedDefaultUsers().then(() => {
  app.listen(PORT, () => {
    logger.info(`Auth Service running on http://0.0.0.0:${PORT}`);
  });
}).catch(err => {
  logger.error('Failed to seed default users:', err);
  process.exit(1);
});
