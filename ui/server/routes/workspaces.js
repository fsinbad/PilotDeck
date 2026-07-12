import express from 'express';
import { teamDb } from '../database/db.js';

const router = express.Router();

// List user's workspaces (across all teams)
router.get('/', (req, res) => {
  try {
    const workspaces = teamDb.getUserWorkspaces(req.user.id);
    res.json({ workspaces });
  } catch (error) {
    console.error('List workspaces error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a workspace
router.post('/', (req, res) => {
  try {
    const { teamId, name, projectRoot } = req.body;
    if (!teamId || !name || !name.trim()) {
      return res.status(400).json({ error: 'teamId and name are required' });
    }
    if (!projectRoot || !projectRoot.trim()) {
      return res.status(400).json({ error: 'projectRoot is required' });
    }

    const parsedTeamId = parseInt(teamId, 10);
    if (!Number.isFinite(parsedTeamId)) {
      return res.status(400).json({ error: 'Invalid teamId' });
    }

    // Verify user is a member of the team
    const team = teamDb.getTeam(parsedTeamId, req.user.id);
    if (!team) {
      return res.status(403).json({ error: 'Access denied to this team' });
    }

    const workspace = teamDb.createWorkspace(parsedTeamId, name.trim(), projectRoot.trim(), req.user.id);
    res.status(201).json({ workspace });
  } catch (error) {
    console.error('Create workspace error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get workspace detail
router.get('/:id', (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id, 10);
    if (!Number.isFinite(workspaceId)) {
      return res.status(400).json({ error: 'Invalid workspace id' });
    }

    const workspace = teamDb.getWorkspace(workspaceId, req.user.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found or access denied' });
    }

    res.json({ workspace });
  } catch (error) {
    console.error('Get workspace error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete workspace (admin/owner only)
router.delete('/:id', (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id, 10);
    if (!Number.isFinite(workspaceId)) {
      return res.status(400).json({ error: 'Invalid workspace id' });
    }

    const success = teamDb.deleteWorkspace(workspaceId, req.user.id);
    if (!success) {
      return res.status(403).json({ error: 'Cannot delete workspace (not found or insufficient permissions)' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete workspace error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Set workspace permission for a user
router.post('/:id/permissions', (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id, 10);
    if (!Number.isFinite(workspaceId)) {
      return res.status(400).json({ error: 'Invalid workspace id' });
    }

    const { userId, permission } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const validPermissions = ['admin', 'write', 'read'];
    if (!validPermissions.includes(permission)) {
      return res.status(400).json({ error: 'permission must be admin, write, or read' });
    }

    // Verify requester has admin access to the workspace
    const workspace = teamDb.getWorkspace(workspaceId, req.user.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found or access denied' });
    }
    if (workspace.permission !== 'admin') {
      return res.status(403).json({ error: 'Only workspace admins can set permissions' });
    }

    teamDb.updateWorkspacePermission(workspaceId, userId, permission);
    res.json({ success: true });
  } catch (error) {
    console.error('Set workspace permission error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List permissions for a workspace
router.get('/:id/permissions', (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id, 10);
    if (!Number.isFinite(workspaceId)) {
      return res.status(400).json({ error: 'Invalid workspace id' });
    }

    // Verify user has access to the workspace
    const workspace = teamDb.getWorkspace(workspaceId, req.user.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found or access denied' });
    }

    const permissions = teamDb.getWorkspacePermissions(workspaceId);
    res.json({ permissions });
  } catch (error) {
    console.error('List workspace permissions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
