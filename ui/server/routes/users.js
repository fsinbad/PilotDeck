import express from 'express';
import { userDb } from '../database/db.js';
import { logAudit } from '../middleware/auditLog.js';

const router = express.Router();

// Admin check middleware:
// User is admin if role === 'admin' or they are the first user (id === 1)
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const isAdmin = req.user.role === 'admin' || req.user.id === 1;
  if (!isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
};

// Apply admin check to all routes in this router.
// authenticateToken is applied at the mount point in index.js.
router.use(requireAdmin);

// List all users
router.get('/', (req, res) => {
  try {
    const users = userDb.getAllUsers();
    res.json({ users });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user status (enable/disable)
router.patch('/:id/status', (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const { is_active } = req.body;
    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active must be a boolean' });
    }

    // Prevent admin from disabling themselves
    if (userId === req.user.id && !is_active) {
      return res.status(400).json({ error: 'Cannot disable your own account' });
    }

    const success = userDb.updateUserStatus(userId, is_active);
    if (!success) {
      return res.status(404).json({ error: 'User not found' });
    }

    logAudit(req, 'update_user_status', 'user', userId, { is_active });
    res.json({ success: true });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user
router.delete('/:id', (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    // Prevent admin from deleting themselves
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const success = userDb.deleteUser(userId);
    if (!success) {
      return res.status(404).json({ error: 'User not found' });
    }

    logAudit(req, 'delete_user', 'user', userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
