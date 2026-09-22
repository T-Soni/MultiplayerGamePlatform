/**
 * End-to-End Microservice Cluster Verification Test
 * Boots microservices in-process, tests HTTP REST routes, Redis Pub/Sub event flow, and credit scoring.
 */
const assert = require('assert');
const { EmbeddedRedisServer } = require('../scripts/embedded-redis');
const { createRedisClient } = require('../services/shared/redisClient');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runClusterVerification() {
  console.log('====================================================');
  console.log('🧪 NexToe Microservices E2E Cluster Verification     ');
  console.log('====================================================\n');

  // Step 1: Start Embedded Redis
  console.log('1. Starting Embedded In-Memory Redis Server...');
  const redisServer = new EmbeddedRedisServer(6379, '127.0.0.1');
  try {
    await redisServer.start();
  } catch (err) {
    console.log('   (Port 6379 already in use or Redis running, proceeding...)');
  }

  // Step 2: Boot Services
  console.log('2. Booting Microservices...');
  
  process.env.PORT = '5001';
  process.env.DB_FILE = ':memory:';
  delete require.cache[require.resolve('../services/auth-service/server.js')];
  require('../services/auth-service/server.js');

  process.env.PORT = '5002';
  delete require.cache[require.resolve('../services/registry-service/server.js')];
  require('../services/registry-service/server.js');

  process.env.PORT = '5003';
  delete require.cache[require.resolve('../services/matchmaking-service/server.js')];
  require('../services/matchmaking-service/server.js');

  process.env.PORT = '5005';
  delete require.cache[require.resolve('../services/analytics-service/server.js')];
  require('../services/analytics-service/server.js');

  await sleep(1500);

  // Step 3: Test Auth Endpoints
  console.log('3. Testing Auth Service (Port 5001)...');
  const loginRes = await fetch('http://localhost:5001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'player1', password: 'password123' })
  });
  const loginData = await loginRes.json();
  assert.strictEqual(loginRes.ok, true, 'Login should succeed');
  assert.ok(loginData.token, 'Should return JWT token');
  console.log('   ✅ Auth login & JWT generation validated');

  // Step 4: Test Registry Endpoints
  console.log('4. Testing Registry & Config Service (Port 5002)...');
  const rulesRes = await fetch('http://localhost:5002/api/config/rules');
  const rulesData = await rulesRes.json();
  assert.strictEqual(rulesRes.ok, true);
  assert.strictEqual(rulesData.rules.gridSize, 3);
  console.log('   ✅ Registry rules retrieval validated');

  // Step 5: Test Matchmaking Queue
  console.log('5. Testing Matchmaking Service (Port 5003)...');
  const join1 = await fetch('http://localhost:5003/api/matchmaking/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'usr-p1', username: 'player1' })
  });
  const join1Data = await join1.json();
  assert.strictEqual(join1Data.status, 'queued');

  const join2 = await fetch('http://localhost:5003/api/matchmaking/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'usr-p2', username: 'player2' })
  });
  const join2Data = await join2.json();
  assert.strictEqual(join2Data.status, 'matched');
  assert.ok(join2Data.match.matchId);
  console.log(`   ✅ 2-Player Matchmaking pairing confirmed: ${join2Data.match.matchId}`);

  // Step 6: Test Redis Pub/Sub Event Flow
  console.log('6. Testing Redis Event-Driven Flow (GAME_OVER -> Analytics)...');
  const publisher = createRedisClient('TestPublisher');
  await sleep(500);

  const gameOverEvent = {
    event: 'GAME_OVER',
    matchId: join2Data.match.matchId,
    winnerId: 'usr-p1',
    loserId: 'usr-p2',
    isDraw: false,
    reason: 'win',
    players: {
      playerX: { userId: 'usr-p1', username: 'player1' },
      playerO: { userId: 'usr-p2', username: 'player2' }
    },
    moveCount: 5,
    gridSize: 3,
    winCondition: 3,
    durationSeconds: 14,
    endedAt: new Date().toISOString()
  };

  await publisher.publish('game:events', JSON.stringify(gameOverEvent));
  console.log('   Emitted GAME_OVER event onto Redis channel "game:events"');

  // Allow Analytics subscriber to process event & update credits
  await sleep(1500);

  const analyticsRes = await fetch('http://localhost:5005/api/analytics/overview');
  const analyticsData = await analyticsRes.json();
  assert.strictEqual(analyticsRes.ok, true);
  assert.ok(analyticsData.overview.totalMatches >= 1, 'Should record match in Analytics database');
  console.log('   ✅ Analytics consumed GAME_OVER and recorded match in database');

  // Verify Credit Update on Auth Service
  const user1Res = await fetch('http://localhost:5001/api/auth/verify', {
    headers: { Authorization: `Bearer ${loginData.token}` }
  });
  const user1Data = await user1Res.json();
  // player1 started with 100 credits, won 50 credits -> 150 credits
  assert.strictEqual(user1Data.user.credits, 150, 'player1 credits should be updated to 150');
  console.log(`   ✅ Player credits updated reactively: ${user1Data.user.credits} CR`);

  console.log('\n====================================================');
  console.log('🎉 ALL END-TO-END MICROSERVICES TESTS PASSED!       ');
  console.log('====================================================\n');

  process.exit(0);
}

runClusterVerification().catch((err) => {
  console.error('Cluster verification error:', err);
  process.exit(1);
});
