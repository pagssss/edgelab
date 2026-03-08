import { useState, useEffect, useCallback } from 'react';
import {
  fetchAllSportsOdds,
  fetchNBAGames,
  fetchTennisMatches,
  fetchFootballFixtures,
  oddsToProb,
  calculateValue,
  calculateKellyStake,
  estimateProbFromStats,
  calculateGlobalScore,
} from '../utils/api';

export const useDashboardData = (bankroll) => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const processOddsData = useCallback((oddsData) => {
    return oddsData.map((match) => {
      const winamax = match.bookmakers?.find(b => b.key === 'winamax') || match.bookmakers?.[0];
      const h2hMarket = winamax?.markets?.find(m => m.key === 'h2h');
      const outcomes = h2hMarket?.outcomes || [];

      const homeOdds = outcomes.find(o => o.name === match.home_team)?.price || null;
      const awayOdds = outcomes.find(o => o.name === match.away_team)?.price || null;
      const drawOdds = outcomes.find(o => o.name === 'Draw')?.price || null;

      const homeImplied = oddsToProb(homeOdds);
      const awayImplied = oddsToProb(awayOdds);

      // Stats simulées jusqu'à ce que les appels API soient complets
      // Sera remplacé par des vraies stats dans la prochaine version
      const mockStats = {
        formScore: Math.random() * 0.4 + 0.3,
        xgAdvantage: (Math.random() - 0.5) * 2,
        h2hScore: Math.random() * 0.4 + 0.3,
        injuryImpact: Math.random() * 0.3,
        fatigue: Math.random() * 0.2,
      };

      const homeEstimated = estimateProbFromStats(homeImplied, mockStats);
      const homeValue = calculateValue(homeEstimated, homeOdds);
      const homeKelly = homeOdds ? calculateKellyStake(homeEstimated, homeOdds, bankroll) : null;

      const confidence = Math.min(1, Math.max(0,
        mockStats.formScore * 0.35 +
        (1 - mockStats.injuryImpact) * 0.25 +
        mockStats.h2hScore * 0.25 +
        (1 - mockStats.fatigue) * 0.15
      ));

      const globalScore = calculateGlobalScore(homeValue, confidence);

      return {
        id: match.id,
        sport: match.sportType || 'football',
        league: match.sportLabel || 'Football',
        homeTeam: match.home_team,
        awayTeam: match.away_team,
        commenceTime: match.commence_time,
        homeOdds,
        awayOdds,
        drawOdds,
        homeImplied: Math.round(homeImplied * 100),
        awayImplied: Math.round(awayImplied * 100),
        homeEstimated: Math.round(homeEstimated * 100),
        homeValue: Math.round(homeValue * 100) / 100,
        homeKelly,
        confidence: Math.round(confidence * 100) / 100,
        globalScore,
        stats: mockStats,
        bestBet: homeValue > 0.05 ? 'home' : awayImplied > homeImplied ? 'away' : null,
      };
    });
  }, [bankroll]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [oddsData, nbaGames] = await Promise.all([
        fetchAllSportsOdds(),
        fetchNBAGames(),
      ]);

      const processedMatches = processOddsData(oddsData);

      // Ajoute les matchs NBA si pas déjà dans les odds
      const nbaMatches = nbaGames.map(game => ({
        id: `nba-${game.id}`,
        sport: 'basketball',
        league: 'NBA',
        homeTeam: game.home_team?.full_name || 'Home',
        awayTeam: game.visitor_team?.full_name || 'Away',
        commenceTime: game.date,
        homeOdds: null,
        awayOdds: null,
        drawOdds: null,
        homeImplied: 50,
        awayImplied: 50,
        homeEstimated: 50,
        homeValue: 0,
        homeKelly: null,
        confidence: 0.5,
        globalScore: 5,
        stats: {},
        bestBet: null,
        status: game.status,
        score: game.home_team_score ? `${game.home_team_score} - ${game.visitor_team_score}` : null,
      }));

      const allMatches = [...processedMatches, ...nbaMatches]
        .sort((a, b) => b.globalScore - a.globalScore);

      setMatches(allMatches);
      setLastUpdated(new Date());
    } catch (err) {
      setError('Erreur de chargement des données. Vérifie tes clés API.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [processOddsData]);

  useEffect(() => {
    loadData();
    // Refresh toutes les 5 minutes
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadData]);

  return { matches, loading, error, lastUpdated, refresh: loadData };
};
