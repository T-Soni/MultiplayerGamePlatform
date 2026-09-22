const path = require('path');

let jwt;
try {
  jwt = require('jsonwebtoken');
} catch {
  const candidatePaths = [
    path.join(__dirname, '../auth-service'),
    path.join(__dirname, '../api-gateway')
  ];
  for (const p of candidatePaths) {
    try {
      const resolved = require.resolve('jsonwebtoken', { paths: [p] });
      jwt = require(resolved);
      break;
    } catch (_) {}
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_game_jwt_key_2026';

/**
 * Authentication Middleware for protected routes
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

/**
 * Optional Admin authorization middleware
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin privileges required' });
  }
  next();
}

module.exports = { authenticateToken, requireAdmin, JWT_SECRET };
