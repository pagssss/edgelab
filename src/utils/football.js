/* eslint-disable */
const API_SPORTS_KEY = process.env.REACT_APP_API_SPORTS_KEY;
const headers = { 'x-apisports-key': API_SPORTS_KEY };

// Cache avec TTL 4h pour économiser les requêtes
const cache = {};
const CACHE_TTL = 4 * 60 * 60 * 1000;

const cachedFetch = async (url) => {
  const now = Date.now();
  if (cache[url] && (now - cache[url].ts) < CACHE_TTL) {
    return cache[url].data;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  cache[url] = { data, ts: now };
  return data;
};

// ============================================
// LIGUES — IDs API-Sports
// ============================================
const LEAGUES = {
  'Ligue 1':        { id: 61,  season: 2024 },
  'Premier League': { id: 39,  season: 2024 },
  'La Liga':        { id: 140, season: 2024 },
  'Serie A':        { id: 135, season: 2024 },
  'Bundesliga':     { id: 78,  season: 2024 },
};

// ============================================
// CLASSEMENTS — 1 requête par ligue
// ============================================
const standingsCache = {};

export const fetchStandings = async (leagueLabel) => {
  const league = LEAGUES[leagueLabel];
  if (!league) return null;

  const key = `standings_${league.id}`;
  if (standingsCache[key]) return standingsCache[key];

  try {
    const data = await cachedFetch(
      `https://v3.football.api-sports.io/standings?league=${league.id}&season=${league.season}`
    );
    const standings = data.response?.[0]?.league?.standings?.[0] || [];
    standingsCache[key] = standings;
    return standings;
  } catch { return []; }
};

const findTeamInStandings = (standings, teamName) => {
  if (!standings || !teamName) return null;
  const name = teamName.toLowerCase();
  return standings.find(s =>
    s.team?.name?.toLowerCase().includes(name) ||
    name.includes(s.team?.name?.toLowerCase())
  ) || null;
};

// ============================================
// FORME — extraite du classement (pas de req sup)
// ============================================
const parseForm = (formStr) => {
  if (!formStr) return { form: [], winRate: 50 };
  const last5 = formStr.slice(-5).split('');
  const wins = last5.filter(r => r === 'W').length;
  const draws = last5.filter(r => r === 'D').length;
  const winRate = Math.round(((wins + draws * 0.5) / last5.length) * 100);
  return { form: last5, winRate };
};

// ============================================
// BLESSURES — seulement pour matchs importants
// ============================================
export const fetchInjuries = async (teamId, leagueId, season) => {
  try {
    const data = await cachedFetch(
      `https://v3.football.api-sports.io/injuries?team=${teamId}&league=${leagueId}&season=${season}`
    );
    return data.response || [];
  } catch { return []; }
};

// ============================================
// H2H — chargé au clic uniquement
// ============================================
export const fetchH2H = async (team1Id, team2Id) => {
  try {
    const data = await cachedFetch(
      `https://v3.football.api-sports.io/fixtures/headtohead?h2h=${team1Id}-${team2Id}&last=5`
    );
    const fixtures = data.response || [];
    let team1Wins = 0, team2Wins = 0, draws = 0;
    fixtures.forEach(f => {
      const homeId = f.teams?.home?.id;
      const homeGoals = f.goals?.home;
      const awayGoals = f.goals?.away;
      if (homeGoals === null || awayGoals === null) return;
      if (homeGoals > awayGoals) { if (homeId === team1Id) team1Wins++; else team2Wins++; }
      else if (awayGoals > homeGoals) { if (homeId === team1Id) team2Wins++; else team1Wins++; }
      else draws++;
    });
    return { team1Wins, team2Wins, draws, total: fixtures.length };
  } catch { return null; }
};

// ============================================
// STATS COMPLÈTES POUR UN MATCH
// ============================================
export const fetchFootballMatchStats = async (homeTeamName, awayTeamName, leagueLabel) => {
  try {
    const league = LEAGUES[leagueLabel];
    if (!league) return { available: false };

    // 1 seule requête : le classement de la ligue
    const standings = await fetchStandings(leagueLabel);
    if (!standings || standings.length === 0) return { available: false };

    const homeStanding = findTeamInStandings(standings, homeTeamName);
    const awayStanding = findTeamInStandings(standings, awayTeamName);

    if (!homeStanding || !awayStanding) return { available: false };

    const homeForm = parseForm(homeStanding.form);
    const awayForm = parseForm(awayStanding.form);

    // Stats du classement
    const homeStats = {
      teamId: homeStanding.team?.id,
      teamName: homeStanding.team?.name,
      position: homeStanding.rank,
      points: homeStanding.points,
      played: homeStanding.all?.played,
      goalsFor: homeStanding.all?.goals?.for,
      goalsAgainst: homeStanding.all?.goals?.against,
      avgGoalsFor: homeStanding.all?.played > 0
        ? Math.round((homeStanding.all?.goals?.for / homeStanding.all?.played) * 10) / 10
        : 0,
      avgGoalsAgainst: homeStanding.all?.played > 0
        ? Math.round((homeStanding.all?.goals?.against / homeStanding.all?.played) * 10) / 10
        : 0,
      form: homeForm.form,
      winRate: homeForm.winRate,
    };

    const awayStats = {
      teamId: awayStanding.team?.id,
      teamName: awayStanding.team?.name,
      position: awayStanding.rank,
      points: awayStanding.points,
      played: awayStanding.all?.played,
      goalsFor: awayStanding.all?.goals?.for,
      goalsAgainst: awayStanding.all?.goals?.against,
      avgGoalsFor: awayStanding.all?.played > 0
        ? Math.round((awayStanding.all?.goals?.for / awayStanding.all?.played) * 10) / 10
        : 0,
      avgGoalsAgainst: awayStanding.all?.played > 0
        ? Math.round((awayStanding.all?.goals?.against / awayStanding.all?.played) * 10) / 10
        : 0,
      form: awayForm.form,
      winRate: awayForm.winRate,
    };

    // Calcul de l'avantage
    const positionAdv = (awayStats.position - homeStats.position) / 20; // normalisé
    const formAdv = (homeStats.winRate - awayStats.winRate) / 100;
    const goalAdv = (homeStats.avgGoalsFor - awayStats.avgGoalsFor) * 0.05;
    const homeAdvantage = 0.05;
    const totalAdj = positionAdv * 0.1 + formAdv * 0.15 + goalAdv + homeAdvantage;

    const confidence = Math.min(0.85, Math.max(0.35,
      0.5 + Math.abs(positionAdv) * 0.2 + Math.abs(formAdv) * 0.3
    ));

    // Total projeté (Over/Under)
    const projectedTotal = Math.round((homeStats.avgGoalsFor + awayStats.avgGoalsFor +
      homeStats.avgGoalsAgainst + awayStats.avgGoalsAgainst) / 2 * 10) / 10;

    // Recommandations
    const bets = generateFootballBets(homeStats, awayStats, projectedTotal);

    return {
      available: true,
      homeTeam: homeStats,
      awayTeam: awayStats,
      positionDiff: awayStats.position - homeStats.position,
      projectedTotal,
      totalAdj,
      confidence,
      bets,
    };
  } catch (err) {
    console.error('Football stats error:', err);
    return { available: false };
  }
};

// ============================================
// RECOMMANDATIONS PARIS FOOT
// ============================================
const generateFootballBets = (home, away, projectedTotal) => {
  const bets = [];
  const posDiff = away.position - home.position;
  const formDiff = home.winRate - away.winRate;

  // MATCH NUL — équipes proches au classement
  if (Math.abs(posDiff) <= 3 && Math.abs(formDiff) <= 15) {
    bets.push({
      type: 'DOUBLE CHANCE',
      label: 'X2 (Nul ou EXT)',
      confidence: 62,
      reason: `Équipes proches au classement (${home.position}e vs ${away.position}e)`,
      emoji: '🤝',
      color: '#ffaa00',
    });
  }

  // FAVORI CLAIR — grande différence de classement
  if (posDiff >= 6) {
    bets.push({
      type: 'MONEYLINE',
      label: `Victoire DOM`,
      confidence: Math.min(80, 55 + posDiff * 2),
      reason: `${home.position}e vs ${away.position}e — ${posDiff} places d'écart`,
      emoji: '🏆',
      color: '#00ff88',
    });
  } else if (posDiff <= -6) {
    bets.push({
      type: 'MONEYLINE',
      label: `Victoire EXT`,
      confidence: Math.min(80, 55 + Math.abs(posDiff) * 2),
      reason: `${away.position}e vs ${home.position}e — EXT bien supérieur`,
      emoji: '🏆',
      color: '#00ff88',
    });
  }

  // OVER/UNDER
  if (projectedTotal >= 2.7) {
    bets.push({
      type: 'TOTAL',
      label: `OVER 2.5`,
      confidence: Math.min(75, 50 + (projectedTotal - 2.5) * 20),
      reason: `Moyenne buts projetée: ${projectedTotal} buts`,
      emoji: '⚽',
      color: '#00aaff',
    });
  } else if (projectedTotal <= 2.2) {
    bets.push({
      type: 'TOTAL',
      label: `UNDER 2.5`,
      confidence: Math.min(72, 50 + (2.5 - projectedTotal) * 20),
      reason: `Deux défenses solides — ${projectedTotal} buts projetés`,
      emoji: '🛡️',
      color: '#aa44ff',
    });
  }

  // BTTS (Les deux équipes marquent)
  if (home.avgGoalsFor >= 1.4 && away.avgGoalsFor >= 1.2) {
    bets.push({
      type: 'BTTS',
      label: 'Les deux marquent — OUI',
      confidence: 65,
      reason: `DOM marque ${home.avgGoalsFor}/match, EXT marque ${away.avgGoalsFor}/match`,
      emoji: '🎯',
      color: '#ff88aa',
    });
  }

  return bets;
};
