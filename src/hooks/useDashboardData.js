/* eslint-disable */
import { useState, useEffect, useCallback } from 'react';
import {
  fetchAllSportsOdds,
  oddsToProb,
  calculateValue,
  calculateKellyStake,
  estimateProbFromStats,
  calculateGlobalScore,
} from '../utils/api'; // eslint-disable-line

export const useDashboardData = (bankroll) => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const processOddsData = useCallback((oddsData) => {
    return oddsData.map((match) => {
      const bookmaker = match.bookmakers?.[0];
      const h2hMarket = bookmaker?.markets?.find(m => m.key === 'h2h');
      const outcomes = h2hMarket?.outcomes || [];

      const homeOdds = outcomes.find(o => o.name === match.home_team)?.price || null;
      const awayOdds = outcomes.find(o => o.name === match.away_team)?.price || null;
      const drawOdds = outcomes.find(o => o.name === 'Draw')?.price || null;

      const homeImplied = oddsToProb(homeOdds);
      const awayImplied = oddsToProb(awayOdds);

      const mockStats = {
        formScore: Math.random() * 0.4 + 0.3,
        xgAdvantage: (Math.random() - 0.5) * 2,
        h2hScore: Math.random() * 0.4 + 0.3,
        injuryImpact: Math.random() * 0.3,
        fatigue: Math.random() * 0.2,
      };

      const homeEstimated = estimateProbFromStats(homeImplied, mockStats);
      const homeValue = homeOdds ? calculateValue(homeEstimated, homeOdds) : 0;
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
        bookmaker: bookmaker?.title || 'Bookmaker',
      };
    });
  }, [bankroll]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const oddsData = await fetchAllSportsOdds();
      const processedMatches = processOddsData(oddsData)
        .sort((a, b) => b.globalScore - a.globalScore);
      setMatches(processedMatches);
      setLastUpdated(new Date());
    } catch (err) {
      setError('Erreur de chargement. Vérifie ta connexion.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [processOddsData]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadData]);

  return { matches, loading, error, lastUpdated, refresh: loadData };
};
