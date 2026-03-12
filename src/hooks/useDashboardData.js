/* eslint-disable */
import { useState, useEffect, useCallback } from 'react';
import {
  fetchAllSportsOdds,
  oddsToProb,
  calculateValue,
  calculateKellyStake,
  calculateGlobalScore,
} from '../utils/api';
import { fetchNBAMatchStats } from '../utils/nba';

export const useDashboardData = (bankroll) => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const processMatch = useCallback(async (match) => {
    const bookmaker = match.bookmakers?.[0];
    const h2hMarket = bookmaker?.markets?.find(m => m.key === 'h2h');
    const outcomes = h2hMarket?.outcomes || [];

    const homeOdds = outcomes.find(o => o.name === match.home_team)?.price || null;
    const awayOdds = outcomes.find(o => o.name === match.away_team)?.price || null;
    const drawOdds = outcomes.find(o => o.name === 'Draw')?.price || null;

    const homeImplied = oddsToProb(homeOdds);
    const awayImplied = oddsToProb(awayOdds);

    let nbaStats = null;
    let confidence = 0.5;
    let homeEstimated = homeImplied;
    let formScore = 0.5;

    // Brancher les vraies stats NBA
    if (match.sportType === 'basketball') {
      nbaStats = await fetchNBAMatchStats(match.home_team, match.away_team);
      if (nbaStats?.available) {
        formScore = nbaStats.homeTeam.form / 100;
        const fatigueAdj = (nbaStats.homeTeam.backToBack ? -0.05 : 0) - (nbaStats.awayTeam.backToBack ? -0.05 : 0);
        homeEstimated = Math.min(0.9, Math.max(0.1, homeImplied + nbaStats.formAdvantage * 0.15 + fatigueAdj));
        confidence = nbaStats.confidence;
      }
    } else {
      // Stats simulées pour foot (en attendant API-Sports)
      formScore = Math.random() * 0.4 + 0.3;
      const xgAdv = (Math.random() - 0.5) * 2;
      homeEstimated = Math.min(0.9, Math.max(0.1, homeImplied + xgAdv * 0.03));
      confidence = Math.min(0.8, Math.max(0.3, formScore * 0.6 + 0.2));
    }

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
      nbaStats,
      bookmaker: bookmaker?.title || 'Bookmaker',
    };
  }, [bankroll]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const oddsData = await fetchAllSportsOdds();

      // Traiter tous les matchs (NBA en parallèle par batch de 5)
      const processed = [];
      const batchSize = 5;
      for (let i = 0; i < oddsData.length; i += batchSize) {
        const batch = oddsData.slice(i, i + batchSize);
        const results = await Promise.all(batch.map(m => processMatch(m)));
        processed.push(...results);
      }

      const sorted = processed.sort((a, b) => b.globalScore - a.globalScore);
      setMatches(sorted);
      setLastUpdated(new Date());
    } catch (err) {
      setError('Erreur de chargement. Vérifie ta connexion.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [processMatch]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadData]);

  return { matches, loading, error, lastUpdated, refresh: loadData };
};
