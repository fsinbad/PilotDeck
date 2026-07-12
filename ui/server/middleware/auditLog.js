import { auditDb } from '../database/db.js';

// Helper to extract client IP from the request
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.socket?.remoteAddress
    || null;
}

// Log an audit entry from a request context.
// logAudit(req, action, resourceType, resourceId, details)
const logAudit = (req, action, resourceType = null, resourceId = null, details = null) => {
  try {
    auditDb.log({
      userId: req.user?.id ?? null,
      action,
      resourceType,
      resourceId: resourceId != null ? String(resourceId) : null,
      details,
      ipAddress: getClientIp(req),
    });
  } catch (err) {
    // Audit logging should never break the request flow
    console.warn('Audit log error:', err.message);
  }
};

export { logAudit };
