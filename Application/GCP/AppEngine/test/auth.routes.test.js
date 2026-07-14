const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

function mockModule(modulePath, exportsValue) {
  const resolved = require.resolve(modulePath);
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: exportsValue,
  };
  return resolved;
}

function clearModule(modulePath) {
  const resolved = require.resolve(modulePath);
  delete require.cache[resolved];
}

async function withServer(router) {
  const app = express();
  app.use(express.json());
  app.use(router);

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const port = server.address().port;

  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

test('POST /auth/login returns access and refresh tokens', async () => {
  const userStorePath = require.resolve('../auth/userStore');
  const jwtPath = require.resolve('../auth/jwt');
  const refreshStorePath = require.resolve('../auth/refreshTokenStore');
  const routePath = require.resolve('../api/auth');

  mockModule(userStorePath, {
    findByUsernameWithHash: async () => ({
      id: 'user-1',
      username: 'coach',
      password_hash: 'hash',
      name: 'Coach',
      role: 'coach',
      club_id: null,
      photo_asset: null,
      is_active: true,
      email: 'coach@example.com',
    }),
    verifyPassword: async () => true,
    findById: async () => null,
    toPublic: (row) => ({
      id: row.id,
      name: row.name,
      role: row.role,
      isActive: true,
    }),
  });

  mockModule(jwtPath, {
    signAccessToken: () => 'access-token',
    signRefreshToken: () => 'refresh-token',
    verifyRefreshToken: () => ({ exp: Math.floor(Date.now() / 1000) + 3600, sessionId: 'session-1', tokenId: 'token-1', userId: 'user-1' }),
    decodeRefreshToken: () => null,
    requireAuth: () => {
      throw new Error('not expected');
    },
  });

  let storedRefresh = null;
  mockModule(refreshStorePath, {
    createRefreshToken: async (payload) => {
      storedRefresh = payload;
    },
    getRefreshTokenById: async () => null,
    matchesRefreshToken: () => false,
    rotateRefreshToken: async () => ({ ok: false, code: 'invalid' }),
    revokeSession: async () => 0,
    revokeUserSessions: async () => 0,
  });

  clearModule(routePath);
  const router = require(routePath);
  const server = await withServer(router);

  try {
    const resp = await fetch(`${server.url}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'coach', password: 'password123' }),
    });
    assert.equal(resp.status, 200);
    const data = await resp.json();
    assert.equal(data.accessToken, 'access-token');
    assert.equal(data.refreshToken, 'refresh-token');
    assert.equal(data.token, 'access-token');
    assert.equal(data.user.id, 'user-1');
    assert.equal(typeof storedRefresh.tokenId, 'string');
    assert.ok(storedRefresh.tokenId.length > 10);
  } finally {
    await server.close();
    clearModule(routePath);
    clearModule(userStorePath);
    clearModule(jwtPath);
    clearModule(refreshStorePath);
  }
});

test('POST /auth/refresh rotates the refresh token', async () => {
  const userStorePath = require.resolve('../auth/userStore');
  const jwtPath = require.resolve('../auth/jwt');
  const refreshStorePath = require.resolve('../auth/refreshTokenStore');
  const routePath = require.resolve('../api/auth');

  mockModule(userStorePath, {
    findByUsernameWithHash: async () => null,
    verifyPassword: async () => false,
    findById: async () => ({ id: 'user-1', name: 'Coach', role: 'coach', isActive: true }),
    toPublic: (row) => row,
  });

  let refreshCallCount = 0;
  mockModule(jwtPath, {
    signAccessToken: () => 'access-rotated',
    signRefreshToken: () => {
      refreshCallCount += 1;
      return refreshCallCount === 1 ? 'refresh-next' : 'refresh-next';
    },
    verifyRefreshToken: (token) => {
      if (token === 'refresh-current') {
        return {
          exp: Math.floor(Date.now() / 1000) + 3600,
          sessionId: 'session-1',
          tokenId: 'token-1',
          userId: 'user-1',
        };
      }
      return {
        exp: Math.floor(Date.now() / 1000) + 7200,
        sessionId: 'session-1',
        tokenId: 'token-2',
        userId: 'user-1',
      };
    },
    decodeRefreshToken: () => null,
    requireAuth: () => {
      throw new Error('not expected');
    },
  });

  let rotatePayload = null;
  mockModule(refreshStorePath, {
    createRefreshToken: async () => {},
    getRefreshTokenById: async () => ({
      id: 'token-1',
      user_id: 'user-1',
      session_id: 'session-1',
      token_hash: 'hash',
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      revoked_at: null,
    }),
    matchesRefreshToken: () => true,
    rotateRefreshToken: async (payload) => {
      rotatePayload = payload;
      return { ok: true, userId: 'user-1', sessionId: 'session-1' };
    },
    revokeSession: async () => 0,
    revokeUserSessions: async () => 0,
  });

  clearModule(routePath);
  const router = require(routePath);
  const server = await withServer(router);

  try {
    const resp = await fetch(`${server.url}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'refresh-current' }),
    });
    assert.equal(resp.status, 200);
    const data = await resp.json();
    assert.equal(data.accessToken, 'access-rotated');
    assert.equal(data.refreshToken, 'refresh-next');
    assert.equal(rotatePayload.currentTokenId, 'token-1');
    assert.equal(typeof rotatePayload.newTokenId, 'string');
    assert.notEqual(rotatePayload.newTokenId, 'token-1');
  } finally {
    await server.close();
    clearModule(routePath);
    clearModule(userStorePath);
    clearModule(jwtPath);
    clearModule(refreshStorePath);
  }
});

test('POST /auth/logout revokes the presented session', async () => {
  const userStorePath = require.resolve('../auth/userStore');
  const jwtPath = require.resolve('../auth/jwt');
  const refreshStorePath = require.resolve('../auth/refreshTokenStore');
  const routePath = require.resolve('../api/auth');

  mockModule(userStorePath, {
    findByUsernameWithHash: async () => null,
    verifyPassword: async () => false,
    findById: async () => null,
    toPublic: (row) => row,
  });

  mockModule(jwtPath, {
    signAccessToken: () => 'unused',
    signRefreshToken: () => 'unused',
    verifyRefreshToken: () => ({ sessionId: 'session-logout', tokenId: 'token-logout', userId: 'user-1', exp: Math.floor(Date.now() / 1000) + 3600 }),
    decodeRefreshToken: () => null,
    requireAuth: () => {
      throw new Error('not expected');
    },
  });

  let revokedSessionId = null;
  mockModule(refreshStorePath, {
    createRefreshToken: async () => {},
    getRefreshTokenById: async () => null,
    matchesRefreshToken: () => false,
    rotateRefreshToken: async () => ({ ok: false, code: 'invalid' }),
    revokeSession: async (sessionId) => {
      revokedSessionId = sessionId;
      return 1;
    },
    revokeUserSessions: async () => 0,
  });

  clearModule(routePath);
  const router = require(routePath);
  const server = await withServer(router);

  try {
    const resp = await fetch(`${server.url}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'refresh-current' }),
    });
    assert.equal(resp.status, 200);
    assert.equal(revokedSessionId, 'session-logout');
  } finally {
    await server.close();
    clearModule(routePath);
    clearModule(userStorePath);
    clearModule(jwtPath);
    clearModule(refreshStorePath);
  }
});