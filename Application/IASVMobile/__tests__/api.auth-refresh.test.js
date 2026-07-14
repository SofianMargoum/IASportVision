import {
  clearAuthSession,
  getAuthToken,
  logoutCurrentSession,
  registerAuthFailureHandler,
  secureFetch,
  setAuthSession,
} from '../tools/api';
import { clearAuthTokens, loadAuthTokens, saveAuthTokens } from '../tools/secureToken';
import { logoutRequest, refreshTokenRequest } from '../tools/authApi';

jest.mock('../tools/secureToken', () => ({
  clearAuthTokens: jest.fn(),
  loadAuthTokens: jest.fn(),
  saveAuthTokens: jest.fn(),
}));

jest.mock('../tools/authApi', () => ({
  logoutRequest: jest.fn(),
  refreshTokenRequest: jest.fn(),
}));

function makeJsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  };
}

describe('secureFetch auth refresh flow', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    loadAuthTokens.mockResolvedValue(null);
    saveAuthTokens.mockResolvedValue(true);
    clearAuthTokens.mockResolvedValue(true);
    clearAuthSession();
    registerAuthFailureHandler(null);
    jest.clearAllMocks();
  });

  afterEach(() => {
    clearAuthSession();
    registerAuthFailureHandler(null);
  });

  test('refreshes once and replays the failed request with the new access token', async () => {
    setAuthSession({ accessToken: 'expired-access', refreshToken: 'refresh-1' });
    refreshTokenRequest.mockResolvedValue({
      accessToken: 'fresh-access',
      refreshToken: 'refresh-2',
      user: { id: 'user-1' },
    });
    global.fetch
      .mockResolvedValueOnce(makeJsonResponse(401, { message: 'expired' }))
      .mockResolvedValueOnce(makeJsonResponse(200, { ok: true }));

    const data = await secureFetch('https://ia-sport.oa.r.appspot.com/devices');

    expect(data).toEqual({ ok: true });
    expect(refreshTokenRequest).toHaveBeenCalledTimes(1);
    expect(refreshTokenRequest).toHaveBeenCalledWith('refresh-1');
    expect(saveAuthTokens).toHaveBeenCalledWith({
      accessToken: 'fresh-access',
      refreshToken: 'refresh-2',
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer expired-access');
    expect(global.fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer fresh-access');
    expect(getAuthToken()).toBe('fresh-access');
  });

  test('clears local session and notifies the app when refresh is rejected', async () => {
    const onAuthFailure = jest.fn();
    setAuthSession({ accessToken: 'expired-access', refreshToken: 'refresh-1' });
    registerAuthFailureHandler(onAuthFailure);
    refreshTokenRequest.mockRejectedValue(Object.assign(new Error('revoked'), { status: 403 }));
    global.fetch.mockResolvedValueOnce(makeJsonResponse(401, { message: 'expired' }));

    await expect(
      secureFetch('https://ia-sport.oa.r.appspot.com/devices')
    ).rejects.toMatchObject({ status: 403 });

    expect(clearAuthTokens).toHaveBeenCalledTimes(1);
    expect(onAuthFailure).toHaveBeenCalledWith('refresh-rejected');
    expect(getAuthToken()).toBeNull();
  });

  test('keeps the session in memory when refresh fails due to timeout', async () => {
    const onAuthFailure = jest.fn();
    setAuthSession({ accessToken: 'expired-access', refreshToken: 'refresh-1' });
    registerAuthFailureHandler(onAuthFailure);
    refreshTokenRequest.mockRejectedValue(Object.assign(new Error('timeout'), { status: 408 }));
    global.fetch.mockResolvedValueOnce(makeJsonResponse(401, { message: 'expired' }));

    await expect(
      secureFetch('https://ia-sport.oa.r.appspot.com/devices')
    ).rejects.toMatchObject({ status: 408 });

    expect(clearAuthTokens).not.toHaveBeenCalled();
    expect(onAuthFailure).not.toHaveBeenCalled();
    expect(getAuthToken()).toBe('expired-access');
  });

  test('rehydrates persisted session on first request after app restart', async () => {
    clearAuthSession();
    loadAuthTokens.mockResolvedValue({
      accessToken: 'persisted-access',
      refreshToken: 'persisted-refresh',
    });
    global.fetch.mockResolvedValueOnce(makeJsonResponse(200, { devices: [] }));

    await secureFetch('https://ia-sport.oa.r.appspot.com/devices');

    expect(loadAuthTokens).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer persisted-access');
    expect(refreshTokenRequest).not.toHaveBeenCalled();
  });

  test('manual logout always clears local session and calls server logout', async () => {
    setAuthSession({ accessToken: 'active-access', refreshToken: 'active-refresh' });
    logoutRequest.mockResolvedValue({ status: 'ok' });

    await logoutCurrentSession();

    expect(logoutRequest).toHaveBeenCalledWith({
      accessToken: 'active-access',
      refreshToken: 'active-refresh',
    });
    expect(clearAuthTokens).toHaveBeenCalledTimes(1);
    expect(getAuthToken()).toBeNull();
  });
});
