server.js

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const WebSocket = require('ws');
const expressWs = require('express-ws'); // Import express-ws

const app = express();
const port = 3001; // You can change this if needed

// Initialize express-ws with the app
expressWs(app);

// Hardcoded configuration values
const CLIENT_ID = 'dIISsWzbbhaQlPf'; // Your Deriv App ID
const CLIENT_SECRET = 'your_client_secret_here'; // Your Deriv Client Secret
const REDIRECT_URI = 'http://localhost:3000'; // Must match your Deriv app settings

app.use(cors({
  origin: REDIRECT_URI,
  credentials: true
}));

// OAuth Authorization Endpoint
app.get('/authorize', (req, res) => {
  const oauthUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  res.json({ url: oauthUrl });
});

// OAuth Callback Handler
app.get('/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) throw new Error('Authorization code missing');

    const tokenResponse = await axios.post('https://oauth.deriv.com/oauth2/token', new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const { access_token, refresh_token } = tokenResponse.data;
    res.redirect(`${REDIRECT_URI}?token1=${access_token}&token2=${refresh_token}`);
    
  } catch (error) {
    console.error('OAuth Error:', error.response?.data || error.message);
    res.redirect(`${REDIRECT_URI}?error=auth_failed`);
  }
});

// WebSocket Proxy Endpoint
app.ws('/deriv-ws', (ws, req) => {
  const derivWs = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${CLIENT_ID}`);
  const { token1 } = req.query;

  derivWs.on('open', () => {
    if (token1) derivWs.send(JSON.stringify({ authorize: token1 }));
  });

  // Bidirectional forwarding
  derivWs.on('message', (data) => ws.send(data));
  ws.on('message', (data) => derivWs.send(data));

  derivWs.on('close', () => ws.close());
  ws.on('close', () => derivWs.close());
});

// Trade History Endpoint
app.get('/trades', async (req, res) => {
  try {
    const { token1 } = req.query;
    if (!token1) throw new Error('Missing access token');

    const response = await axios.get('https://api.deriv.com/statement', {
      headers: { Authorization: `Bearer ${token1}` },
      params: { limit: 10, description: 1 }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Trade Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch trades' });
  }
});

app.listen(port, () => console.log(`Server running on port ${port}`));
