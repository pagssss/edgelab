/* eslint-disable */
import { useState, useEffect, useCallback } from 'react';
import {
  fetchAllSportsOdds,
  oddsToProb,
  calculateValue,
  calculateKellyStake,
  calculateGlobalScore,
} from '../utils/api';

export const useDashboardData = (bankroll) => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const processMatch = useCallback((match) => {
    const bookmaker = match.bookmakers?.[0];
    const h2hMarket = bookmaker?.markets?.find(m => m.key === 'h2h');
    const outcomes = h2hMarket?.outcomes || [];

    const homeOdds = outcomes.find(o => o.name === match.home_team)?.price || null;
    const awayOdds = outcomes.find(o => o.name === match.away_team)?.price || null;
    const drawOdds = outcomes.find(o => o.name === 'Draw')?.price || null;

    const homeImplied = oddsToProb(homeOdds);
    const awayImplied = oddsToProb(awayOdds);

    // Stats simulées pour le score initial (les vraies stats NBA chargent au clic)
    const formScore = Math.random() * 0.4 + 0.3;
    const xgAdv = (Math.random() - 0.5) * 2;
    const homeEstimated = Math.min(0.9, Math.max(0.1,
      homeImplied + (match.sportType === 'football' ? xgAdv * 0.03 : 0)
    ));
    const confidence = Math.min(0.8, Math.max(0.3, formScore * 0.6 + 0.2));

    const homeValue = homeOdds ? calculateValue(homeEstimated, homeOdds) : 0;
    const homeKelly = homeOdds ? calculateKellyStake(homeEstimated, homeOdds, bankroll) : null;
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
      nbaStats: null, // Chargé au clic
      bookmaker: bookmaker?.title || 'Bookmaker',
    };
  }, [bankroll]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const oddsData = await fetchAllSportsOdds();
      const processed = oddsData.map(m => processMatch(m))
        .sort((a, b) => b.globalScore - a.globalScore);
      setMatches(processed);
      setLastUpdated(new Date());
    } catch (err) {
      setError('Erreur de chargement. Vérifie ta connexion.');
    } finally {
      setLoading(false);
    }
  }, [processMatch]);

  // Met à jour les stats NBA d'un match spécifique après clic
  const updateMatchNBAStats = useCallback((matchId, nbaStats) => {
    setMatches(prev => prev.map(m =>
      m.id === matchId ? { ...m, nbaStats } : m
    ));
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadData]);

  return { matches, loading, error, lastUpdated, refresh: loadData, updateMatchNBAStats };
};
