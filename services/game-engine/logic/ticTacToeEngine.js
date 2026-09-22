/**
 * Tic-Tac-Toe Game Logic for Arbitrary N x N Grids with K-in-a-row Win Condition.
 */

/**
 * Creates a new game state.
 * @param {number} gridSize - dimension N (e.g. 3 for 3x3)
 * @param {number} winCondition - K consecutive marks needed to win (e.g. 3)
 */
function createGameState(gridSize = 3, winCondition = 3) {
  const totalCells = gridSize * gridSize;
  return {
    gridSize,
    winCondition,
    board: Array(totalCells).fill(null), // 1D array of size N*N
    currentTurn: 'X', // 'X' always starts
    movesCount: 0,
    isGameOver: false,
    winner: null, // 'X' | 'O' | null
    winningLine: null, // array of winning cell indices
    isDraw: false,
    startTime: Date.now(),
    history: []
  };
}

/**
 * Validates and applies a move.
 * @param {Object} state - current game state
 * @param {number} cellIndex - index 0 .. (N*N - 1)
 * @param {string} playerSymbol - 'X' or 'O'
 * @returns {Object} { success: boolean, error?: string, updatedState: Object }
 */
function makeMove(state, cellIndex, playerSymbol) {
  if (state.isGameOver) {
    return { success: false, error: 'Game is already over' };
  }

  if (state.currentTurn !== playerSymbol) {
    return { success: false, error: `It is not player ${playerSymbol}'s turn` };
  }

  const maxIndex = state.gridSize * state.gridSize - 1;
  if (cellIndex < 0 || cellIndex > maxIndex || !Number.isInteger(cellIndex)) {
    return { success: false, error: `Invalid cell index ${cellIndex}` };
  }

  if (state.board[cellIndex] !== null) {
    return { success: false, error: 'Cell is already occupied' };
  }

  // Clone board and apply move
  const newBoard = [...state.board];
  newBoard[cellIndex] = playerSymbol;
  const newMovesCount = state.movesCount + 1;

  const historyEntry = {
    moveNumber: newMovesCount,
    player: playerSymbol,
    cellIndex,
    timestamp: Date.now()
  };

  // Check for Win condition
  const winResult = checkWinCondition(newBoard, state.gridSize, state.winCondition, cellIndex, playerSymbol);

  let isGameOver = false;
  let winner = null;
  let winningLine = null;
  let isDraw = false;

  if (winResult.hasWon) {
    isGameOver = true;
    winner = playerSymbol;
    winningLine = winResult.winningCells;
  } else if (newMovesCount === state.gridSize * state.gridSize) {
    // Board is completely full and no winner -> Draw
    isGameOver = true;
    isDraw = true;
  }

  const updatedState = {
    ...state,
    board: newBoard,
    currentTurn: isGameOver ? null : (playerSymbol === 'X' ? 'O' : 'X'),
    movesCount: newMovesCount,
    isGameOver,
    winner,
    winningLine,
    isDraw,
    history: [...state.history, historyEntry]
  };

  return { success: true, updatedState };
}

/**
 * Checks whether the latest move resulted in K-in-a-row.
 * Evaluates 4 axes: Horizontal, Vertical, Diagonal (\), Anti-diagonal (/)
 */
function checkWinCondition(board, N, K, lastIndex, symbol) {
  const row = Math.floor(lastIndex / N);
  const col = lastIndex % N;

  const directions = [
    { dr: 0, dc: 1 },  // Horizontal
    { dr: 1, dc: 0 },  // Vertical
    { dr: 1, dc: 1 },  // Diagonal \
    { dr: 1, dc: -1 }  // Anti-diagonal /
  ];

  for (const { dr, dc } of directions) {
    const line = [lastIndex];

    // Check forward direction
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < N && c >= 0 && c < N && board[r * N + c] === symbol) {
      line.push(r * N + c);
      r += dr;
      c += dc;
    }

    // Check backward direction
    r = row - dr;
    c = col - dc;
    while (r >= 0 && r < N && c >= 0 && c < N && board[r * N + c] === symbol) {
      line.unshift(r * N + c);
      r -= dr;
      c -= dc;
    }

    if (line.length >= K) {
      return { hasWon: true, winningCells: line.slice(0, K) };
    }
  }

  return { hasWon: false, winningCells: null };
}

module.exports = {
  createGameState,
  makeMove,
  checkWinCondition
};
