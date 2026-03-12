/* eslint-disable */
const BALLDONTLIE_KEY = process.env.REACT_APP_BALLDONTLIE_KEY;
const headers = { Authorization: BALLDONTLIE_KEY };

// Cache global pour éviter les appels répétés
const cache = {};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const cachedFetch = async (url, retries = 3) => {
  if (cache[url]) return cache[url];
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, { headers });
    if (res.status === 429) {
      await sleep(1000 * (i + 1)); // attendre 1s, 2s, 3s
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    cache[url] = data;
    return data;
  }
  throw new Error('Rate limited');
};

// ============================================
// TEAMS
// ============================================
export const fetchNBATeams = async () => {
  try {
    const data = await cachedFetch('https://api.balldontlie.io/v1/teams?per_page=30');
    return data.data || [];
  } catch { return []; }
};

export const findTeamByName = (teams, name) => {
  if (!name) return null;
  const n = name.toLowerCase();
  return teams.find(t =>
    n.includes(t.name.toLowerCase()) ||
    n.includes(t.city.toLowerCase()) ||
    t.full_name.toLowerCase().includes(n)
  ) || null;
};

// ============================================
// BOX SCORES — 10 derniers matchs
// ============================================
const fetchTeamGames = async (teamId, season = 2024) => {
  try {
    const data = await cachedFetch(
      `https://api.balldontlie.io/v1/games?team_ids[]=${teamId}&seasons[]=${season}&per_page=5&sort=date&order=desc`
    );
    return data.data || [];
  } catch { return []; }
};

// ============================================
// CALCUL NET RATING & PACE depuis box scores
// ============================================
// Net Rating = (pts marqués - pts encaissés) / matchs joués * facteur100
// Pace approximatif = pts marqués + pts encaissés / 2 / 2.2 (estimation possessions)

const calcAdvancedStats = (games, teamId) => {
  if (!games || games.length === 0) return null;

  let totalPtsFor = 0;
  let totalPtsAgainst = 0;
  let totalPossessions = 0;
  let wins = 0;
  const form = [];

  games.forEach(g => {
    const isHome = g.home_team?.id === teamId;
    const ptsFor = isHome ? g.home_team_score : g.visitor_team_score;
    const ptsAgainst = isHome ? g.visitor_team_score : g.home_team_score;

    if (!ptsFor || !ptsAgainst) return;

    totalPtsFor += ptsFor;
    totalPtsAgainst += ptsAgainst;

    // Estimation possessions : (pts / 2.2) moyenne NBA
    const possEstimate = (ptsFor + ptsAgainst) / 2 / 2.2;
    totalPossessions += possEstimate;

    const won = ptsFor > ptsAgainst;
    if (won) wins++;
    form.push(won ? 'W' : 'L');
  });

  const n = games.length;
  const avgPtsFor = totalPtsFor / n;
  const avgPtsAgainst = totalPtsAgainst / n;
  const avgPoss = totalPossessions / n;

  // Net Rating pour 100 possessions
  const offRating = (avgPtsFor / avgPoss) * 100;
  const defRating = (avgPtsAgainst / avgPoss) * 100;
  const netRating = offRating - defRating;

  // Pace = possessions par match * 2 (aller-retour)
  const pace = avgPoss * 2;

  return {
    offRating: Math.round(offRating * 10) / 10,
    defRating: Math.round(defRating * 10) / 10,
    netRating: Math.round(netRating * 10) / 10,
    pace: Math.round(pace * 10) / 10,
    winRate: Math.round((wins / n) * 100),
    avgPtsFor: Math.round(avgPtsFor * 10) / 10,
    avgPtsAgainst: Math.round(avgPtsAgainst * 10) / 10,
    form: form,
    gamesAnalyzed: n,
  };
};

// Vérifie back-to-back
const checkBackToBack = (games) => {
  if (!games || games.length < 2) return false;
  const sorted = [...games].sort((a, b) => new Date(b.date) - new Date(a.date));
  const last = new Date(sorted[0].date);
  const prev = new Date(sorted[1].date);
  const diffDays = (last - prev) / (1000 * 60 * 60 * 24);
  return diffDays <= 1;
};

// ============================================
// GÉNÉRATION DES RECOMMANDATIONS DE PARIS
// ============================================
const generateBetRecommendations = (homeStats, awayStats, homeB2B, awayB2B, homeOdds, awayOdds) => {
  const bets = [];

  if (!homeStats || !awayStats) return bets;

  const netDiff = homeStats.netRating - awayStats.netRating;
  const avgPace = (homeStats.pace + awayStats.pace) / 2;
  const projectedTotal = (homeStats.avgPtsFor + awayStats.avgPtsFor);

  // --- MONEYLINE ---
  if (Math.abs(netDiff) >= 4) {
    const favTeam = netDiff > 0 ? 'DOM' : 'EXT';
    const favOdds = netDiff > 0 ? homeOdds : awayOdds;
    bets.push({
      type: 'MONEYLINE',
      label: `Victoire ${favTeam}`,
      odds: favOdds,
      confidence: Math.min(85, 55 + Math.abs(netDiff) * 2),
      reason: `Net Rating ${netDiff > 0 ? '+' : ''}${netDiff.toFixed(1)} pts/100 poss d'avantage`,
      emoji: '🏆',
      color: '#00ff88',
    });
  }

  // --- BACK-TO-BACK FADE ---
  if (homeB2B && !awayB2B && awayOdds) {
    bets.push({
      type: 'B2B FADE',
      label: 'Victoire EXT (B2B DOM)',
      odds: awayOdds,
      confidence: 65,
      reason: 'Équipe DOM en back-to-back → -3 à -5 pts attendus',
      emoji: '😴',
      color: '#ffaa00',
    });
  }
  if (awayB2B && !homeB2B && homeOdds) {
    bets.push({
      type: 'B2B FADE',
      label: 'Victoire DOM (B2B EXT)',
      odds: homeOdds,
      confidence: 65,
      reason: 'Équipe EXT en back-to-back → avantage DOM amplifié',
      emoji: '😴',
      color: '#ffaa00',
    });
  }

  // --- OVER/UNDER ---
  if (avgPace > 100) {
    bets.push({
      type: 'TOTAL',
      label: `OVER ${Math.round(projectedTotal - 5)}`,
      odds: null,
      confidence: Math.min(80, 50 + (avgPace - 98) * 3),
      reason: `Pace moyen ${avgPace.toFixed(0)} → match ouvert, ~${Math.round(projectedTotal)} pts projetés`,
      emoji: '📈',
      color: '#00aaff',
    });
  } else if (avgPace < 97) {
    bets.push({
      type: 'TOTAL',
      label: `UNDER ${Math.round(projectedTotal + 5)}`,
      odds: null,
      confidence: Math.min(75, 50 + (98 - avgPace) * 2),
      reason: `Pace lent ${avgPace.toFixed(0)} → match fermé, ~${Math.round(projectedTotal)} pts projetés`,
      emoji: '📉',
      color: '#aa44ff',
    });
  }

  // --- DÉFENSE DOMINANTE ---
  if (homeStats.defRating < 108 && awayStats.defRating < 108) {
    bets.push({
      type: 'TOTAL',
      label: `UNDER ${Math.round(projectedTotal + 3)}`,
      odds: null,
      confidence: 70,
      reason: `Deux défenses solides (${homeStats.defRating} / ${awayStats.defRating} Def Rtg)`,
      emoji: '🛡️',
      color: '#aa44ff',
    });
  }

  return bets;
};

// ============================================
// FONCTION PRINCIPALE
// ============================================
export const fetchNBAMatchStats = async (homeTeamName, awayTeamName, homeOdds, awayOdds) => {
  try {
    const teams = await fetchNBATeams();
    const homeTeam = findTeamByName(teams, homeTeamName);
    const awayTeam = findTeamByName(teams, awayTeamName);

    if (!homeTeam || !awayTeam) {
      console.log('NBA team not found:', homeTeamName, awayTeamName, 'teams:', teams.map(t => t.full_name).slice(0,5));
      return { available: false };
    }

    const [homeGames, awayGames] = await Promise.all([
      fetchTeamGames(homeTeam.id),
      fetchTeamGames(awayTeam.id),
    ]);

    const homeStats = calcAdvancedStats(homeGames, homeTeam.id);
    const awayStats = calcAdvancedStats(awayGames, awayTeam.id);
    const homeB2B = checkBackToBack(homeGames);
    const awayB2B = checkBackToBack(awayGames);

    if (!homeStats || !awayStats) {
      console.log('NBA stats null - homeGames:', homeGames.length, 'awayGames:', awayGames.length);
      return { available: false };
    }

    // Ajustement de la probabilité estimée basé sur le Net Rating
    const netDiff = homeStats.netRating - awayStats.netRating;
    const b2bAdj = (homeB2B ? -0.06 : 0) + (awayB2B ? 0.06 : 0);
    const formAdj = ((homeStats.winRate - awayStats.winRate) / 100) * 0.1;
    const homeAdvantage = 0.04; // avantage domicile NBA

    const estimatedHomeProbAdj = netDiff * 0.012 + b2bAdj + formAdj + homeAdvantage;

    const confidence = Math.min(0.88, Math.max(0.35,
      0.55 + Math.abs(netDiff) * 0.015 + Math.abs(b2bAdj) * 0.5
    ));

    const bets = generateBetRecommendations(homeStats, awayStats, homeB2B, awayB2B, homeOdds, awayOdds);

    return {
      available: true,
      homeTeam: { ...homeStats, backToBack: homeB2B, fullName: homeTeam.full_name },
      awayTeam: { ...awayStats, backToBack: awayB2B, fullName: awayTeam.full_name },
      netDiff: Math.round(netDiff * 10) / 10,
      projectedTotal: Math.round((homeStats.avgPtsFor + awayStats.avgPtsFor)),
      avgPace: Math.round((homeStats.pace + awayStats.pace) / 2 * 10) / 10,
      estimatedHomeProbAdj,
      confidence,
      bets,
    };
  } catch (err) {
    console.error('NBA stats error:', err);
    return { available: false };
  }
};
