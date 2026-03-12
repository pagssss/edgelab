// ============================================
// EDGELAB - API Services
// ============================================

const ODDS_API_KEY = process.env.REACT_APP_ODDS_API_KEY;
const API_SPORTS_KEY = process.env.REACT_APP_API_SPORTS_KEY;
const RAPIDAPI_KEY = process.env.REACT_APP_RAPIDAPI_KEY;
const BALLDONTLIE_KEY = process.env.REACT_APP_BALLDONTLIE_KEY;

// ============================================
// THE ODDS API - Tous bookmakers EU, toutes ligues
// ============================================
export const fetchOdds = async (sport) => {
  const sportMap = {
    football: 'soccer_france_ligue_one',
    tennis: 'tennis_atp_us_open',
    basketball: 'basketball_nba',
  };
  const sportKey = sportMap[sport] || 'soccer_france_ligue_one';
  try {
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h&oddsFormat=decimal`
    );
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('Odds API error:', err);
    return [];
  }
};

export const fetchAllSportsOdds = async () => {
  // FOOTBALL : Top 5 ligues européennes
  // BASKET : NBA + Euroleague + Betclic Elite
  // TENNIS : Tous grands tournois ATP/WTA 250+
  // Uniquement les ligues disponibles sur le plan gratuit
  const sports = [
    { key: 'soccer_france_ligue_one', label: 'Ligue 1', sport: 'football' },
    { key: 'soccer_england_premier_league', label: 'Premier League', sport: 'football' },
    { key: 'soccer_spain_la_liga', label: 'La Liga', sport: 'football' },
    { key: 'soccer_italy_serie_a', label: 'Serie A', sport: 'football' },
    { key: 'soccer_germany_bundesliga', label: 'Bundesliga', sport: 'football' },
    { key: 'basketball_nba', label: 'NBA', sport: 'basketball' },
  ];

  const results = [];
  for (const s of sports) {
    try {
      const res = await fetch(
        `https://api.the-odds-api.com/v4/sports/${s.key}/odds/?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h&oddsFormat=decimal`
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        results.push(...data.map(m => ({ ...m, sportLabel: s.label, sportType: s.sport })));
      }
      // Petit délai entre chaque appel pour éviter le rate limit
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      // Ligue non disponible, on continue
    }
  }
  return results;
};

// ============================================
// API-SPORTS - Stats Football
// ============================================
export const fetchFootballFixtures = async (leagueId = 61, season = 2024) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const res = await fetch(
      `https://v3.football.api-sports.io/fixtures?date=${today}&league=${leagueId}&season=${season}`,
      { headers: { 'x-apisports-key': API_SPORTS_KEY } }
    );
    const data = await res.json();
    return data.response || [];
  } catch (err) {
    console.error('API-Sports error:', err);
    return [];
  }
};

export const fetchTeamForm = async (teamId, leagueId = 61, season = 2024) => {
  try {
    const res = await fetch(
      `https://v3.football.api-sports.io/fixtures?team=${teamId}&league=${leagueId}&season=${season}&last=5`,
      { headers: { 'x-apisports-key': API_SPORTS_KEY } }
    );
    const data = await res.json();
    return data.response || [];
  } catch (err) {
    return [];
  }
};

export const fetchInjuries = async (teamId, leagueId = 61, season = 2024) => {
  try {
    const res = await fetch(
      `https://v3.football.api-sports.io/injuries?team=${teamId}&league=${leagueId}&season=${season}`,
      { headers: { 'x-apisports-key': API_SPORTS_KEY } }
    );
    const data = await res.json();
    return data.response || [];
  } catch (err) {
    return [];
  }
};

// ============================================
// SOFASCORE (RapidAPI) - Tennis + Stats live
// ============================================
export const fetchTennisMatches = async () => {
  try {
    const res = await fetch(
      `https://sofascore6.p.rapidapi.com/api/sofascore/v1/match/live?sport_slug=tennis`,
      {
        headers: {
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': 'sofascore6.p.rapidapi.com',
        },
      }
    );
    const data = await res.json();
    return data?.data || [];
  } catch (err) {
    console.error('SofaScore tennis error:', err);
    return [];
  }
};

export const fetchSofaScoreMatches = async (sport = 'football') => {
  try {
    const res = await fetch(
      `https://sofascore6.p.rapidapi.com/api/sofascore/v1/match/live?sport_slug=${sport}`,
      {
        headers: {
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': 'sofascore6.p.rapidapi.com',
        },
      }
    );
    const data = await res.json();
    return data?.data || [];
  } catch (err) {
    return [];
  }
};

// ============================================
// BALLDONTLIE - Stats NBA
// ============================================
export const fetchNBAGames = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const res = await fetch(
      `https://api.balldontlie.io/v1/games?dates[]=${today}&per_page=20`,
      { headers: { Authorization: BALLDONTLIE_KEY } }
    );
    const data = await res.json();
    return data.data || [];
  } catch (err) {
    console.error('BallDontLie error:', err);
    return [];
  }
};

// ============================================
// CALCULS VALUE & KELLY
// ============================================

export const oddsToProb = (odds) => {
  if (!odds || odds <= 1) return 0;
  return 1 / odds;
};

export const calculateValue = (estimatedProb, bookmakerOdds) => {
  return (estimatedProb * bookmakerOdds) - 1;
};

export const calculateKellyStake = (estimatedProb, bookmakerOdds, bankroll) => {
  const b = bookmakerOdds - 1;
  const p = estimatedProb;
  const q = 1 - p;
  const kelly = (b * p - q) / b;
  const kellyFrac = kelly * 0.25;
  const stake = Math.max(0, kellyFrac * bankroll);
  return {
    kellyFull: kelly * 100,
    kellyFrac: kellyFrac * 100,
    stake: Math.round(stake * 100) / 100,
  };
};

export const estimateProbFromStats = (impliedProb, stats) => {
  let adjustment = 0;
  if (stats.formScore !== undefined) adjustment += (stats.formScore - 0.5) * 0.1;
  if (stats.xgAdvantage !== undefined) adjustment += stats.xgAdvantage * 0.05;
  if (stats.h2hScore !== undefined) adjustment += (stats.h2hScore - 0.5) * 0.06;
  if (stats.injuryImpact !== undefined) adjustment -= stats.injuryImpact * 0.05;
  if (stats.fatigue !== undefined) adjustment -= stats.fatigue * 0.03;
  return Math.min(0.95, Math.max(0.05, impliedProb + adjustment));
};

export const calculateGlobalScore = (value, confidence) => {
  const valueScore = Math.min(10, Math.max(0, value * 20 + 5));
  const confidenceScore = confidence * 10;
  return Math.round((valueScore * 0.6 + confidenceScore * 0.4) * 10) / 10;
};
