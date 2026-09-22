import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getGameSocket } from '../services/socket';
import { MatchInfo, GameState, GameOverResult } from '../types';
import { Trophy, Frown, Equal, Flag, RefreshCw, Sparkles, User, Clock } from 'lucide-react';

interface GameBoardProps {
  match: MatchInfo;
  playerSymbol: 'X' | 'O';
  onBackToLobby: () => void;
  onViewAnalytics: () => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  match,
  playerSymbol,
  onBackToLobby,
  onViewAnalytics
}) => {
  const { user, refreshUserData } = useAuth();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameOverResult, setGameOverResult] = useState<GameOverResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [opponentConnected, setOpponentConnected] = useState(true);

  const opponent = playerSymbol === 'X' ? match.playerO : match.playerX;
  const isMyTurn = gameState ? gameState.currentTurn === playerSymbol && !gameState.isGameOver : false;

  useEffect(() => {
    if (!user) return;
    const socket = getGameSocket();

    // Join the match room on the Game Engine
    socket.emit('join_game', {
      matchId: match.matchId,
      userId: user.id,
      username: user.username,
      playerSymbol
    });

    // Listen for game initialized
    socket.on('game_init', (data: { state: GameState }) => {
      setGameState(data.state);
      setGameOverResult(null);
    });

    // Listen for moves made by either player
    socket.on('move_made', (data: { state: GameState }) => {
      setGameState(data.state);
      setErrorMessage(null);
    });

    // Listen for Game Over event
    socket.on('game_over', (result: GameOverResult) => {
      setGameOverResult(result);
      setGameState(prev => prev ? { ...prev, isGameOver: true, winner: result.winner, winningLine: result.winningLine } : null);
      // Give the Scoring Service a brief moment to update credits, then refresh auth credits
      setTimeout(() => {
        refreshUserData();
      }, 1000);
    });

    // Move rejection from server
    socket.on('move_error', (data: { message: string }) => {
      setErrorMessage(data.message);
    });

    // Opponent status updates
    socket.on('player_status_change', (data: any) => {
      const oppKey = playerSymbol === 'X' ? 'playerO' : 'playerX';
      if (data.players && data.players[oppKey]) {
        setOpponentConnected(data.players[oppKey].connected);
      }
    });

    socket.on('player_disconnected', (data: { playerSymbol: string }) => {
      if (data.playerSymbol !== playerSymbol) {
        setOpponentConnected(false);
      }
    });

    return () => {
      socket.off('game_init');
      socket.off('move_made');
      socket.off('game_over');
      socket.off('move_error');
      socket.off('player_status_change');
      socket.off('player_disconnected');
    };
  }, [match.matchId, user, playerSymbol]);

  const handleCellClick = (index: number) => {
    if (!gameState || !isMyTurn || gameState.board[index] !== null || !user) return;

    const socket = getGameSocket();
    socket.emit('make_move', {
      matchId: match.matchId,
      cellIndex: index,
      playerSymbol,
      userId: user.id
    });
  };

  const handleResign = () => {
    if (!user || !gameState || gameState.isGameOver) return;
    if (window.confirm('Are you sure you want to resign this match?')) {
      const socket = getGameSocket();
      socket.emit('resign', {
        matchId: match.matchId,
        userId: user.id
      });
    }
  };

  const handleLeaveMatch = () => {
    if (user) {
      const socket = getGameSocket();
      socket.emit('leave_game', { matchId: match.matchId, userId: user.id });
    }
    setGameState(null);
    setGameOverResult(null);
    onBackToLobby();
  };

  const handleGoToAnalytics = () => {
    if (user) {
      const socket = getGameSocket();
      socket.emit('leave_game', { matchId: match.matchId, userId: user.id });
    }
    setGameState(null);
    setGameOverResult(null);
    onViewAnalytics();
  };

  const N = gameState ? gameState.gridSize : 3;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      
      {/* Match Header with Players */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 mb-6 shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between">
          
          {/* You (Player 1 or 2) */}
          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-2xl shadow-lg ${
              playerSymbol === 'X'
                ? 'bg-purple-600/20 text-purple-400 border border-purple-500/40 shadow-purple-500/20'
                : 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40 shadow-indigo-500/20'
            }`}>
              {playerSymbol}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-white text-base">{user?.username}</span>
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">You</span>
              </div>
              <div className="text-xs text-slate-400 font-mono">Token: {playerSymbol}</div>
            </div>
          </div>

          {/* VS & Turn Indicator */}
          <div className="text-center px-4">
            <div className="text-xs font-mono font-bold tracking-widest text-slate-500 uppercase mb-1">
              Match Session
            </div>
            {gameState && !gameState.isGameOver && (
              <div className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                isMyTurn
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                <Clock className="w-3.5 h-3.5" />
                <span>{isMyTurn ? 'Your Turn' : "Opponent's Turn"}</span>
              </div>
            )}
          </div>

          {/* Opponent */}
          <div className="flex items-center space-x-3 flex-row-reverse space-x-reverse">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-2xl shadow-lg ${
              playerSymbol === 'X'
                ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40 shadow-indigo-500/20'
                : 'bg-purple-600/20 text-purple-400 border border-purple-500/40 shadow-purple-500/20'
            }`}>
              {playerSymbol === 'X' ? 'O' : 'X'}
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end space-x-2">
                <span className="font-bold text-white text-base">{opponent.username}</span>
                <span className={`w-2 h-2 rounded-full ${opponentConnected ? 'bg-emerald-400' : 'bg-rose-500 animate-ping'}`} />
              </div>
              <div className="text-xs text-slate-400 font-mono">Token: {playerSymbol === 'X' ? 'O' : 'X'}</div>
            </div>
          </div>

        </div>
      </div>

      {errorMessage && (
        <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs text-center">
          {errorMessage}
        </div>
      )}

      {/* Dynamic N x N Game Board */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center">
        
        <div className="text-xs text-slate-400 mb-4 font-mono">
          Rules: {N}×{N} Grid • {gameState ? gameState.winCondition : 3} consecutive symbols to win
        </div>

        <div
          className="grid gap-2 sm:gap-3 p-3 bg-slate-950/80 rounded-2xl border border-slate-800/80 shadow-inner"
          style={{
            gridTemplateColumns: `repeat(${N}, minmax(0, 1fr))`,
            width: '100%',
            maxWidth: `${Math.min(N * 90, 520)}px`
          }}
        >
          {gameState && gameState.board.map((cell, idx) => {
            const isWinningCell = gameState.winningLine?.includes(idx);
            return (
              <button
                key={idx}
                onClick={() => handleCellClick(idx)}
                disabled={!isMyTurn || cell !== null || gameState.isGameOver}
                className={`aspect-square rounded-xl sm:rounded-2xl font-black text-2xl sm:text-4xl flex items-center justify-center transition-all duration-150 select-none ${
                  cell === null
                    ? isMyTurn && !gameState.isGameOver
                      ? 'bg-slate-900/90 hover:bg-purple-950/40 hover:border-purple-500/50 border border-slate-800 text-transparent hover:text-purple-400/40 cursor-pointer'
                      : 'bg-slate-900/60 border border-slate-800/60 cursor-not-allowed'
                    : cell === 'X'
                      ? isWinningCell
                        ? 'bg-purple-600 text-white border-2 border-purple-300 shadow-lg shadow-purple-500/50 animate-bounce'
                        : 'bg-purple-950/60 border border-purple-800 text-purple-300 shadow-inner'
                      : isWinningCell
                        ? 'bg-indigo-600 text-white border-2 border-indigo-300 shadow-lg shadow-indigo-500/50 animate-bounce'
                        : 'bg-indigo-950/60 border border-indigo-800 text-indigo-300 shadow-inner'
                }`}
              >
                {cell || (isMyTurn && !gameState.isGameOver ? playerSymbol : '')}
              </button>
            );
          })}
        </div>

        {/* Board Controls */}
        <div className="w-full max-w-sm mt-6 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={handleResign}
              disabled={!gameState || gameState.isGameOver}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-semibold text-slate-400 hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <Flag className="w-3.5 h-3.5" />
              <span>Resign</span>
            </button>

            <button
              onClick={handleLeaveMatch}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-semibold text-slate-400 hover:text-purple-400 hover:border-purple-500/30 hover:bg-purple-500/10 transition-colors cursor-pointer"
            >
              <span>Exit to Lobby</span>
            </button>
          </div>

          <span className="text-xs font-mono text-slate-500">
            Moves: {gameState ? gameState.movesCount : 0}
          </span>
        </div>

      </div>

      {/* Game Over Modal Dialog */}
      {gameOverResult && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl relative overflow-hidden">
            
            {/* Background Glow */}
            <div className={`absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-3xl pointer-events-none ${
              gameOverResult.isDraw
                ? 'bg-amber-500/20'
                : gameOverResult.winner === playerSymbol
                  ? 'bg-emerald-500/20'
                  : 'bg-rose-500/20'
            }`} />

            {/* Icon */}
            <div className="mb-4 inline-flex p-4 rounded-2xl">
              {gameOverResult.isDraw ? (
                <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center">
                  <Equal className="w-8 h-8" />
                </div>
              ) : gameOverResult.winner === playerSymbol ? (
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <Trophy className="w-8 h-8 animate-bounce" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center">
                  <Frown className="w-8 h-8" />
                </div>
              )}
            </div>

            {/* Headline */}
            <h2 className="text-3xl font-black text-white tracking-tight">
              {gameOverResult.isDraw
                ? 'Stalemate (Draw)!'
                : gameOverResult.winner === playerSymbol
                  ? 'Victory!'
                  : 'Defeat!'}
            </h2>

            <p className="text-sm text-slate-400 mt-2">
              {gameOverResult.isDraw
                ? 'The grid is completely exhausted with no line formed.'
                : gameOverResult.winner === playerSymbol
                  ? `Spectacular move! You connected ${gameState?.winCondition} in a row.`
                  : `Opponent ${opponent.username} claimed victory this round.`}
            </p>

            <div className="my-5 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300">
              <span className="font-semibold text-purple-400">Event-Driven Update: </span>
              GAME_OVER emitted via Redis Pub/Sub. Credits have been recorded to the Scoring Service.
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                onClick={handleLeaveMatch}
                className="py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-purple-600/30 transition-all cursor-pointer flex items-center justify-center space-x-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Play Again</span>
              </button>

              <button
                onClick={handleGoToAnalytics}
                className="py-3 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-sm rounded-xl transition-all cursor-pointer"
              >
                View Analytics
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
