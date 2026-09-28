const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');
const env = require('../config/env');

class GoogleAuthService {
  constructor() {
    this.client = null;
    this.mockVerificationHandler = null; // For isolated automated tests without external network dependency
  }

  getClientId() {
    return env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
  }

  getClientSecret() {
    return env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';
  }

  getCallbackUrl() {
    return env.GOOGLE_CALLBACK_URL || process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5173/auth/google/callback';
  }

  isConfigured() {
    return Boolean(this.getClientId());
  }

  getOAuthClient() {
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();
    const callbackUrl = this.getCallbackUrl();

    if (!clientId) {
      const err = new Error('Google OAuth is not configured on this server.');
      err.statusCode = 503;
      throw err;
    }

    if (!this.client || this.client._clientId !== clientId) {
      this.client = new OAuth2Client(clientId, clientSecret, callbackUrl);
    }
    return this.client;
  }

  /**
   * Generates a cryptographically signed state token containing timestamp to prevent CSRF.
   */
  generateStateToken() {
    const randomBytes = crypto.randomBytes(24).toString('hex');
    const timestamp = Date.now();
    const payload = `${randomBytes}.${timestamp}`;
    const hmacSecret = env.JWT_SECRET || 'dev_jwt_secret_unified_assessment_platform';
    const signature = crypto.createHmac('sha256', hmacSecret).update(payload).digest('hex');
    return `${payload}.${signature}`;
  }

  /**
   * Verifies the authenticity and validity (<= 15 minutes TTL) of a state token.
   */
  verifyStateToken(stateToken) {
    if (!stateToken || typeof stateToken !== 'string') {
      const err = new Error('Missing or invalid OAuth state parameter.');
      err.statusCode = 400;
      throw err;
    }

    const parts = stateToken.split('.');
    if (parts.length !== 3) {
      const err = new Error('Malformed OAuth state parameter.');
      err.statusCode = 400;
      throw err;
    }

    const [randomBytes, timestampStr, signature] = parts;
    const payload = `${randomBytes}.${timestampStr}`;
    const hmacSecret = env.JWT_SECRET || 'dev_jwt_secret_unified_assessment_platform';
    const expectedSignature = crypto.createHmac('sha256', hmacSecret).update(payload).digest('hex');

    if (signature !== expectedSignature) {
      const err = new Error('Invalid OAuth state parameter signature (potential CSRF).');
      err.statusCode = 400;
      throw err;
    }

    const timestamp = parseInt(timestampStr, 10);
    const ttlMs = 15 * 60 * 1000; // 15 minutes max
    if (isNaN(timestamp) || Date.now() - timestamp > ttlMs) {
      const err = new Error('OAuth state parameter has expired. Please initiate login again.');
      err.statusCode = 400;
      throw err;
    }

    return true;
  }

  /**
   * Validates institutional email domain restriction against GOOGLE_ALLOWED_DOMAINS.
   */
  validateDomain(email) {
    const rawAllowed = env.GOOGLE_ALLOWED_DOMAINS || process.env.GOOGLE_ALLOWED_DOMAINS || '';
    const allowedDomains = rawAllowed
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);

    if (allowedDomains.length > 0) {
      const domain = email.split('@')[1]?.toLowerCase();
      if (!domain || !allowedDomains.includes(domain)) {
        const err = new Error(
          `Institutional access restricted. Email domain "@${domain}" is not permitted. Allowed: ${allowedDomains.join(', ')}`
        );
        err.statusCode = 403;
        throw err;
      }
    }
    return true;
  }

  /**
   * Generates Google OAuth 2.0 authorization URL.
   */
  getAuthUrl() {
    const client = this.getOAuthClient();
    const state = this.generateStateToken();

    const url = client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
        'openid',
      ],
      state,
      prompt: 'select_account',
    });

    return { url, state };
  }

  /**
   * Verified identity resolution from either authorization code or ID token.
   */
  async verifyGoogleIdentity({ code, state, idToken, credential }) {
    // 1. In automated tests with mock handler configured, delegate safely
    if (this.mockVerificationHandler) {
      return this.mockVerificationHandler({ code, state, idToken, credential });
    }

    const tokenToVerify = idToken || credential;

    // 2. Authorization Code Grant Flow
    if (code) {
      if (state) {
        this.verifyStateToken(state);
      }
      const client = this.getOAuthClient();
      const { tokens } = await client.getToken(code);
      if (!tokens || !tokens.id_token) {
        const err = new Error('Failed to obtain ID token from Google authorization exchange.');
        err.statusCode = 400;
        throw err;
      }
      return this._verifyIdTokenString(tokens.id_token);
    }

    // 3. ID Token / Credential Flow (Google Identity Services)
    if (tokenToVerify) {
      return this._verifyIdTokenString(tokenToVerify);
    }

    const err = new Error('Either Google authorization code or ID token is required.');
    err.statusCode = 400;
    throw err;
  }

  async _verifyIdTokenString(idTokenString) {
    const client = this.getOAuthClient();
    const clientId = this.getClientId();

    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken: idTokenString,
        audience: clientId,
      });
    } catch (verifyErr) {
      const err = new Error(`Google ID token verification failed: ${verifyErr.message}`);
      err.statusCode = 401;
      throw err;
    }

    const payload = ticket.getPayload();
    if (!payload) {
      const err = new Error('Empty payload returned from verified Google ID token.');
      err.statusCode = 401;
      throw err;
    }

    // Validate mandatory claims
    if (!payload.sub) {
      const err = new Error('Missing stable subject identifier (sub) in Google identity payload.');
      err.statusCode = 400;
      throw err;
    }

    if (!payload.email) {
      const err = new Error('Missing email address in Google identity payload.');
      err.statusCode = 400;
      throw err;
    }

    if (!payload.email_verified) {
      const err = new Error('Unverified Google email. Only verified Google accounts can authenticate.');
      err.statusCode = 400;
      throw err;
    }

    return {
      sub: payload.sub,
      email: payload.email.toLowerCase().trim(),
      email_verified: Boolean(payload.email_verified),
      name: payload.name || payload.email.split('@')[0],
      picture: payload.picture || null,
      issuer: payload.iss,
    };
  }

  // Testing hooks for isolated offline test suites
  setMockVerificationHandler(fn) {
    this.mockVerificationHandler = fn;
  }

  clearMockVerificationHandler() {
    this.mockVerificationHandler = null;
  }
}

module.exports = new GoogleAuthService();
