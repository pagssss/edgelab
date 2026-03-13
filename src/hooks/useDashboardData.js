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
import { fetchFootballMatchStats } from '../utils/football';

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

        // Stats de base (seront enrichies pour le foot)
        const homeEstimated = homeImplied;
        const confidence = 0.5;
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
          footballStats: null,
          bookmaker: bookmaker?.title || 'Bookmaker',
        };
      });

      // Afficher immédiatement les matchs de base
      setMatches(baseMatches.sort((a, b) => b.globalScore - a.globalScore));
      setLastUpdated(new Date());
      setLoading(false);

      // Charger les stats FOOT en arrière-plan (1 req par ligue = max 5 req)
      const footballMatches2 = baseMatches.filter(m => m.sport === 'football');
      const leaguesDone = new Set();
      for (const match of footballMatches2) {
        if (leaguesDone.has(match.league)) continue; // déjà chargé pour cette ligue
        leaguesDone.add(match.league);
        await sleep(300);
      }
      // Maintenant enrichir chaque match foot avec les stats
      for (const match of footballMatches2) {
        await sleep(200);
        const footballStats = await fetchFootballMatchStats(match.homeTeam, match.awayTeam, match.league);
        if (footballStats?.available) {
          const adj = footballStats.totalAdj || 0;
          const homeEstimated = Math.min(0.9, Math.max(0.1, (match.homeImplied / 100) + adj));
          const homeValue = match.homeOdds ? calculateValue(homeEstimated, match.homeOdds) : 0;
          const homeKelly = match.homeOdds ? calculateKellyStake(homeEstimated, match.homeOdds, bankroll) : null;
          const globalScore = calculateGlobalScore(homeValue, footballStats.confidence);
          setMatches(prev => prev.map(m =>
            m.id === match.id
              ? { ...m, footballStats, homeEstimated: Math.round(homeEstimated * 100), homeValue: Math.round(homeValue * 100) / 100, homeKelly, confidence: Math.round(footballStats.confidence * 100) / 100, globalScore }
              : m
          ));
        }
      }

      // Charger les stats NBA en arrière-plan
      const nbaMatches = baseMatches.filter(m => m.sport === 'basketball');
      for (const match of nbaMatches) {
        await sleep(1000); // 1s entre chaque appel NBA
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
    // Refresh les cotes toutes les 5min MAIS les stats NBA sont cachées 1h dans nba.js
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadData]);

  return { matches, loading, error, lastUpdated, refresh: loadData };
};
