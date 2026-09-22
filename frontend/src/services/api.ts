import { GameRules, ScoringPolicy, AnalyticsOverview, MatchRecord, PlayerStats, User } from '../types';

const BASE_URL = ''; // Proxied via Vite to API Gateway (http://localhost:5000)

function getHeaders(token?: string | null): HeadersInit {
  const authToken = token || localStorage.getItem('game_jwt_token');
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
}

export const api = {
  // Authentication Endpoints
  async register(username: string, password: string, role: string = 'player') {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ username, password, role })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    return data;
  },

  async login(username: string, password: string) {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    return data;
  },

  async verify(token: string) {
    const res = await fetch(`${BASE_URL}/api/auth/verify`, {
      headers: getHeaders(token)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Invalid session');
    return data;
  },

  async getUsers() {
    const res = await fetch(`${BASE_URL}/api/auth/users`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch users');
    return data.users as User[];
  },

  // Configuration Endpoints
  async getRules(): Promise<GameRules> {
    const res = await fetch(`${BASE_URL}/api/config/rules`);
    const data = await res.json();
    return data.rules;
  },

  async updateRules(rules: Partial<GameRules>): Promise<GameRules> {
    const res = await fetch(`${BASE_URL}/api/config/rules`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(rules)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update rules');
    return data.rules;
  },

  async getScoring(): Promise<ScoringPolicy> {
    const res = await fetch(`${BASE_URL}/api/config/scoring`);
    const data = await res.json();
    return data.scoring;
  },

  async updateScoring(scoring: Partial<ScoringPolicy>): Promise<ScoringPolicy> {
    const res = await fetch(`${BASE_URL}/api/config/scoring`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(scoring)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update scoring');
    return data.scoring;
  },

  // Matchmaking Endpoints
  async joinMatchmaking(userId: string, username: string, gridSize: number = 3) {
    const res = await fetch(`${BASE_URL}/api/matchmaking/join`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ userId, username, gridSize })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to join matchmaking');
    return data;
  },

  async leaveMatchmaking(userId: string) {
    const res = await fetch(`${BASE_URL}/api/matchmaking/leave`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ userId })
    });
    return res.json();
  },

  async getMatchmakingStatus(userId: string) {
    const res = await fetch(`${BASE_URL}/api/matchmaking/status/${userId}`);
    return res.json();
  },

  async getMatchmakingQueue() {
    const res = await fetch(`${BASE_URL}/api/matchmaking/queue`);
    return res.json();
  },

  // Analytics Endpoints
  async getAnalyticsOverview(): Promise<AnalyticsOverview> {
    const res = await fetch(`${BASE_URL}/api/analytics/overview`);
    const data = await res.json();
    return data.overview;
  },

  async getMatchHistory(): Promise<MatchRecord[]> {
    const res = await fetch(`${BASE_URL}/api/analytics/matches`);
    const data = await res.json();
    return data.matches || [];
  },

  async getPlayerWinRates(): Promise<PlayerStats[]> {
    const res = await fetch(`${BASE_URL}/api/analytics/win-rates`);
    const data = await res.json();
    return data.playerStats || [];
  },

  async getLeaderboard(): Promise<User[]> {
    const res = await fetch(`${BASE_URL}/api/analytics/leaderboard`);
    const data = await res.json();
    return data.leaderboard || [];
  },

  // Gateway Cluster Status
  async getClusterStatus() {
    const res = await fetch(`${BASE_URL}/api/status`);
    return res.json();
  }
};
