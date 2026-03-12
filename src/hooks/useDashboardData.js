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

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export const useDashboardData = (bankroll) => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const oddsData = await fetchAllSportsOdds();
      
      // Traitement de base pour tous les matchs (sans stats NBA)
      const baseMatches = oddsData.map(match => {
        const bookmaker = match.bookmakers?.[0];
        const h2hMarket = bookmaker?.markets?.find(m => m.key === 'h2h');
        const outcomes = h2hMarket?.outcomes || [];

        const homeOdds = outcomes.find(o => o.name === match.home_team)?.price || null;
        const awayOdds = outcomes.find(o => o.name === match.away_team)?.price || null;
        const drawOdds = outcomes.find(o => o.name === 'Draw')?.price || null;

        const homeImplied = oddsToProb(homeOdds);
        const awayImplied = oddsToProb(awayOdds);

        // Stats simulées pour le foot
        const formScore = Math.random() * 0.4 + 0.3;
        const xgAdv = (Math.random() - 0.5) * 2;
        const homeEstimated = Math.min(0.9, Math.max(0.1, homeImplied + xgAdv * 0.03));
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
          homeOdds, awayOdds, drawOdds,
          homeImplied: Math.round(homeImplied * 100),
          awayImplied: Math.round(awayImplied * 100),
          homeEstimated: Math.round(homeEstimated * 100),
          homeValue: Math.round(homeValue * 100) / 100,
          homeKelly, confidence: Math.round(confidence * 100) / 100,
          globalScore,
          nbaStats: null,
          bookmaker: bookmaker?.title || 'Bookmaker',
        };
      });

      // Afficher immédiatement les matchs de base
      setMatches(baseMatches.sort((a, b) => b.globalScore - a.globalScore));
      setLastUpdated(new Date());
      setLoading(false);

      // Charger les stats NBA en arrière-plan
      const nbaMatches = baseMatches.filter(m => m.sport === 'basketball');
      for (const match of nbaMatches) {
        await sleep(500);
        const nbaStats = await fetchNBAMatchStats(match.homeTeam, match.awayTeam, match.homeOdds, match.awayOdds);
        
        if (nbaStats?.available) {
          // Recalculer le score avec les vraies stats
          const adj = nbaStats.estimatedHomeProbAdj || 0;
          const homeEstimated = Math.min(0.9, Math.max(0.1, (match.homeImplied / 100) + adj));
          const homeValue = match.homeOdds ? calculateValue(homeEstimated, match.homeOdds) : 0;
          const homeKelly = match.homeOdds ? calculateKellyStake(homeEstimated, match.homeOdds, bankroll) : null;
          const globalScore = calculateGlobalScore(homeValue, nbaStats.confidence);

          setMatches(prev => prev.map(m => 
            m.id === match.id 
              ? { ...m, nbaStats, homeEstimated: Math.round(homeEstimated * 100), homeValue: Math.round(homeValue * 100) / 100, homeKelly, confidence: Math.round(nbaStats.confidence * 100) / 100, globalScore }
              : m
          ));
        }
      }

    } catch (err) {
      setError('Erreur de chargement. Vérifie ta connexion.');
      console.error(err);
      setLoading(false);
    }
  }, [bankroll]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadData]);

  return { matches, loading, error, lastUpdated, refresh: loadData };
};
