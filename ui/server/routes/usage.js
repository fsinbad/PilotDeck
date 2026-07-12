import express from 'express';
import { tokenUsageDb, concurrencyDb, userDb } from '../database/db.js';

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

// GET /api/usage - current user's usage stats
router.get('/', (req, res) => {
  try {
    const userId = req.user.id;
    const daily = tokenUsageDb.getDailyUsage(userId);
    const monthly = tokenUsageDb.getMonthlyUsage(userId);
    const quota = tokenUsageDb.getQuota(userId);

    const dailyRemaining = quota.daily_limit != null ? Math.max(0, quota.daily_limit - daily) : null;
    const monthlyRemaining = quota.monthly_limit != null ? Math.max(0, quota.monthly_limit - monthly) : null;

    res.json({
      daily,
      monthly,
      quota: {
        daily_limit: quota.daily_limit,
        monthly_limit: quota.monthly_limit,
      },
      remaining: {
        daily: dailyRemaining,
        monthly: monthlyRemaining,
      },
    });
  } catch (error) {
    console.error('Get usage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/usage/history - usage history with date range
router.get('/history', (req, res) => {
  try {
    const userId = req.user.id;
    const startDate = req.query.startDate || undefined;
    const endDate = req.query.endDate || undefined;

    const stats = tokenUsageDb.getUsageStats({ userId, startDate, endDate });
    res.json({ stats });
  } catch (error) {
    console.error('Get usage history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/usage/top-users - top users by token usage (admin only)
router.get('/top-users', requireAdmin, (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 100);
    const topUsers = tokenUsageDb.getTopUsers({ limit });
    res.json({ topUsers });
  } catch (error) {
    console.error('Get top users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/:id/usage - admin: specific user's usage
router.get('/users/:id/usage', requireAdmin, (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const daily = tokenUsageDb.getDailyUsage(userId);
    const monthly = tokenUsageDb.getMonthlyUsage(userId);
    const quota = tokenUsageDb.getQuota(userId);
    const startDate = req.query.startDate || undefined;
    const endDate = req.query.endDate || undefined;
    const stats = tokenUsageDb.getUsageStats({ userId, startDate, endDate });

    res.json({
      daily,
      monthly,
      quota: {
        daily_limit: quota.daily_limit,
        monthly_limit: quota.monthly_limit,
      },
      stats,
    });
  } catch (error) {
    console.error('Get user usage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/:id/quota - admin: set user's token quota
router.put('/users/:id/quota', requireAdmin, (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const { dailyLimit, monthlyLimit } = req.body;
    const quota = tokenUsageDb.setQuota(userId, {
      dailyLimit: dailyLimit != null ? Number(dailyLimit) : null,
      monthlyLimit: monthlyLimit != null ? Number(monthlyLimit) : null,
    });

    res.json({ success: true, quota });
  } catch (error) {
    console.error('Set quota error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/:id/concurrency - admin: set user's concurrency limit
router.put('/users/:id/concurrency', requireAdmin, (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const { maxConcurrentSessions } = req.body;
    if (!Number.isFinite(Number(maxConcurrentSessions)) || Number(maxConcurrentSessions) < 1) {
      return res.status(400).json({ error: 'maxConcurrentSessions must be a positive integer' });
    }

    const limit = concurrencyDb.setLimit(userId, Number(maxConcurrentSessions));
    res.json({ success: true, limit });
  } catch (error) {
    console.error('Set concurrency error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/:id/concurrency - admin: get user's concurrency limit
router.get('/users/:id/concurrency', requireAdmin, (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const limit = concurrencyDb.getLimit(userId);
    res.json({ limit });
  } catch (error) {
    console.error('Get concurrency error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
