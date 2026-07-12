import express from 'express';
import { auditDb } from '../database/db.js';

const router = express.Router();

// Admin check middleware
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

router.use(requireAdmin);

// GET /api/audit-logs - list logs with filters
router.get('/', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const offset = parseInt(req.query.offset, 10) || 0;
    const userId = req.query.userId ? parseInt(req.query.userId, 10) : undefined;
    const action = req.query.action || undefined;

    const logs = auditDb.getLogs({ limit, offset, userId, action });
    const total = auditDb.countLogs({ userId, action });

    res.json({ logs, total, limit, offset });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
