import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ANSI color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m',
};

const c = {
    info: (text) => `${colors.cyan}${text}${colors.reset}`,
    bright: (text) => `${colors.bright}${text}${colors.reset}`,
    dim: (text) => `${colors.dim}${text}${colors.reset}`,
};

// Use DATABASE_PATH environment variable if set, otherwise use default location
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'auth.db');
const INIT_SQL_PATH = path.join(__dirname, 'init.sql');

// Ensure database directory exists if custom path is provided
if (process.env.DATABASE_PATH) {
  const dbDir = path.dirname(DB_PATH);
  try {
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      console.log(`Created database directory: ${dbDir}`);
    }
  } catch (error) {
    console.error(`Failed to create database directory ${dbDir}:`, error.message);
    throw error;
  }
}

// As part of 1.19.2 we are introducing a new location for auth.db. The below handles exisitng moving legacy database from install directory to new location
const LEGACY_DB_PATH = path.join(__dirname, 'auth.db');
if (DB_PATH !== LEGACY_DB_PATH && !fs.existsSync(DB_PATH) && fs.existsSync(LEGACY_DB_PATH)) {
  try {
    fs.copyFileSync(LEGACY_DB_PATH, DB_PATH);
    console.log(`[MIGRATION] Copied database from ${LEGACY_DB_PATH} to ${DB_PATH}`);
    for (const suffix of ['-wal', '-shm']) {
      if (fs.existsSync(LEGACY_DB_PATH + suffix)) {
        fs.copyFileSync(LEGACY_DB_PATH + suffix, DB_PATH + suffix);
      }
    }
  } catch (err) {
    console.warn(`[MIGRATION] Could not copy legacy database: ${err.message}`);
  }
}

// Create database connection
const db = new Database(DB_PATH);

// app_config must exist before any other module imports (auth.js reads the JWT secret at load time).
// runMigrations() also creates this table, but it runs too late for existing installations
// where auth.js is imported before initializeDatabase() is called.
db.exec(`CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// Show app installation path prominently
const appInstallPath = path.join(__dirname, '../..');
console.log('');
console.log(c.dim('═'.repeat(60)));
console.log(`${c.info('[INFO]')} App Installation: ${c.bright(appInstallPath)}`);
console.log(`${c.info('[INFO]')} Database: ${c.dim(path.relative(appInstallPath, DB_PATH))}`);
if (process.env.DATABASE_PATH) {
  console.log(`       ${c.dim('(Using custom DATABASE_PATH from environment)')}`);
}
console.log(c.dim('═'.repeat(60)));
console.log('');

const runMigrations = () => {
  try {
    const tableInfo = db.prepare("PRAGMA table_info(users)").all();
    const columnNames = tableInfo.map(col => col.name);

    if (!columnNames.includes('git_name')) {
      console.log('Running migration: Adding git_name column');
      db.exec('ALTER TABLE users ADD COLUMN git_name TEXT');
    }

    if (!columnNames.includes('git_email')) {
      console.log('Running migration: Adding git_email column');
      db.exec('ALTER TABLE users ADD COLUMN git_email TEXT');
    }

    if (!columnNames.includes('has_completed_onboarding')) {
      console.log('Running migration: Adding has_completed_onboarding column');
      db.exec('ALTER TABLE users ADD COLUMN has_completed_onboarding BOOLEAN DEFAULT 0');
    }

    // Multi-user + DingTalk SSO migration
    // For old databases: password_hash is NOT NULL and new columns are missing.
    // SQLite cannot ALTER COLUMN to drop NOT NULL, so we recreate the table.
    const passwordHashCol = tableInfo.find(col => col.name === 'password_hash');
    const needsUsersTableMigration = !columnNames.includes('dingtalk_union_id') ||
      (passwordHashCol && passwordHashCol.notnull);

    if (needsUsersTableMigration) {
      console.log('Running migration: Upgrading users table for multi-user + DingTalk SSO');
      db.pragma('foreign_keys = OFF');
      db.exec(`CREATE TABLE users_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME,
        is_active BOOLEAN DEFAULT 1,
        git_name TEXT,
        git_email TEXT,
        has_completed_onboarding BOOLEAN DEFAULT 0,
        dingtalk_union_id TEXT UNIQUE,
        dingtalk_nick TEXT,
        dingtalk_avatar TEXT,
        role TEXT DEFAULT 'member'
      )`);
      // Copy existing data, matching only columns that exist in the old table
      const oldColList = columnNames.join(', ');
      db.exec(`INSERT INTO users_new (${oldColList}) SELECT ${oldColList} FROM users`);
      db.exec('DROP TABLE users');
      db.exec('ALTER TABLE users_new RENAME TO users');
      db.exec('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active)');
      db.pragma('foreign_keys = ON');
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS user_notification_preferences (
        user_id INTEGER PRIMARY KEY,
        preferences_json TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS vapid_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        public_key TEXT NOT NULL,
        private_key TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        endpoint TEXT NOT NULL UNIQUE,
        keys_p256dh TEXT NOT NULL,
        keys_auth TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    // Create app_config table if it doesn't exist (for existing installations)
    db.exec(`CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Create session_names table if it doesn't exist (for existing installations)
    db.exec(`CREATE TABLE IF NOT EXISTS session_names (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'claude',
      custom_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(session_id, provider)
    )`);
    db.exec('CREATE INDEX IF NOT EXISTS idx_session_names_lookup ON session_names(session_id, provider)');

    // Migrate session_names: add user_id column and update UNIQUE constraint
    const sessionTableInfo = db.prepare("PRAGMA table_info(session_names)").all();
    const sessionColumnNames = sessionTableInfo.map(col => col.name);
    if (!sessionColumnNames.includes('user_id')) {
      console.log('Running migration: Adding user_id to session_names and updating UNIQUE constraint');
      db.exec(`ALTER TABLE session_names ADD COLUMN user_id INTEGER`);
      // Recreate the table with the new UNIQUE constraint (SQLite cannot ALTER constraints in-place)
      db.exec(`CREATE TABLE IF NOT EXISTS session_names_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        provider TEXT NOT NULL DEFAULT 'claude',
        custom_name TEXT NOT NULL,
        user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(session_id, provider, user_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`);
      db.exec(`INSERT INTO session_names_new (id, session_id, provider, custom_name, user_id, created_at, updated_at)
               SELECT id, session_id, provider, custom_name, NULL, created_at, updated_at FROM session_names`);
      db.exec(`DROP TABLE session_names`);
      db.exec(`ALTER TABLE session_names_new RENAME TO session_names`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_session_names_lookup ON session_names(session_id, provider)`);
    }

    // Team workspace tables (Phase 3)
    db.exec(`
      CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        owner_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS team_memberships (
        team_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT DEFAULT 'member',
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (team_id, user_id),
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        project_root TEXT NOT NULL,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS workspace_permissions (
        workspace_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        permission TEXT DEFAULT 'read',
        PRIMARY KEY (workspace_id, user_id),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Team workspaces (Phase 3) - create tables for existing installations
    db.exec(`
      CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        owner_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS team_memberships (
        team_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT DEFAULT 'member',
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (team_id, user_id),
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        project_root TEXT NOT NULL,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS workspace_permissions (
        workspace_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        permission TEXT DEFAULT 'read',
        PRIMARY KEY (workspace_id, user_id),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_team_memberships_user ON team_memberships(user_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_team_memberships_team ON team_memberships(team_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_workspaces_team ON workspaces(team_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_workspace_permissions_user ON workspace_permissions(user_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_workspace_permissions_workspace ON workspace_permissions(workspace_id)');

    // Phase 4: operations tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        resource_type TEXT,
        resource_id TEXT,
        details TEXT,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at)');

    db.exec(`
      CREATE TABLE IF NOT EXISTS token_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        workspace_id INTEGER,
        model TEXT,
        prompt_tokens INTEGER DEFAULT 0,
        completion_tokens INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_token_usage_user ON token_usage(user_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_token_usage_created ON token_usage(created_at)');

    db.exec(`
      CREATE TABLE IF NOT EXISTS token_quotas (
        user_id INTEGER PRIMARY KEY,
        daily_limit INTEGER,
        monthly_limit INTEGER,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS concurrency_limits (
        user_id INTEGER PRIMARY KEY,
        max_concurrent_sessions INTEGER DEFAULT 3,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Error running migrations:', error.message);
    throw error;
  }
};

// Initialize database with schema
const initializeDatabase = async () => {
  try {
    const initSQL = fs.readFileSync(INIT_SQL_PATH, 'utf8');
    db.exec(initSQL);
    console.log('Database initialized successfully');
    runMigrations();
  } catch (error) {
    console.error('Error initializing database:', error.message);
    throw error;
  }
};

// User database operations
const userDb = {
  // Check if any users exist
  hasUsers: () => {
    try {
      const row = db.prepare('SELECT COUNT(*) as count FROM users').get();
      return row.count > 0;
    } catch (err) {
      throw err;
    }
  },

  // Create a new user
  createUser: (username, passwordHash) => {
    try {
      const stmt = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
      const result = stmt.run(username, passwordHash);
      return { id: result.lastInsertRowid, username };
    } catch (err) {
      throw err;
    }
  },

  // Get user by username
  getUserByUsername: (username) => {
    try {
      const row = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
      return row;
    } catch (err) {
      throw err;
    }
  },

  // Update last login time (non-fatal — logged but not thrown)
  updateLastLogin: (userId) => {
    try {
      db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
    } catch (err) {
      console.warn('Failed to update last login:', err.message);
    }
  },

  // Get user by ID
  getUserById: (userId) => {
    try {
      const row = db.prepare('SELECT id, username, created_at, last_login, role FROM users WHERE id = ? AND is_active = 1').get(userId);
      return row;
    } catch (err) {
      throw err;
    }
  },

  getFirstUser: () => {
    try {
      const row = db.prepare('SELECT id, username, created_at, last_login, role FROM users WHERE is_active = 1 LIMIT 1').get();
      return row;
    } catch (err) {
      throw err;
    }
  },

  updateGitConfig: (userId, gitName, gitEmail) => {
    try {
      const stmt = db.prepare('UPDATE users SET git_name = ?, git_email = ? WHERE id = ?');
      stmt.run(gitName, gitEmail, userId);
    } catch (err) {
      throw err;
    }
  },

  getGitConfig: (userId) => {
    try {
      const row = db.prepare('SELECT git_name, git_email FROM users WHERE id = ?').get(userId);
      return row;
    } catch (err) {
      throw err;
    }
  },

  completeOnboarding: (userId) => {
    try {
      const stmt = db.prepare('UPDATE users SET has_completed_onboarding = 1 WHERE id = ?');
      stmt.run(userId);
    } catch (err) {
      throw err;
    }
  },

  hasCompletedOnboarding: (userId) => {
    try {
      const row = db.prepare('SELECT has_completed_onboarding FROM users WHERE id = ?').get(userId);
      return row?.has_completed_onboarding === 1;
    } catch (err) {
      throw err;
    }
  },

  // Get user by DingTalk union ID (for SSO login)
  getUserByDingTalkId: (unionId) => {
    try {
      const row = db.prepare('SELECT * FROM users WHERE dingtalk_union_id = ?').get(unionId);
      return row;
    } catch (err) {
      throw err;
    }
  },

  // Create a new DingTalk SSO user (no password)
  createDingTalkUser: ({ unionId, nick, avatar, email, mobile }) => {
    try {
      const username = nick || mobile || unionId;
      const stmt = db.prepare(
        `INSERT INTO users (username, password_hash, dingtalk_union_id, dingtalk_nick, dingtalk_avatar, role)
         VALUES (?, NULL, ?, ?, ?, 'member')`
      );
      const result = stmt.run(username, unionId, nick || null, avatar || null);
      return { id: result.lastInsertRowid, username, dingtalk_union_id: unionId };
    } catch (err) {
      throw err;
    }
  },

  // Get all users (for admin user management)
  getAllUsers: () => {
    try {
      const rows = db.prepare(
        `SELECT id, username, created_at, last_login, is_active, role,
                dingtalk_union_id, dingtalk_nick, dingtalk_avatar
         FROM users ORDER BY created_at ASC`
      ).all();
      return rows;
    } catch (err) {
      throw err;
    }
  },

  // Enable or disable a user
  updateUserStatus: (userId, isActive) => {
    try {
      const stmt = db.prepare('UPDATE users SET is_active = ? WHERE id = ?');
      const result = stmt.run(isActive ? 1 : 0, userId);
      return result.changes > 0;
    } catch (err) {
      throw err;
    }
  },

  // Delete a user
  deleteUser: (userId) => {
    try {
      const stmt = db.prepare('DELETE FROM users WHERE id = ?');
      const result = stmt.run(userId);
      return result.changes > 0;
    } catch (err) {
      throw err;
    }
  }
};

// API Keys database operations
const apiKeysDb = {
  // Generate a new API key
  generateApiKey: () => {
    return 'ck_' + crypto.randomBytes(32).toString('hex');
  },

  // Create a new API key
  createApiKey: (userId, keyName) => {
    try {
      const apiKey = apiKeysDb.generateApiKey();
      const stmt = db.prepare('INSERT INTO api_keys (user_id, key_name, api_key) VALUES (?, ?, ?)');
      const result = stmt.run(userId, keyName, apiKey);
      return { id: result.lastInsertRowid, keyName, apiKey };
    } catch (err) {
      throw err;
    }
  },

  // Get all API keys for a user
  getApiKeys: (userId) => {
    try {
      const rows = db.prepare('SELECT id, key_name, api_key, created_at, last_used, is_active FROM api_keys WHERE user_id = ? ORDER BY created_at DESC').all(userId);
      return rows;
    } catch (err) {
      throw err;
    }
  },

  // Validate API key and get user
  validateApiKey: (apiKey) => {
    try {
      const row = db.prepare(`
        SELECT u.id, u.username, ak.id as api_key_id
        FROM api_keys ak
        JOIN users u ON ak.user_id = u.id
        WHERE ak.api_key = ? AND ak.is_active = 1 AND u.is_active = 1
      `).get(apiKey);

      if (row) {
        // Update last_used timestamp
        db.prepare('UPDATE api_keys SET last_used = CURRENT_TIMESTAMP WHERE id = ?').run(row.api_key_id);
      }

      return row;
    } catch (err) {
      throw err;
    }
  },

  // Delete an API key
  deleteApiKey: (userId, apiKeyId) => {
    try {
      const stmt = db.prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?');
      const result = stmt.run(apiKeyId, userId);
      return result.changes > 0;
    } catch (err) {
      throw err;
    }
  },

  // Toggle API key active status
  toggleApiKey: (userId, apiKeyId, isActive) => {
    try {
      const stmt = db.prepare('UPDATE api_keys SET is_active = ? WHERE id = ? AND user_id = ?');
      const result = stmt.run(isActive ? 1 : 0, apiKeyId, userId);
      return result.changes > 0;
    } catch (err) {
      throw err;
    }
  }
};

// User credentials database operations (for GitHub tokens, GitLab tokens, etc.)
const credentialsDb = {
  // Create a new credential
  createCredential: (userId, credentialName, credentialType, credentialValue, description = null) => {
    try {
      const stmt = db.prepare('INSERT INTO user_credentials (user_id, credential_name, credential_type, credential_value, description) VALUES (?, ?, ?, ?, ?)');
      const result = stmt.run(userId, credentialName, credentialType, credentialValue, description);
      return { id: result.lastInsertRowid, credentialName, credentialType };
    } catch (err) {
      throw err;
    }
  },

  // Get all credentials for a user, optionally filtered by type
  getCredentials: (userId, credentialType = null) => {
    try {
      let query = 'SELECT id, credential_name, credential_type, description, created_at, is_active FROM user_credentials WHERE user_id = ?';
      const params = [userId];

      if (credentialType) {
        query += ' AND credential_type = ?';
        params.push(credentialType);
      }

      query += ' ORDER BY created_at DESC';

      const rows = db.prepare(query).all(...params);
      return rows;
    } catch (err) {
      throw err;
    }
  },

  // Get active credential value for a user by type (returns most recent active)
  getActiveCredential: (userId, credentialType) => {
    try {
      const row = db.prepare('SELECT credential_value FROM user_credentials WHERE user_id = ? AND credential_type = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1').get(userId, credentialType);
      return row?.credential_value || null;
    } catch (err) {
      throw err;
    }
  },

  // Delete a credential
  deleteCredential: (userId, credentialId) => {
    try {
      const stmt = db.prepare('DELETE FROM user_credentials WHERE id = ? AND user_id = ?');
      const result = stmt.run(credentialId, userId);
      return result.changes > 0;
    } catch (err) {
      throw err;
    }
  },

  // Toggle credential active status
  toggleCredential: (userId, credentialId, isActive) => {
    try {
      const stmt = db.prepare('UPDATE user_credentials SET is_active = ? WHERE id = ? AND user_id = ?');
      const result = stmt.run(isActive ? 1 : 0, credentialId, userId);
      return result.changes > 0;
    } catch (err) {
      throw err;
    }
  }
};

const DEFAULT_NOTIFICATION_PREFERENCES = {
  channels: {
    inApp: false,
    webPush: false
  },
  events: {
    actionRequired: true,
    stop: true,
    error: true
  }
};

const normalizeNotificationPreferences = (value) => {
  const source = value && typeof value === 'object' ? value : {};

  return {
    channels: {
      inApp: source.channels?.inApp === true,
      webPush: source.channels?.webPush === true
    },
    events: {
      actionRequired: source.events?.actionRequired !== false,
      stop: source.events?.stop !== false,
      error: source.events?.error !== false
    }
  };
};

const notificationPreferencesDb = {
  getPreferences: (userId) => {
    try {
      const row = db.prepare('SELECT preferences_json FROM user_notification_preferences WHERE user_id = ?').get(userId);
      if (!row) {
        const defaults = normalizeNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
        db.prepare(
          'INSERT INTO user_notification_preferences (user_id, preferences_json, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
        ).run(userId, JSON.stringify(defaults));
        return defaults;
      }

      let parsed;
      try {
        parsed = JSON.parse(row.preferences_json);
      } catch {
        parsed = DEFAULT_NOTIFICATION_PREFERENCES;
      }
      return normalizeNotificationPreferences(parsed);
    } catch (err) {
      throw err;
    }
  },

  updatePreferences: (userId, preferences) => {
    try {
      const normalized = normalizeNotificationPreferences(preferences);
      db.prepare(
        `INSERT INTO user_notification_preferences (user_id, preferences_json, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id) DO UPDATE SET
           preferences_json = excluded.preferences_json,
           updated_at = CURRENT_TIMESTAMP`
      ).run(userId, JSON.stringify(normalized));
      return normalized;
    } catch (err) {
      throw err;
    }
  }
};

const pushSubscriptionsDb = {
  saveSubscription: (userId, endpoint, keysP256dh, keysAuth) => {
    try {
      db.prepare(
        `INSERT INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(endpoint) DO UPDATE SET
           user_id = excluded.user_id,
           keys_p256dh = excluded.keys_p256dh,
           keys_auth = excluded.keys_auth`
      ).run(userId, endpoint, keysP256dh, keysAuth);
    } catch (err) {
      throw err;
    }
  },

  getSubscriptions: (userId) => {
    try {
      return db.prepare('SELECT endpoint, keys_p256dh, keys_auth FROM push_subscriptions WHERE user_id = ?').all(userId);
    } catch (err) {
      throw err;
    }
  },

  removeSubscription: (endpoint) => {
    try {
      db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
    } catch (err) {
      throw err;
    }
  },

  removeAllForUser: (userId) => {
    try {
      db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').run(userId);
    } catch (err) {
      throw err;
    }
  }
};

// Session custom names database operations
const sessionNamesDb = {
  // Set (insert or update) a custom session name
  setName: (sessionId, provider, customName) => {
    db.prepare(`
      INSERT INTO session_names (session_id, provider, custom_name)
      VALUES (?, ?, ?)
      ON CONFLICT(session_id, provider)
      DO UPDATE SET custom_name = excluded.custom_name, updated_at = CURRENT_TIMESTAMP
    `).run(sessionId, provider, customName);
  },

  // Get a single custom session name
  getName: (sessionId, provider) => {
    const row = db.prepare(
      'SELECT custom_name FROM session_names WHERE session_id = ? AND provider = ?'
    ).get(sessionId, provider);
    return row?.custom_name || null;
  },

  // Batch lookup — returns Map<sessionId, customName>
  getNames: (sessionIds, provider) => {
    if (!sessionIds.length) return new Map();
    const placeholders = sessionIds.map(() => '?').join(',');
    const rows = db.prepare(
      `SELECT session_id, custom_name FROM session_names
       WHERE session_id IN (${placeholders}) AND provider = ?`
    ).all(...sessionIds, provider);
    return new Map(rows.map(r => [r.session_id, r.custom_name]));
  },

  // Delete a custom session name
  deleteName: (sessionId, provider) => {
    return db.prepare(
      'DELETE FROM session_names WHERE session_id = ? AND provider = ?'
    ).run(sessionId, provider).changes > 0;
  },
};

// Apply custom session names from the database (overrides CLI-generated summaries)
function applyCustomSessionNames(sessions, provider) {
  if (!sessions?.length) return;
  try {
    const ids = sessions.map(s => s.id);
    const customNames = sessionNamesDb.getNames(ids, provider);
    for (const session of sessions) {
      const custom = customNames.get(session.id);
      if (custom) session.summary = custom;
    }
  } catch (error) {
    console.warn(`[DB] Failed to apply custom session names for ${provider}:`, error.message);
  }
}

// App config database operations
const appConfigDb = {
  get: (key) => {
    try {
      const row = db.prepare('SELECT value FROM app_config WHERE key = ?').get(key);
      return row?.value || null;
    } catch (err) {
      return null;
    }
  },

  set: (key, value) => {
    db.prepare(
      'INSERT INTO app_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run(key, value);
  },

  getOrCreateJwtSecret: () => {
    let secret = appConfigDb.get('jwt_secret');
    if (!secret) {
      secret = crypto.randomBytes(64).toString('hex');
      appConfigDb.set('jwt_secret', secret);
    }
    return secret;
  }
};

// Backward compatibility - keep old names pointing to new system
const githubTokensDb = {
  createGithubToken: (userId, tokenName, githubToken, description = null) => {
    return credentialsDb.createCredential(userId, tokenName, 'github_token', githubToken, description);
  },
  getGithubTokens: (userId) => {
    return credentialsDb.getCredentials(userId, 'github_token');
  },
  getActiveGithubToken: (userId) => {
    return credentialsDb.getActiveCredential(userId, 'github_token');
  },
  deleteGithubToken: (userId, tokenId) => {
    return credentialsDb.deleteCredential(userId, tokenId);
  },
  toggleGithubToken: (userId, tokenId, isActive) => {
    return credentialsDb.toggleCredential(userId, tokenId, isActive);
  }
};

// Team and workspace database operations (Phase 3)
const teamDb = {
  // Create a team and auto-add the owner as 'owner' role
  createTeam: (name, ownerId) => {
    try {
      const insertTeam = db.prepare('INSERT INTO teams (name, owner_id) VALUES (?, ?)');
      const result = insertTeam.run(name, ownerId);
      const teamId = result.lastInsertRowid;
      db.prepare('INSERT INTO team_memberships (team_id, user_id, role) VALUES (?, ?, ?)').run(teamId, ownerId, 'owner');
      return { id: teamId, name, owner_id: ownerId };
    } catch (err) {
      throw err;
    }
  },

  // Get all teams where a user is a member (with their role)
  getUserTeams: (userId) => {
    try {
      return db.prepare(`
        SELECT t.id, t.name, t.owner_id, t.created_at, tm.role, tm.joined_at
        FROM teams t
        JOIN team_memberships tm ON t.id = tm.team_id
        WHERE tm.user_id = ?
        ORDER BY t.created_at ASC
      `).all(userId);
    } catch (err) {
      throw err;
    }
  },

  // Get a team if the user is a member
  getTeam: (teamId, userId) => {
    try {
      return db.prepare(`
        SELECT t.id, t.name, t.owner_id, t.created_at, tm.role
        FROM teams t
        JOIN team_memberships tm ON t.id = tm.team_id
        WHERE t.id = ? AND tm.user_id = ?
      `).get(teamId, userId);
    } catch (err) {
      throw err;
    }
  },

  // Add a member to a team
  addTeamMember: (teamId, userId, role = 'member') => {
    try {
      db.prepare('INSERT INTO team_memberships (team_id, user_id, role) VALUES (?, ?, ?)').run(teamId, userId, role);
      return { teamId, userId, role };
    } catch (err) {
      throw err;
    }
  },

  // Remove a member from a team (prevent removing the owner)
  removeTeamMember: (teamId, userId) => {
    try {
      const membership = db.prepare('SELECT role FROM team_memberships WHERE team_id = ? AND user_id = ?').get(teamId, userId);
      if (!membership) return false;
      if (membership.role === 'owner') return false;
      const result = db.prepare('DELETE FROM team_memberships WHERE team_id = ? AND user_id = ?').run(teamId, userId);
      return result.changes > 0;
    } catch (err) {
      throw err;
    }
  },

  // List all members of a team
  getTeamMembers: (teamId) => {
    try {
      return db.prepare(`
        SELECT u.id, u.username, u.dingtalk_nick, u.dingtalk_avatar, tm.role, tm.joined_at
        FROM team_memberships tm
        JOIN users u ON tm.user_id = u.id
        WHERE tm.team_id = ?
        ORDER BY tm.joined_at ASC
      `).all(teamId);
    } catch (err) {
      throw err;
    }
  },

  // Create a workspace and auto-add the creator as 'admin' permission
  createWorkspace: (teamId, name, projectRoot, createdBy) => {
    try {
      const insertWs = db.prepare('INSERT INTO workspaces (team_id, name, project_root, created_by) VALUES (?, ?, ?, ?)');
      const result = insertWs.run(teamId, name, projectRoot, createdBy);
      const workspaceId = result.lastInsertRowid;
      db.prepare('INSERT INTO workspace_permissions (workspace_id, user_id, permission) VALUES (?, ?, ?)').run(workspaceId, createdBy, 'admin');
      return { id: workspaceId, team_id: teamId, name, project_root: projectRoot, created_by: createdBy };
    } catch (err) {
      throw err;
    }
  },

  // List all workspaces in a team
  getTeamWorkspaces: (teamId) => {
    try {
      return db.prepare(`
        SELECT id, team_id, name, project_root, created_by, created_at
        FROM workspaces
        WHERE team_id = ?
        ORDER BY created_at DESC
      `).all(teamId);
    } catch (err) {
      throw err;
    }
  },

  // Get all workspaces a user has access to (via team membership or direct permission)
  getUserWorkspaces: (userId) => {
    try {
      return db.prepare(`
        SELECT DISTINCT w.id, w.team_id, w.name, w.project_root, w.created_by, w.created_at,
               t.name as team_name,
               COALESCE(wp.permission, 'read') as permission
        FROM workspaces w
        JOIN team_memberships tm ON w.team_id = tm.team_id AND tm.user_id = ?
        JOIN teams t ON w.team_id = t.id
        LEFT JOIN workspace_permissions wp ON w.id = wp.workspace_id AND wp.user_id = ?
        ORDER BY w.created_at DESC
      `).all(userId, userId);
    } catch (err) {
      throw err;
    }
  },

  // Get a workspace if the user has access (via team membership)
  getWorkspace: (workspaceId, userId) => {
    try {
      return db.prepare(`
        SELECT w.id, w.team_id, w.name, w.project_root, w.created_by, w.created_at,
               t.name as team_name,
               COALESCE(wp.permission, 'read') as permission
        FROM workspaces w
        JOIN team_memberships tm ON w.team_id = tm.team_id AND tm.user_id = ?
        JOIN teams t ON w.team_id = t.id
        LEFT JOIN workspace_permissions wp ON w.id = wp.workspace_id AND wp.user_id = ?
        WHERE w.id = ?
      `).get(userId, userId, workspaceId);
    } catch (err) {
      throw err;
    }
  },

  // Get just the project root for a workspace (used by the bridge for isolation)
  getWorkspaceProjectRoot: (workspaceId) => {
    try {
      const row = db.prepare('SELECT project_root FROM workspaces WHERE id = ?').get(workspaceId);
      return row?.project_root || null;
    } catch (err) {
      throw err;
    }
  },

  // Update a user's permission on a workspace
  updateWorkspacePermission: (workspaceId, userId, permission) => {
    try {
      db.prepare(`
        INSERT INTO workspace_permissions (workspace_id, user_id, permission)
        VALUES (?, ?, ?)
        ON CONFLICT(workspace_id, user_id) DO UPDATE SET permission = excluded.permission
      `).run(workspaceId, userId, permission);
      return { workspaceId, userId, permission };
    } catch (err) {
      throw err;
    }
  },

  // Delete a workspace (only if user is admin or team owner)
  deleteWorkspace: (workspaceId, userId) => {
    try {
      const workspace = db.prepare('SELECT team_id FROM workspaces WHERE id = ?').get(workspaceId);
      if (!workspace) return false;
      const membership = db.prepare('SELECT role FROM team_memberships WHERE team_id = ? AND user_id = ?').get(workspace.team_id, userId);
      if (!membership) return false;
      if (membership.role !== 'owner' && membership.role !== 'admin') return false;
      const result = db.prepare('DELETE FROM workspaces WHERE id = ?').run(workspaceId);
      return result.changes > 0;
    } catch (err) {
      throw err;
    }
  },

  // Get a user's permission level for a workspace (or null if no access)
  getWorkspacePermission: (workspaceId, userId) => {
    try {
      const row = db.prepare(`
        SELECT COALESCE(wp.permission, 'read') as permission
        FROM workspaces w
        JOIN team_memberships tm ON w.team_id = tm.team_id AND tm.user_id = ?
        LEFT JOIN workspace_permissions wp ON w.id = wp.workspace_id AND wp.user_id = ?
        WHERE w.id = ?
      `).get(userId, userId, workspaceId);
      return row?.permission || null;
    } catch (err) {
      throw err;
    }
  },

  // List all permissions for a workspace
  getWorkspacePermissions: (workspaceId) => {
    try {
      return db.prepare(`
        SELECT u.id, u.username, u.dingtalk_nick, COALESCE(wp.permission, 'read') as permission
        FROM workspaces w
        JOIN team_memberships tm ON w.team_id = tm.team_id
        JOIN users u ON tm.user_id = u.id
        LEFT JOIN workspace_permissions wp ON w.id = wp.workspace_id AND wp.user_id = u.id
        WHERE w.id = ?
        ORDER BY u.username ASC
      `).all(workspaceId);
    } catch (err) {
      throw err;
    }
  },
};

// Audit log database operations (Phase 4)
const auditDb = {
  log: ({ userId, action, resourceType, resourceId, details, ipAddress }) => {
    try {
      db.prepare(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        userId ?? null,
        action,
        resourceType ?? null,
        resourceId != null ? String(resourceId) : null,
        details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null,
        ipAddress ?? null
      );
    } catch (err) {
      console.warn('Failed to write audit log:', err.message);
    }
  },

  getLogs: ({ limit = 100, offset = 0, userId, action } = {}) => {
    try {
      const conditions = [];
      const params = [];
      if (userId != null) {
        conditions.push('user_id = ?');
        params.push(userId);
      }
      if (action) {
        conditions.push('action = ?');
        params.push(action);
      }
      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const rows = db.prepare(
        `SELECT a.*, u.username
         FROM audit_logs a
         LEFT JOIN users u ON a.user_id = u.id
         ${whereClause}
         ORDER BY a.created_at DESC
         LIMIT ? OFFSET ?`
      ).all(...params, limit, offset);
      return rows;
    } catch (err) {
      throw err;
    }
  },

  countLogs: ({ userId, action } = {}) => {
    try {
      const conditions = [];
      const params = [];
      if (userId != null) {
        conditions.push('user_id = ?');
        params.push(userId);
      }
      if (action) {
        conditions.push('action = ?');
        params.push(action);
      }
      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const row = db.prepare(`SELECT COUNT(*) as count FROM audit_logs ${whereClause}`).get(...params);
      return row?.count || 0;
    } catch (err) {
      throw err;
    }
  },
};

// Token usage database operations (Phase 4)
const tokenUsageDb = {
  recordUsage: ({ userId, workspaceId, model, promptTokens, completionTokens }) => {
    try {
      const pt = promptTokens || 0;
      const ct = completionTokens || 0;
      db.prepare(
        `INSERT INTO token_usage (user_id, workspace_id, model, prompt_tokens, completion_tokens, total_tokens)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(userId, workspaceId ?? null, model ?? null, pt, ct, pt + ct);
    } catch (err) {
      console.warn('Failed to record token usage:', err.message);
    }
  },

  getDailyUsage: (userId) => {
    try {
      const row = db.prepare(
        `SELECT COALESCE(SUM(total_tokens), 0) as total
         FROM token_usage
         WHERE user_id = ? AND date(created_at) = date('now')`
      ).get(userId);
      return row?.total || 0;
    } catch (err) {
      throw err;
    }
  },

  getMonthlyUsage: (userId) => {
    try {
      const row = db.prepare(
        `SELECT COALESCE(SUM(total_tokens), 0) as total
         FROM token_usage
         WHERE user_id = ? AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`
      ).get(userId);
      return row?.total || 0;
    } catch (err) {
      throw err;
    }
  },

  getQuota: (userId) => {
    try {
      const row = db.prepare('SELECT * FROM token_quotas WHERE user_id = ?').get(userId);
      return row || { user_id: userId, daily_limit: null, monthly_limit: null };
    } catch (err) {
      throw err;
    }
  },

  setQuota: (userId, { dailyLimit, monthlyLimit }) => {
    try {
      db.prepare(
        `INSERT INTO token_quotas (user_id, daily_limit, monthly_limit, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id) DO UPDATE SET
           daily_limit = excluded.daily_limit,
           monthly_limit = excluded.monthly_limit,
           updated_at = CURRENT_TIMESTAMP`
      ).run(userId, dailyLimit ?? null, monthlyLimit ?? null);
      return tokenUsageDb.getQuota(userId);
    } catch (err) {
      throw err;
    }
  },

  getUsageStats: ({ userId, startDate, endDate } = {}) => {
    try {
      const conditions = ['user_id = ?'];
      const params = [userId];
      if (startDate) {
        conditions.push('date(created_at) >= date(?)');
        params.push(startDate);
      }
      if (endDate) {
        conditions.push('date(created_at) <= date(?)');
        params.push(endDate);
      }
      const whereClause = `WHERE ${conditions.join(' AND ')}`;
      const rows = db.prepare(
        `SELECT date(created_at) as date, model,
                SUM(prompt_tokens) as prompt_tokens,
                SUM(completion_tokens) as completion_tokens,
                SUM(total_tokens) as total_tokens
         FROM token_usage
         ${whereClause}
         GROUP BY date(created_at), model
         ORDER BY date(created_at) DESC`
      ).all(...params);
      return rows;
    } catch (err) {
      throw err;
    }
  },

  getTopUsers: ({ limit = 10 } = {}) => {
    try {
      const rows = db.prepare(
        `SELECT tu.user_id, u.username,
                SUM(tu.total_tokens) as total_tokens
         FROM token_usage tu
         LEFT JOIN users u ON tu.user_id = u.id
         GROUP BY tu.user_id
         ORDER BY total_tokens DESC
         LIMIT ?`
      ).all(limit);
      return rows;
    } catch (err) {
      throw err;
    }
  },
};

// Concurrency limit database operations (Phase 4)
const concurrencyDb = {
  getLimit: (userId) => {
    try {
      const row = db.prepare('SELECT * FROM concurrency_limits WHERE user_id = ?').get(userId);
      return row || { user_id: userId, max_concurrent_sessions: 3 };
    } catch (err) {
      throw err;
    }
  },

  setLimit: (userId, max) => {
    try {
      db.prepare(
        `INSERT INTO concurrency_limits (user_id, max_concurrent_sessions, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id) DO UPDATE SET
           max_concurrent_sessions = excluded.max_concurrent_sessions,
           updated_at = CURRENT_TIMESTAMP`
      ).run(userId, max);
      return concurrencyDb.getLimit(userId);
    } catch (err) {
      throw err;
    }
  },
};

// In-memory active session tracker for concurrency limiting
const activeSessions = new Map();

const activeSessionTracker = {
  acquire: (userId, sessionKey) => {
    if (!activeSessions.has(userId)) {
      activeSessions.set(userId, new Set());
    }
    activeSessions.get(userId).add(sessionKey);
  },

  release: (userId, sessionKey) => {
    const sessions = activeSessions.get(userId);
    if (sessions) {
      sessions.delete(sessionKey);
      if (sessions.size === 0) {
        activeSessions.delete(userId);
      }
    }
  },

  getActiveCount: (userId) => {
    return activeSessions.get(userId)?.size || 0;
  },
};

export {
  db,
  initializeDatabase,
  userDb,
  apiKeysDb,
  credentialsDb,
  notificationPreferencesDb,
  pushSubscriptionsDb,
  sessionNamesDb,
  applyCustomSessionNames,
  appConfigDb,
  teamDb,
  githubTokensDb, // Backward compatibility
  auditDb,
  tokenUsageDb,
  concurrencyDb,
  activeSessionTracker,
};
