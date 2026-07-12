import express from 'express';
import crypto from 'crypto';
import { userDb } from '../database/db.js';
import { generateToken } from '../middleware/auth.js';
import { DINGTALK_SSO_ENABLED } from '../constants/config.js';

const router = express.Router();

const DINGTALK_APP_KEY = process.env.DINGTALK_APP_KEY;
const DINGTALK_APP_SECRET = process.env.DINGTALK_APP_SECRET;
const DINGTALK_REDIRECT_URI = process.env.DINGTALK_REDIRECT_URI;

// In-memory state store for CSRF protection (5 minute TTL)
const stateStore = new Map();
const STATE_TTL = 5 * 60 * 1000;

// Clean up expired states every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of stateStore.entries()) {
    if (now > value.expiresAt) {
      stateStore.delete(key);
    }
  }
}, 60 * 1000);

// Check if DingTalk SSO is enabled (for frontend to decide which login UI to show)
router.get('/dingtalk/status', (req, res) => {
  res.json({ enabled: DINGTALK_SSO_ENABLED });
});

// Initiate DingTalk OAuth2 login — redirect user to DingTalk authorization page
router.get('/dingtalk', (req, res) => {
  if (!DINGTALK_SSO_ENABLED) {
    return res.status(403).json({ error: 'DingTalk SSO is not configured' });
  }

  const state = crypto.randomBytes(32).toString('hex');
  stateStore.set(state, { expiresAt: Date.now() + STATE_TTL });

  const authUrl = new URL('https://login.dingtalk.com/oauth2/auth');
  authUrl.searchParams.set('client_id', DINGTALK_APP_KEY);
  authUrl.searchParams.set('redirect_uri', DINGTALK_REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('prompt', 'consent');

  res.redirect(authUrl.toString());
});

// Handle DingTalk OAuth2 callback
router.get('/dingtalk/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    // Verify state for CSRF protection
    if (!state || !stateStore.has(state)) {
      return res.redirect('/auth/callback?error=invalid_state');
    }
    stateStore.delete(state);

    if (!code) {
      return res.redirect('/auth/callback?error=missing_code');
    }

    // Step 1: Exchange auth code for user access token
    const tokenRes = await fetch('https://api.dingtalk.com/v1.0/oauth2/userAccessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: DINGTALK_APP_KEY,
        clientSecret: DINGTALK_APP_SECRET,
        code,
        grantType: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('DingTalk token exchange failed:', errText);
      return res.redirect('/auth/callback?error=token_exchange_failed');
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.accessToken;
    if (!accessToken) {
      console.error('DingTalk token exchange: no accessToken in response', tokenData);
      return res.redirect('/auth/callback?error=no_access_token');
    }

    // Step 2: Get user info from DingTalk
    const userRes = await fetch('https://api.dingtalk.com/v1.0/contact/users/me', {
      headers: { 'x-acs-dingtalk-access-token': accessToken },
    });

    if (!userRes.ok) {
      const errText = await userRes.text();
      console.error('DingTalk user info fetch failed:', errText);
      return res.redirect('/auth/callback?error=user_info_failed');
    }

    const dingtalkUser = await userRes.json();
    const unionId = dingtalkUser.unionId;
    if (!unionId) {
      console.error('DingTalk user info: no unionId in response', dingtalkUser);
      return res.redirect('/auth/callback?error=no_union_id');
    }

    // Step 3: Find or create user in local database
    let user = userDb.getUserByDingTalkId(unionId);
    let isNewUser = false;

    if (!user) {
      user = userDb.createDingTalkUser({
        unionId,
        nick: dingtalkUser.nick || null,
        avatar: dingtalkUser.avatarUrl || null,
        email: dingtalkUser.email || null,
        mobile: dingtalkUser.mobile || null,
      });
      isNewUser = true;
    }

    if (!user || !user.id) {
      console.error('Failed to find or create user for DingTalk unionId:', unionId);
      return res.redirect('/auth/callback?error=user_creation_failed');
    }

    // Check if user account is active (skip for newly created users)
    if (!isNewUser && user.is_active === 0) {
      return res.redirect('/auth/callback?error=account_disabled');
    }

    // Step 4: Generate JWT token
    const token = generateToken(user);

    // Update last login time
    userDb.updateLastLogin(user.id);

    // Step 5: Redirect to frontend with token
    res.redirect(`/auth/callback?token=${token}&userId=${user.id}`);
  } catch (error) {
    console.error('DingTalk OAuth callback error:', error);
    res.redirect('/auth/callback?error=server_error');
  }
});

export default router;
