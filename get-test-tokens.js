#!/usr/bin/env node

/**
 * Helper script to get tokens for testing
 * Usage: node get-test-tokens.js <email> <password> [shopId]
 */

const http = require('http');
const https = require('https');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const email = process.argv[2];
const password = process.argv[3];
const shopId = process.argv[4];

if (!email || !password) {
  console.log('Usage: node get-test-tokens.js <email> <password> [shopId]');
  console.log('');
  console.log('Example:');
  console.log('  node get-test-tokens.js owner@shop.com password123');
  process.exit(1);
}

function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const protocol = url.protocol === 'https:' ? https : http;
    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, body: null, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function getTokens() {
  console.log('Attempting to login...\n');

  try {
    // Login
    const loginResponse = await makeRequest('POST', '/api/auth/login', {
      email,
      password,
    });

    if (loginResponse.status !== 200 || !loginResponse.body.success) {
      console.error('Login failed:', loginResponse.body.message || loginResponse.body);
      process.exit(1);
    }

    const token = loginResponse.body.data.accessToken;
    const user = loginResponse.body.data.user;
    const userShopId = user.shopId || shopId;

    console.log('✅ Login successful!\n');
    console.log('Token Information:');
    console.log(`  User ID: ${user.id}`);
    console.log(`  Shop ID: ${userShopId}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  Name: ${user.name || user.ownerName || 'N/A'}`);
    console.log('');

    // Get shop ID if not provided
    let finalShopId = userShopId;
    if (!finalShopId && shopId) {
      finalShopId = shopId;
    }

    if (!finalShopId) {
      console.error('❌ Could not determine shop ID. Please provide it as third parameter.');
      console.log('');
      console.log('Usage: node get-test-tokens.js <email> <password> <shopId>');
      process.exit(1);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Test Command:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log(`node test-bug-fixes.js "${token}" "${finalShopId}"`);
    console.log('');
    console.log('Or copy these values:');
    console.log(`  OWNER_TOKEN="${token}"`);
    console.log(`  SHOP_ID="${finalShopId}"`);
    console.log('');

    // Try to get a staff token if user is owner
    if (user.role === 'owner') {
      console.log('To test staff access denial, you need a staff token.');
      console.log('Login as a staff member and use their token as the second parameter.');
      console.log('');
    }

    return { token, shopId: finalShopId, role: user.role };
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

getTokens();


