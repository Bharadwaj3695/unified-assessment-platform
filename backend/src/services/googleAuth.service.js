// Google OAuth client library for handling OpenID Connect, OAuth 2.0 authorization code exchange, and ID token validation
const { OAuth2Client } = require('google-auth-library');
// Node.js crypto module used for generating cryptographically secure random bytes and HMAC signatures for CSRF prevention
const crypto = require('crypto');
// Application environment configuration loading client IDs, secrets, and callback URLs
const env = require('../config/env');

/**
 * Service handling Google OAuth 2.0 Single Sign-On (SSO) integration.
 * Distinct from Gmail SMTP delivery: Google OAuth manages authentication/identity assertion,
 * whereas Nodemailer/SMTP handles outbound email notification delivery.
 */
class GoogleAuthService {
  constructor() {
    // Cached singleton instance of the OAuth2Client to avoid recreating on each request
    this.client = null;
    // Optional hook allowing isolated automated tests to mock Google ID token verification without live network calls
    this.mockVerificationHandler = null; // For isolated automated tests without external network dependency
  }

  // Retrieves the configured Google OAuth client identifier from environment variables
  getClientId() {
    // Return the trimmed Google client ID or an empty string fallback
    return env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
  }

  // Retrieves the configured Google OAuth client secret for secure back-channel token exchange
  getClientSecret() {
    // Return the Google client secret or an empty string fallback
    return env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';
  }

  // Retrieves the authorized redirect URI registered with Google Cloud Console
  getCallbackUrl() {
    // Return configured callback URL or default development frontend redirect route
    return env.GOOGLE_CALLBACK_URL || process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5173/auth/google/callback';
  }

  // Determines whether Google SSO authentication is enabled and configured on this instance
  isConfigured() {
    // Truthy check on client ID presence
    return Boolean(this.getClientId());
  }

  // Instantiates or returns the cached Google OAuth2Client instance
  getOAuthClient() {
    // Resolve client ID from environment
    const clientId = this.getClientId();
    // Resolve client secret from environment
    const clientSecret = this.getClientSecret();
    // Resolve callback redirect URL
    const callbackUrl = this.getCallbackUrl();

    // If client ID is absent, throw 503 Service Unavailable error
    if (!clientId) {
      // Create descriptive configuration error
      const err = new Error('Google OAuth is not configured on this server.');
      // Set HTTP 503 status code
      err.statusCode = 503;
      // Throw error to abort OAuth initialization
      throw err;
    }

    // Instantiate new OAuth2Client if cached client does not exist or client ID changed
    if (!this.client || this.client._clientId !== clientId) {
      // Initialize OAuth2Client with credentials and redirect URI
      this.client = new OAuth2Client(clientId, clientSecret, callbackUrl);
    }
    // Return configured OAuth2Client instance
    return this.client;
  }

  /**
   * Generates a cryptographically signed state token containing timestamp to prevent CSRF.
   * State format: <randomBytes>.<timestamp>.<hmacSignature>
   */
  generateStateToken() {
    // Generate 24 cryptographically strong pseudo-random bytes encoded as hex string
    const randomBytes = crypto.randomBytes(24).toString('hex');
    // Capture current unix epoch timestamp in milliseconds
    const timestamp = Date.now();
    // Construct the unverified payload combining random nonce and issuance timestamp
    const payload = `${randomBytes}.${timestamp}`;
    // Retrieve HMAC signing secret from JWT secret or fallback string
    const hmacSecret = env.JWT_SECRET || 'dev_jwt_secret_unified_assessment_platform';
    // Generate SHA-256 HMAC signature binding the payload to server's secret
    const signature = crypto.createHmac('sha256', hmacSecret).update(payload).digest('hex');
    // Return compound state token to be passed through OAuth redirect flow
    return `${payload}.${signature}`;
  }

  /**
   * Verifies the authenticity and validity (<= 15 minutes TTL) of a state token.
   * Protects against Cross-Site Request Forgery (CSRF) and replay attacks.
   */
  verifyStateToken(stateToken) {
    // Validate presence and type of state token parameter
    if (!stateToken || typeof stateToken !== 'string') {
      // Create missing state error
      const err = new Error('Missing or invalid OAuth state parameter.');
      // Set HTTP 400 Bad Request status
      err.statusCode = 400;
      // Throw validation error
      throw err;
    }

    // Split state token into nonce, timestamp, and HMAC signature components
    const parts = stateToken.split('.');
    // Reject malformed state tokens that lack exactly three segments
    if (parts.length !== 3) {
      // Create malformed error
      const err = new Error('Malformed OAuth state parameter.');
      // Set HTTP 400 status
      err.statusCode = 400;
      // Throw malformed state error
      throw err;
    }

    // Destructure segments from state token
    const [randomBytes, timestampStr, signature] = parts;
    // Reconstruct payload string for signature verification
    const payload = `${randomBytes}.${timestampStr}`;
    // Retrieve HMAC signing secret
    const hmacSecret = env.JWT_SECRET || 'dev_jwt_secret_unified_assessment_platform';
    // Compute expected SHA-256 HMAC signature using server's secret
    const expectedSignature = crypto.createHmac('sha256', hmacSecret).update(payload).digest('hex');

    // Reject token if signature does not match (detects tampering or forgery)
    if (signature !== expectedSignature) {
      // Create potential CSRF error
      const err = new Error('Invalid OAuth state parameter signature (potential CSRF).');
      // Set HTTP 400 status code
      err.statusCode = 400;
      // Throw invalid signature error
      throw err;
    }

    // Parse issuance timestamp integer from segment
    const timestamp = parseInt(timestampStr, 10);
    // Define maximum allowable state token lifetime (15 minutes in milliseconds)
    const ttlMs = 15 * 60 * 1000; // 15 minutes max
    // Check if timestamp is invalid or older than 15 minutes
    if (isNaN(timestamp) || Date.now() - timestamp > ttlMs) {
      // Create expiration error
      const err = new Error('OAuth state parameter has expired. Please initiate login again.');
      // Set HTTP 400 status code
      err.statusCode = 400;
      // Throw expiration error
      throw err;
    }

    // State token is authentic, untampered, and unexpired
    return true;
  }

  /**
   * Validates institutional email domain restriction against GOOGLE_ALLOWED_DOMAINS.
   * Ensures only authorized campus or enterprise domains can log in via Google SSO.
   */
  validateDomain(email) {
    // Read comma-delimited allowed domain whitelist from environment
    const rawAllowed = env.GOOGLE_ALLOWED_DOMAINS || process.env.GOOGLE_ALLOWED_DOMAINS || '';
    // Parse, trim, lower-case, and filter non-empty domain values
    const allowedDomains = rawAllowed
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);

    // If a domain whitelist is configured, enforce strict matching
    if (allowedDomains.length > 0) {
      // Extract the domain portion following the '@' sign
      const domain = email.split('@')[1]?.toLowerCase();
      // Reject if domain is missing or not present in whitelist
      if (!domain || !allowedDomains.includes(domain)) {
        // Create access restriction error detailing allowed domains
        const err = new Error(
          `Institutional access restricted. Email domain "@${domain}" is not permitted. Allowed: ${allowedDomains.join(', ')}`
        );
        // Set HTTP 403 Forbidden status code
        err.statusCode = 403;
        // Throw authorization error
        throw err;
      }
    }
    // Domain matches permitted whitelist or whitelist is unconstrained
    return true;
  }

  /**
   * Generates Google OAuth 2.0 authorization URL.
   * Requests offline access for token exchange and scopes for user profile and verified email.
   */
  getAuthUrl() {
    // Get initialized OAuth client
    const client = this.getOAuthClient();
    // Generate secure anti-CSRF state token
    const state = this.generateStateToken();

    // Generate OAuth redirect URL requesting profile, email, and openid scopes
    const url = client.generateAuthUrl({
      // Request offline access to receive authorization code for backend exchange
      access_type: 'offline',
      // Requested OpenID Connect and Google identity scopes
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
        'openid',
      ],
      // Attach anti-CSRF state parameter
      state,
      // Prompt user to select account on Google consent screen
      prompt: 'select_account',
    });

    // Return the authorization URL and state token
    return { url, state };
  }

  /**
   * Verified identity resolution from either authorization code or ID token.
   * Supports both server-side Authorization Code Grant and Google Identity Services tokens.
   */
  async verifyGoogleIdentity({ code, state, idToken, credential }) {
    // 1. In automated tests with mock handler configured, delegate safely without external network calls
    if (this.mockVerificationHandler) {
      // Return result of mock verification handler
      return this.mockVerificationHandler({ code, state, idToken, credential });
    }

    // Normalize ID token from idToken or credential parameter
    const tokenToVerify = idToken || credential;

    // 2. Authorization Code Grant Flow
    if (code) {
      // Verify anti-CSRF state token if present
      if (state) {
        // Validate state token signature and freshness
        this.verifyStateToken(state);
      }
      // Get OAuth client instance
      const client = this.getOAuthClient();
      // Exchange one-time authorization code with Google token endpoint for tokens
      const { tokens } = await client.getToken(code);
      // Validate that Google returned a valid ID token
      if (!tokens || !tokens.id_token) {
        // Create token exchange error
        const err = new Error('Failed to obtain ID token from Google authorization exchange.');
        // Set HTTP 400 Bad Request status
        err.statusCode = 400;
        // Throw exchange error
        throw err;
      }
      // Verify and parse claims from the received ID token string
      return this._verifyIdTokenString(tokens.id_token);
    }

    // 3. ID Token / Credential Flow (Google Identity Services)
    if (tokenToVerify) {
      // Verify ID token string directly against Google's public certificates
      return this._verifyIdTokenString(tokenToVerify);
    }

    // Reject request if neither code nor ID token was provided
    const err = new Error('Either Google authorization code or ID token is required.');
    // Set HTTP 400 status code
    err.statusCode = 400;
    // Throw error
    throw err;
  }

  // Internal helper that validates cryptographic signature and claims of a Google ID token string
  async _verifyIdTokenString(idTokenString) {
    // Get OAuth client instance
    const client = this.getOAuthClient();
    // Get configured client ID to verify audience claim
    const clientId = this.getClientId();

    // Variable to hold the verified login ticket
    let ticket;
    try {
      // Verify signature against Google's public keys and verify audience matches our client ID
      ticket = await client.verifyIdToken({
        // The raw JWT ID token string
        idToken: idTokenString,
        // Enforce that audience claim matches our registered client ID
        audience: clientId,
      });
    } catch (verifyErr) {
      // Wrap verification failure with descriptive error
      const err = new Error(`Google ID token verification failed: ${verifyErr.message}`);
      // Set HTTP 401 Unauthorized status
      err.statusCode = 401;
      // Throw verification error
      throw err;
    }

    // Extract decoded claims payload from login ticket
    const payload = ticket.getPayload();
    // Reject if payload is empty
    if (!payload) {
      // Create empty payload error
      const err = new Error('Empty payload returned from verified Google ID token.');
      // Set HTTP 401 status
      err.statusCode = 401;
      // Throw error
      throw err;
    }

    // Validate mandatory claims
    // Validate subject (sub) claim representing unique immutable Google user identifier
    if (!payload.sub) {
      // Create missing sub error
      const err = new Error('Missing stable subject identifier (sub) in Google identity payload.');
      // Set HTTP 400 status
      err.statusCode = 400;
      // Throw error
      throw err;
    }

    // Validate email claim presence
    if (!payload.email) {
      // Create missing email error
      const err = new Error('Missing email address in Google identity payload.');
      // Set HTTP 400 status
      err.statusCode = 400;
      // Throw error
      throw err;
    }

    // Validate that Google has marked the email address as verified
    if (!payload.email_verified) {
      // Create unverified email error
      const err = new Error('Unverified Google email. Only verified Google accounts can authenticate.');
      // Set HTTP 400 status
      err.statusCode = 400;
      // Throw error
      throw err;
    }

    // Return normalized Google identity object with essential user profile attributes
    return {
      // Unique Google user ID (sub)
      sub: payload.sub,
      // Normalized lowercase institutional email address
      email: payload.email.toLowerCase().trim(),
      // Boolean flag indicating email verification status
      email_verified: Boolean(payload.email_verified),
      // User's display name or username prefix fallback
      name: payload.name || payload.email.split('@')[0],
      // Profile avatar picture URL if provided by Google
      picture: payload.picture || null,
      // Issuer claim identifying token authority
      issuer: payload.iss,
    };
  }

  // Testing hooks for isolated offline test suites
  // Registers a mock verification handler to intercept verifyGoogleIdentity during automated tests
  setMockVerificationHandler(fn) {
    // Assign mock verification function
    this.mockVerificationHandler = fn;
  }

  // Clears the mock verification handler to restore live Google API token verification
  clearMockVerificationHandler() {
    // Reset mock handler to null
    this.mockVerificationHandler = null;
  }
}

// Export singleton instance of GoogleAuthService
module.exports = new GoogleAuthService();
