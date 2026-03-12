/* eslint-disable */

const STORAGE_KEY = 'edgelab_journal';

// ============================================
// LECTURE / ÉCRITURE localStorage
// ============================================
export const loadBets = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
};

export const saveBets = (bets) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bets));
  } catch (e) {
    console.error('Erreur sauvegarde:', e);
  }
};

export const addBet = (bet) => {
  const bets = loadBets();
  const newBet = {
    id: Date.now(),
    date: new Date().toISOString(),
    ...bet,
    status: 'pending', // pending | won | lost
  };
  saveBets([newBet, ...bets]);
  return newBet;
};

export const updateBetStatus = (id, status) => {
  const bets = loadBets();
  const updated = bets.map(b => b.id === id ? { ...b, status } : b);
  saveBets(updated);
  return updated;
};

export const deleteBet = (id) => {
  const bets = loadBets();
  const updated = bets.filter(b => b.id !== id);
  saveBets(updated);
  return updated;
};

// ============================================
// STATISTIQUES
// ============================================
export const calcStats = (bets) => {
  const finished = bets.filter(b => b.status !== 'pending');
  const won = bets.filter(b => b.status === 'won');
  const lost = bets.filter(b => b.status === 'lost');
  const pending = bets.filter(b => b.status === 'pending');

  const totalMise = finished.reduce((s, b) => s + (b.mise || 0), 0);
  const totalGain = won.reduce((s, b) => s + ((b.mise || 0) * (b.cote || 1) - (b.mise || 0)), 0);
  const totalPerte = lost.reduce((s, b) => s + (b.mise || 0), 0);
  const profit = totalGain - totalPerte;
  const roi = totalMise > 0 ? (profit / totalMise) * 100 : 0;
  const winRate = finished.length > 0 ? (won.length / finished.length) * 100 : 0;

  return {
    total: bets.length,
    won: won.length,
    lost: lost.length,
    pending: pending.length,
    totalMise: Math.round(totalMise * 100) / 100,
    profit: Math.round(profit * 100) / 100,
    roi: Math.round(roi * 10) / 10,
    winRate: Math.round(winRate * 10) / 10,
  };
};
