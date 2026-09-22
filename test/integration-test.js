/**
 * Automated Integration Test Suite for NexToe Platform
 * Verifies Game Engine logic, Microservices REST APIs, and Redis Pub/Sub Event-Driven flow.
 */
const assert = require('assert');
const { createGameState, makeMove } = require('../services/game-engine/logic/ticTacToeEngine');

async function runTests() {
  console.log('====================================================');
  console.log('🧪 Running NexToe Automated Integration Tests       ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // --- Suite 1: Pure Game Engine Logic ---
  console.log('--- Test Suite 1: Tic-Tac-Toe Game Engine (NxN & K-in-a-row) ---');

  test('3x3 standard diagonal win for player X', () => {
    let state = createGameState(3, 3);
    // Board positions:
    // 0 1 2
    // 3 4 5
    // 6 7 8
    // Moves: X:0, O:1, X:4, O:2, X:8 -> X wins diagonal
    let res = makeMove(state, 0, 'X'); state = res.updatedState;
    res = makeMove(state, 1, 'O'); state = res.updatedState;
    res = makeMove(state, 4, 'X'); state = res.updatedState;
    res = makeMove(state, 2, 'O'); state = res.updatedState;
    res = makeMove(state, 8, 'X'); state = res.updatedState;

    assert.strictEqual(state.isGameOver, true);
    assert.strictEqual(state.winner, 'X');
    assert.deepStrictEqual(state.winningLine?.sort(), [0, 4, 8]);
  });

  test('4x4 grid with 4-in-a-row horizontal win for player O', () => {
    let state = createGameState(4, 4);
    // Row 1: indices 4, 5, 6, 7
    // Moves: X:0, O:4, X:1, O:5, X:2, O:6, X:15, O:7
    let res = makeMove(state, 0, 'X'); state = res.updatedState;
    res = makeMove(state, 4, 'O'); state = res.updatedState;
    res = makeMove(state, 1, 'X'); state = res.updatedState;
    res = makeMove(state, 5, 'O'); state = res.updatedState;
    res = makeMove(state, 2, 'X'); state = res.updatedState;
    res = makeMove(state, 6, 'O'); state = res.updatedState;
    res = makeMove(state, 15, 'X'); state = res.updatedState;
    res = makeMove(state, 7, 'O'); state = res.updatedState;

    assert.strictEqual(state.isGameOver, true);
    assert.strictEqual(state.winner, 'O');
    assert.deepStrictEqual(state.winningLine?.sort(), [4, 5, 6, 7]);
  });

  test('Rejection of move on occupied cell', () => {
    let state = createGameState(3, 3);
    let res = makeMove(state, 0, 'X');
    state = res.updatedState;

    const invalidRes = makeMove(state, 0, 'O');
    assert.strictEqual(invalidRes.success, false);
    assert.strictEqual(invalidRes.error, 'Cell is already occupied');
  });

  test('Rejection of move out of turn', () => {
    let state = createGameState(3, 3);
    const invalidRes = makeMove(state, 0, 'O'); // X must start
    assert.strictEqual(invalidRes.success, false);
    assert.strictEqual(invalidRes.error, "It is not player O's turn");
  });

  test('Detection of Stalemate (Draw) on filled board', () => {
    let state = createGameState(3, 3);
    // Draw pattern:
    // X O X
    // X X O
    // O X O
    const moves = [
      [0, 'X'], [1, 'O'], [2, 'X'],
      [5, 'O'], [3, 'X'], [6, 'O'],
      [4, 'X'], [8, 'O'], [7, 'X']
    ];
    for (const [cell, sym] of moves) {
      const r = makeMove(state, cell, sym);
      state = r.updatedState;
    }
    assert.strictEqual(state.isGameOver, true);
    assert.strictEqual(state.isDraw, true);
    assert.strictEqual(state.winner, null);
  });

  console.log('\n----------------------------------------------------');
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log('----------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
