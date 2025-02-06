const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jose = require('jose');
const dotenv = require('dotenv');

// Configure dotenv at the start
dotenv.config();

// Store state parameters temporarily (in production, use a proper database)
const stateStore = new Map();

// Create a secret key for signing tokens
const secretKey = new TextEncoder().encode(
    process.env.JWT_SECRET_KEY || crypto.randomBytes(32).toString('hex')
);

// Token generation function
async function generateTokens(userId) {
    // Create JWT Access Token
    const accessToken = await new jose.SignJWT({
        sub: userId,
        type: 'access_token'
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')  // 1 hour expiry
        .setIssuer('http://localhost:8080')
        .setAudience('upfirst')
        .sign(secretKey);

    // Create Refresh Token
    const refreshToken = await new jose.SignJWT({
        sub: userId,
        type: 'refresh_token'
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')  // 7 days expiry
        .setIssuer('http://localhost:8080')
        .setAudience('upfirst')
        .sign(secretKey);

    return {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'bearer',
        expires_in: 3600 // 1 hour in seconds
    };
}

// OAuth 2.0 configuration
const oauthConfig = {
    clientId: process.env.OAUTH_CLIENT_ID,
    clientSecret: process.env.OAUTH_CLIENT_SECRET,
    redirectUri: process.env.OAUTH_REDIRECT_URI,
    authorizationEndpoint: process.env.OAUTH_AUTH_ENDPOINT,
    tokenEndpoint: process.env.OAUTH_TOKEN_ENDPOINT,
};

console.log('OAuth Config:', oauthConfig); // Debug log to verify config

// GET endpoint to initiate OAuth flow
router.get('/api/oauth/authorize', (req, res) => {
    //console.log('authorize', req.query);
    const { response_type, client_id, redirect_uri, state } = req.query;
    
    // Validate required parameters
    if (!response_type || !client_id || !redirect_uri) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Validate client_id
    if (client_id !== oauthConfig.clientId) {
        return res.status(401).json({ error: 'Invalid client_id' });
    }

    // Validate redirect_uri
    if (redirect_uri !== oauthConfig.redirectUri) {
        return res.status(401).json({ error: 'Invalid redirect_uri' });
    }

    // Generate a mock authorization code
    const code = 'SOME_CODE';

    // Construct the redirect URL with code and state
    const redirectUrl = new URL(oauthConfig.redirectUri);
    redirectUrl.searchParams.append('code', code);
    
    if (state) {
        redirectUrl.searchParams.append('state', state);
    }

    return res.redirect(302, redirectUrl.toString());
});

// POST endpoint to exchange authorization code for tokens
router.post('/api/oauth/token', async (req, res) => {
    // console.log('token', req.body);
    // console.log("oauthConfig", oauthConfig);
    const { grant_type, code, client_id, redirect_uri } = req.body;

    // Validate required parameters
    if (!grant_type || !code || !client_id || !redirect_uri) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Validate grant_type
    if (grant_type !== 'authorization_code') {
        return res.status(400).json({ error: 'Invalid grant_type' });
    }

    // Validate client_id
    if (client_id !== oauthConfig.clientId) {
        return res.status(401).json({ error: 'Invalid client_id' });
    }

    // Validate redirect_uri
    if (redirect_uri !== oauthConfig.redirectUri) {
        return res.status(401).json({ error: 'Invalid redirect_uri' });
    }

    // Validate code
    if (code !== 'SOME_CODE') {
        return res.status(400).json({ error: 'Invalid authorization code' });
    }

    try {
        // Generate tokens
        const tokens = await generateTokens('user123');

        // Set response headers
        res.setHeader('Content-Type', 'application/json;charset=UTF-8');

        // Return the token response
        res.json(tokens);
    } catch (error) {
        console.error('Token generation error:', error);
        res.status(500).json({ error: 'Failed to generate tokens' });
    }
});

module.exports = router; 