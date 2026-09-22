import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { GameRules, ScoringPolicy, AnalyticsOverview, MatchRecord, PlayerStats, User } from '../types';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  Settings, Save, Trophy, Sliders, CheckCircle2,
  TrendingUp, Users, Swords, Clock, AlertCircle, RefreshCw,
  Lock, ShieldAlert, ShieldCheck
} from 'lucide-react';

const PIE_COLORS = ['#8b5cf6', '#f59e0b'];

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Config state
  const [rules, setRules] = useState<GameRules>({ gridSize: 3, winCondition: 3, turnTimeoutSeconds: 30 });
  const [scoring, setScoring] = useState<ScoringPolicy>({ winCredits: 50, lossCredits: -10, drawCredits: 10 });
  
  // Analytics state
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [matchHistory, setMatchHistory] = useState<MatchRecord[]>([]);
  const [winRates, setWinRates] = useState<PlayerStats[]>([]);
  const [leaderboard, setLeaderboard] = useState<User[]>([]);

  // Status feedback
  const [rulesSuccess, setRulesSuccess] = useState(false);
  const [scoringSuccess, setScoringSuccess] = useState(false);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [scoringError, setScoringError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = async () => {
    setIsRefreshing(true);
    try {
      const [r, s, o, m, w, l] = await Promise.all([
        api.getRules().catch(() => null),
        api.getScoring().catch(() => null),
        api.getAnalyticsOverview().catch(() => null),
        api.getMatchHistory().catch(() => []),
        api.getPlayerWinRates().catch(() => []),
        api.getLeaderboard().catch(() => [])
      ]);

      if (r) setRules(r);
      if (s) setScoring(s);
      if (o) setOverview(o);
      if (m) setMatchHistory(m);
      if (w) setWinRates(w);
      if (l) setLeaderboard(l);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setRulesError(null);
    setRulesSuccess(false);

    if (rules.winCondition > rules.gridSize) {
      setRulesError(`Win condition (${rules.winCondition}) cannot exceed grid size (${rules.gridSize})`);
      return;
    }

    try {
      const updated = await api.updateRules(rules);
      setRules(updated);
      setRulesSuccess(true);
      setTimeout(() => setRulesSuccess(false), 3000);
    } catch (err: any) {
      setRulesError(err.message || 'Failed to update rules');
    }
  };

  const handleSaveScoring = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setScoringError(null);
    setScoringSuccess(false);

    try {
      const updated = await api.updateScoring(scoring);
      setScoring(updated);
      setScoringSuccess(true);
      setTimeout(() => setScoringSuccess(false), 3000);
    } catch (err: any) {
      setScoringError(err.message || 'Failed to update scoring policy');
    }
  };

  const pieData = overview ? [
    { name: 'Decisive Wins', value: overview.totalWins },
    { name: 'Stalemates (Draws)', value: overview.totalDraws }
  ] : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center space-x-3">
            <Sliders className="w-7 h-7 text-purple-400" />
            <span>Control Plane & Analytics Dashboard</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Dynamic platform parameters, rules registry, and event-driven performance metrics.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={isRefreshing}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-purple-400' : ''}`} />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {/* Role-Based Access Notification Banner */}
      {!isAdmin ? (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs sm:text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center space-x-3">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold text-amber-300">Player Mode (Read-Only)</span>: You are signed in as <span className="font-mono font-bold text-white">{user?.username}</span>. Game rules and scoring configuration are locked. To modify rules, log in with an Administrator account (<code className="px-1.5 py-0.5 rounded bg-slate-900 text-purple-300">admin / admin123</code>).
            </div>
          </div>
          <span className="shrink-0 flex items-center space-x-1 uppercase text-[10px] font-extrabold tracking-wider px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <Lock className="w-3 h-3" />
            <span>Read-Only</span>
          </span>
        </div>
      ) : (
        <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-200 text-xs sm:text-sm flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-3">
            <ShieldCheck className="w-5 h-5 text-purple-400 shrink-0" />
            <div>
              <span className="font-bold text-purple-300">Administrator Mode</span>: Full write permissions enabled for Registry & Scoring Services.
            </div>
          </div>
          <span className="uppercase text-[10px] font-extrabold tracking-wider px-2.5 py-1 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
            Admin Authorized
          </span>
        </div>
      )}

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-semibold">Total Matches</span>
            <Swords className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">
            {overview?.totalMatches ?? 0}
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-semibold">Total Wins</span>
            <Trophy className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">
            {overview?.totalWins ?? 0}
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-semibold">Avg Match Time</span>
            <Clock className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">
            {overview?.avgDurationSeconds ?? 0}<span className="text-xs font-normal text-slate-400 ml-1">sec</span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-semibold">Avg Moves/Game</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">
            {overview?.avgMovesPerMatch ?? 0}
          </div>
        </div>
      </div>

      {/* Configuration Section (Grid Rules & Scoring Policies) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Rules Configuration */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Settings className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-bold text-white">Game Rules Registry</h2>
            </div>
            {!isAdmin && (
              <span className="flex items-center space-x-1 text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                <Lock className="w-3 h-3" />
                <span>Locked</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mb-5">
            Modify the active Tic-Tac-Toe configuration. New game rooms will instantly spawn using these rules.
          </p>

          {rulesSuccess && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Game rules updated successfully in Registry Service!</span>
            </div>
          )}

          {rulesError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4" />
              <span>{rulesError}</span>
            </div>
          )}

          <form onSubmit={handleSaveRules} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Grid Size (N × N)
                </label>
                <select
                  disabled={!isAdmin}
                  value={rules.gridSize}
                  onChange={(e) => {
                    const size = parseInt(e.target.value, 10);
                    setRules(r => ({
                      ...r,
                      gridSize: size,
                      winCondition: Math.min(r.winCondition, size)
                    }));
                  }}
                  className="w-full py-2.5 px-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value={3}>3 × 3 (Classic)</option>
                  <option value={4}>4 × 4 (Medium)</option>
                  <option value={5}>5 × 5 (Large)</option>
                  <option value={6}>6 × 6 (Super)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Win Condition (K-in-a-row)
                </label>
                <select
                  disabled={!isAdmin}
                  value={rules.winCondition}
                  onChange={(e) => setRules(r => ({ ...r, winCondition: parseInt(e.target.value, 10) }))}
                  className="w-full py-2.5 px-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {Array.from({ length: rules.gridSize - 2 }, (_, i) => i + 3).map((val) => (
                    <option key={val} value={val}>{val} consecutive</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Turn Timeout (seconds)
              </label>
              <input
                disabled={!isAdmin}
                type="number"
                min={5}
                max={120}
                value={rules.turnTimeoutSeconds}
                onChange={(e) => setRules(r => ({ ...r, turnTimeoutSeconds: parseInt(e.target.value, 10) || 30 }))}
                className="w-full py-2.5 px-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            {isAdmin ? (
              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Publish New Game Rules</span>
              </button>
            ) : (
              <div className="w-full py-2.5 px-4 bg-slate-950/60 border border-slate-800 text-slate-500 font-medium text-xs rounded-xl flex items-center justify-center space-x-2 select-none">
                <Lock className="w-3.5 h-3.5 text-slate-600" />
                <span>Sign in as Admin to edit rules</span>
              </div>
            )}
          </form>
        </div>

        {/* Scoring Policy Configuration */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-bold text-white">Scoring & Credits Policy</h2>
            </div>
            {!isAdmin && (
              <span className="flex items-center space-x-1 text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                <Lock className="w-3 h-3" />
                <span>Locked</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mb-5">
            Set credit adjustments applied by the Analytics & Scoring Service upon receiving Redis GAME_OVER events.
          </p>

          {scoringSuccess && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Scoring policy saved to Registry Service!</span>
            </div>
          )}

          {scoringError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4" />
              <span>{scoringError}</span>
            </div>
          )}

          <form onSubmit={handleSaveScoring} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Win Credits
                </label>
                <input
                  disabled={!isAdmin}
                  type="number"
                  value={scoring.winCredits}
                  onChange={(e) => setScoring(s => ({ ...s, winCredits: parseInt(e.target.value, 10) || 0 }))}
                  className="w-full py-2.5 px-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Loss Credits
                </label>
                <input
                  disabled={!isAdmin}
                  type="number"
                  value={scoring.lossCredits}
                  onChange={(e) => setScoring(s => ({ ...s, lossCredits: parseInt(e.target.value, 10) || 0 }))}
                  className="w-full py-2.5 px-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Draw Credits
                </label>
                <input
                  disabled={!isAdmin}
                  type="number"
                  value={scoring.drawCredits}
                  onChange={(e) => setScoring(s => ({ ...s, drawCredits: parseInt(e.target.value, 10) || 0 }))}
                  className="w-full py-2.5 px-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-purple-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {isAdmin ? (
              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center space-x-2 cursor-pointer mt-7"
              >
                <Save className="w-4 h-4" />
                <span>Update Scoring Policy</span>
              </button>
            ) : (
              <div className="w-full py-2.5 px-4 bg-slate-950/60 border border-slate-800 text-slate-500 font-medium text-xs rounded-xl flex items-center justify-center space-x-2 select-none mt-7">
                <Lock className="w-3.5 h-3.5 text-slate-600" />
                <span>Sign in as Admin to edit scoring</span>
              </div>
            )}
          </form>
        </div>

      </div>

      {/* Analytics Charts (Recharts) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Bar Chart: Player Win Rates */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-base font-bold text-white mb-4 flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            <span>Player Win Counts & Match Record</span>
          </h3>

          <div className="h-64 w-full">
            {winRates.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={winRates} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="username" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem' }}
                    labelStyle={{ color: '#e2e8f0', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="wins" name="Wins" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="losses" name="Losses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="draws" name="Draws" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No match records yet. Play a game to view real-time metrics!
              </div>
            )}
          </div>
        </div>

        {/* Donut Chart: Match Outcomes Distribution */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-base font-bold text-white mb-4">Match Outcomes</h3>
          <div className="h-64 w-full flex items-center justify-center">
            {overview && overview.totalMatches > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem' }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-500">
                Awaiting first completed match...
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Leaderboard Table & Recent Matches */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Player Leaderboard */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center space-x-2 mb-4">
            <Users className="w-5 h-5 text-purple-400" />
            <h3 className="text-base font-bold text-white">Player Leaderboard</h3>
          </div>

          <div className="space-y-2">
            {leaderboard.map((u, i) => (
              <div
                key={u.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80"
              >
                <div className="flex items-center space-x-3">
                  <span className={`w-6 text-center font-mono font-bold text-xs ${
                    i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : 'text-slate-500'
                  }`}>
                    #{i + 1}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-slate-200">{u.username}</div>
                    <div className="text-[10px] text-slate-500 uppercase">{u.role}</div>
                  </div>
                </div>
                <div className="font-mono font-bold text-purple-300 text-sm">
                  {u.credits} <span className="text-[10px] text-slate-500">CR</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Matches Log */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-base font-bold text-white mb-4">Recent Matches (Event-Driven Records)</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Match ID</th>
                  <th className="py-2.5 px-3">Players</th>
                  <th className="py-2.5 px-3">Result</th>
                  <th className="py-2.5 px-3">Moves</th>
                  <th className="py-2.5 px-3">Duration</th>
                  <th className="py-2.5 px-3">Credits (X / O)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {matchHistory.length > 0 ? (
                  matchHistory.slice(0, 8).map((m) => {
                    const winnerUsername = m.is_draw ? 'Draw' : (m.winner_id === m.player_x_id ? m.player_x_username : m.player_o_username);
                    return (
                      <tr key={m.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-3 font-mono text-slate-400">{m.match_id.slice(0, 14)}</td>
                        <td className="py-3 px-3 font-medium text-slate-200">
                          {m.player_x_username} vs {m.player_o_username}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-full font-semibold ${
                            m.is_draw
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-emerald-500/20 text-emerald-300'
                          }`}>
                            {winnerUsername}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono">{m.move_count}</td>
                        <td className="py-3 px-3 font-mono">{m.duration_seconds}s</td>
                        <td className="py-3 px-3 font-mono text-purple-300">
                          +{m.credits_awarded_x} / {m.credits_awarded_o >= 0 ? `+${m.credits_awarded_o}` : m.credits_awarded_o}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-slate-500">
                      No matches registered yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
};
