import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { MatchInfo, GameRules, ScoringPolicy } from '../types';
import { Swords, Loader2, Trophy, Zap, AlertCircle, PlayCircle, ShieldCheck, XCircle, Grid3X3, LayoutGrid } from 'lucide-react';

interface PlayerLobbyProps {
  onGameStart: (match: MatchInfo, playerSymbol: 'X' | 'O') => void;
}

export const PlayerLobby: React.FC<PlayerLobbyProps> = ({ onGameStart }) => {
  const { user, refreshUserData } = useAuth();
  const [selectedGridSize, setSelectedGridSize] = useState<number>(3);
  const [isQueued, setIsQueued] = useState(false);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [waitingSeconds, setWaitingSeconds] = useState(0);
  const [rules, setRules] = useState<GameRules | null>(null);
  const [scoring, setScoring] = useState<ScoringPolicy | null>(null);
  const [matchedGame, setMatchedGame] = useState<MatchInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load active rules and scoring & reset stale match
  useEffect(() => {
    setMatchedGame(null);
    setIsQueued(false);
    setWaitingSeconds(0);
    api.getRules().then(setRules).catch(console.error);
    api.getScoring().then(setScoring).catch(console.error);
    refreshUserData();
  }, []);

  // Poll status when queued
  useEffect(() => {
    if (!isQueued || !user) return;

    timerRef.current = setInterval(() => {
      setWaitingSeconds(s => s + 1);
    }, 1000);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await api.getMatchmakingStatus(user.id);
        if (res.status === 'matched' && res.match) {
          setIsQueued(false);
          setMatchedGame(res.match);

          const mySymbol = res.match.playerX.userId === user.id ? 'X' : 'O';
          setTimeout(() => {
            onGameStart(res.match, mySymbol);
          }, 1500); // Brief transition screen
        } else if (res.status === 'queued') {
          setQueuePosition(res.queuePosition || 1);
        }
      } catch (err: any) {
        console.error('Matchmaking poll error:', err);
      }
    }, 1500);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isQueued, user]);

  const handleJoinQueue = async () => {
    if (!user) return;
    setError(null);
    setMatchedGame(null);
    setWaitingSeconds(0);
    try {
      const res = await api.joinMatchmaking(user.id, user.username, selectedGridSize);
      if (res.status === 'matched' && res.match) {
        setMatchedGame(res.match);
        const mySymbol = res.match.playerX.userId === user.id ? 'X' : 'O';
        setTimeout(() => {
          onGameStart(res.match, mySymbol);
        }, 1500);
      } else {
        setIsQueued(true);
        setQueuePosition(res.queuePosition || 1);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to join matchmaking');
    }
  };

  const handleLeaveQueue = async () => {
    if (!user) return;
    try {
      await api.leaveMatchmaking(user.id);
      setIsQueued(false);
      setQueuePosition(null);
      setWaitingSeconds(0);
    } catch (err: any) {
      setError(err.message || 'Failed to leave matchmaking');
    }
  };

  const gameModes = [
    {
      size: 3,
      name: 'Classic 3 × 3',
      description: '3 consecutive in a row',
      badge: 'Fast & Pure',
      icon: Grid3X3
    },
    {
      size: 4,
      name: 'Tactical 4 × 4',
      description: '4 consecutive in a row',
      badge: 'Strategic',
      icon: LayoutGrid
    },
    {
      size: 5,
      name: 'Grand 5 × 5',
      description: '4 consecutive in a row',
      badge: 'Advanced',
      icon: LayoutGrid
    }
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      
      {/* Matched Banner Modal */}
      {matchedGame && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in zoom-in duration-200">
          <div className="bg-slate-900 border border-purple-500/50 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl shadow-purple-500/30">
            <div className="inline-flex p-3 rounded-full bg-emerald-500/20 text-emerald-400 mb-4 animate-bounce">
              <ShieldCheck className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-black text-white">Match Confirmed!</h2>
            <p className="text-sm text-slate-300 mt-2">
              Opponent found: <span className="font-bold text-indigo-400">{matchedGame.playerX.userId === user.id ? matchedGame.playerO.username : matchedGame.playerX.username}</span>
            </p>
            <div className="my-3 text-xs font-mono text-purple-300">
              Game Mode: {matchedGame.gridSize || selectedGridSize} × {matchedGame.gridSize || selectedGridSize} Grid
            </div>
            <div className="my-4 inline-block px-5 py-2 rounded-xl bg-purple-500/20 border border-purple-500/40 font-mono text-lg font-extrabold text-purple-300">
              You play as: {matchedGame.playerX.userId === user.id ? 'X (First Turn)' : 'O (Second Turn)'}
            </div>
            <div className="flex items-center justify-center space-x-2 text-xs text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
              <span>Connecting to Live Game Engine...</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Hero Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-purple-950/40 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden mb-8">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
          <div className="text-center md:text-left space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold">
              <Zap className="w-3.5 h-3.5 text-purple-400" />
              <span>Select Your Game Mode</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Enter The Arena
            </h1>
            <p className="text-slate-400 text-sm max-w-lg">
              Choose your preferred board dimension. Matchmaking automatically pairs you with an opponent in the same queue!
            </p>
          </div>

          {/* Action Button */}
          <div className="w-full md:w-auto flex flex-col items-center">
            {isQueued ? (
              <div className="flex flex-col items-center space-y-3">
                <div className="flex items-center space-x-3 px-6 py-3.5 rounded-2xl bg-indigo-950/60 border border-indigo-500/50 text-indigo-200">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                  <div className="text-left">
                    <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                      Searching {selectedGridSize}×{selectedGridSize} Opponent...
                    </div>
                    <div className="text-xs font-mono text-slate-300">
                      Position #{queuePosition} • {waitingSeconds}s elapsed
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleLeaveQueue}
                  className="flex items-center space-x-1.5 text-xs text-rose-400 hover:text-rose-300 py-1 px-3 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Cancel Matchmaking</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleJoinQueue}
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-base rounded-2xl shadow-xl shadow-purple-600/30 hover:shadow-purple-600/50 transition-all flex items-center justify-center space-x-3 cursor-pointer group"
              >
                <Swords className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                <span>Find {selectedGridSize} × {selectedGridSize} Match</span>
              </button>
            )}
          </div>
        </div>

        {/* Game Mode Selector Cards */}
        {!isQueued && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-800/80">
            {gameModes.map(m => {
              const Icon = m.icon;
              const isSelected = selectedGridSize === m.size;
              return (
                <button
                  key={m.size}
                  type="button"
                  onClick={() => setSelectedGridSize(m.size)}
                  className={`p-4 rounded-2xl text-left border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-purple-600/20 border-purple-500/80 shadow-lg shadow-purple-500/20 ring-1 ring-purple-500'
                      : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-950/90'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Icon className={`w-5 h-5 ${isSelected ? 'text-purple-400' : 'text-slate-400'}`} />
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                      isSelected ? 'bg-purple-500/30 text-purple-200' : 'bg-slate-900 text-slate-500'
                    }`}>
                      {m.badge}
                    </span>
                  </div>
                  <div className="font-extrabold text-sm text-white">{m.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{m.description}</div>
                </button>
              );
            })}
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Grid of Rules & Scoring Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Active Rules Card */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <PlayCircle className="w-5 h-5 text-purple-400" />
              <h3 className="font-bold text-white text-base">Current Mode Rules</h3>
            </div>
            <span className="text-[11px] font-mono text-slate-500">Registry Service</span>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center py-2 border-b border-slate-800/80">
              <span className="text-slate-400">Selected Grid</span>
              <span className="font-mono font-bold text-purple-300">
                {selectedGridSize} × {selectedGridSize}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-800/80">
              <span className="text-slate-400">Win Condition</span>
              <span className="font-mono font-bold text-purple-300">
                {selectedGridSize === 3 ? '3 consecutive' : '4 consecutive'}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-400">Turn Timeout</span>
              <span className="font-mono font-bold text-purple-300">
                {rules ? `${rules.turnTimeoutSeconds}s` : '30s'}
              </span>
            </div>
          </div>
        </div>

        {/* Scoring Policy Card */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-white text-base">Scoring & Credit Rewards</h3>
            </div>
            <span className="text-[11px] font-mono text-slate-500">From Registry Service</span>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center py-2 border-b border-slate-800/80">
              <span className="text-slate-400">Victory Reward</span>
              <span className="font-mono font-bold text-emerald-400">
                +{scoring ? scoring.winCredits : 50} Credits
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-800/80">
              <span className="text-slate-400">Stalemate (Draw)</span>
              <span className="font-mono font-bold text-amber-400">
                +{scoring ? scoring.drawCredits : 10} Credits
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-400">Defeat Penalty</span>
              <span className="font-mono font-bold text-rose-400">
                {scoring ? scoring.lossCredits : -10} Credits
              </span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
