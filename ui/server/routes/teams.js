import express from 'express';
import { teamDb } from '../database/db.js';

const router = express.Router();

// List user's teams
router.get('/', (req, res) => {
  try {
    const teams = teamDb.getUserTeams(req.user.id);
    res.json({ teams });
  } catch (error) {
    console.error('List teams error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a team
router.post('/', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Team name is required' });
    }
    const team = teamDb.createTeam(name.trim(), req.user.id);
    res.status(201).json({ team });
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get team detail + members
router.get('/:id', (req, res) => {
  try {
    const teamId = parseInt(req.params.id, 10);
    if (!Number.isFinite(teamId)) {
      return res.status(400).json({ error: 'Invalid team id' });
    }

    const team = teamDb.getTeam(teamId, req.user.id);
    if (!team) {
      return res.status(404).json({ error: 'Team not found or access denied' });
    }

    const members = teamDb.getTeamMembers(teamId);
    res.json({ team, members });
  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add a member to a team
router.post('/:id/members', (req, res) => {
  try {
    const teamId = parseInt(req.params.id, 10);
    if (!Number.isFinite(teamId)) {
      return res.status(400).json({ error: 'Invalid team id' });
    }

    // Verify requester is a team member
    const team = teamDb.getTeam(teamId, req.user.id);
    if (!team) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { userId, role } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const validRoles = ['owner', 'admin', 'member'];
    const memberRole = validRoles.includes(role) ? role : 'member';

    // Only owner/admin can add members
    if (team.role === 'member') {
      return res.status(403).json({ error: 'Only team admins can add members' });
    }

    teamDb.addTeamMember(teamId, userId, memberRole);
    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Add team member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove a member from a team
router.delete('/:id/members/:userId', (req, res) => {
  try {
    const teamId = parseInt(req.params.id, 10);
    const targetUserId = parseInt(req.params.userId, 10);
    if (!Number.isFinite(teamId) || !Number.isFinite(targetUserId)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    // Verify requester is a team member
    const team = teamDb.getTeam(teamId, req.user.id);
    if (!team) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Only owner/admin can remove members (or self-remove)
    if (team.role === 'member' && targetUserId !== req.user.id) {
      return res.status(403).json({ error: 'Only team admins can remove members' });
    }

    const success = teamDb.removeTeamMember(teamId, targetUserId);
    if (!success) {
      return res.status(400).json({ error: 'Cannot remove member (owner or not found)' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Remove team member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List workspaces in a team
router.get('/:id/workspaces', (req, res) => {
  try {
    const teamId = parseInt(req.params.id, 10);
    if (!Number.isFinite(teamId)) {
      return res.status(400).json({ error: 'Invalid team id' });
    }

    // Verify requester is a team member
    const team = teamDb.getTeam(teamId, req.user.id);
    if (!team) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const workspaces = teamDb.getTeamWorkspaces(teamId);
    res.json({ workspaces });
  } catch (error) {
    console.error('List team workspaces error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
