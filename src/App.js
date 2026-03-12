/* eslint-disable */
import { useState, useMemo, useEffect } from "react";
import { loadBets, addBet, updateBetStatus, deleteBet, calcStats } from "./utils/journal";
import { useDashboardData } from "./hooks/useDashboardData";
import { calculateKellyStake, calculateValue } from "./utils/api";

// ============================================
// COMPOSANTS UI
// ============================================

function GlowText({ children, color = "#00ff88" }) {
  return (
    <span style={{ color, textShadow: `0 0 10px ${color}60, 0 0 20px ${color}30` }}>
      {children}
    </span>
  );
}

function ScoreMeter({ score, size = "normal" }) {
  const color = score >= 7 ? "#00ff88" : score >= 5 ? "#ffaa00" : "#ff4466";
  const fontSize = size === "large" ? "28px" : "18px";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "9px", color: "#555", fontFamily: "monospace", letterSpacing: "1px" }}>
          SCORE GLOBAL
        </span>
        <GlowText color={color}>
          <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize }}>{score}/10</span>
        </GlowText>
      </div>
      <div style={{ height: "3px", background: "#0a0a1a", borderRadius: "2px", overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${score * 10}%`,
          background: `linear-gradient(90deg, ${color}66, ${color})`,
          boxShadow: `0 0 6px ${color}`,
          borderRadius: "2px", transition: "width 1.2s ease"
        }} />
      </div>
    </div>
  );
}

function ValueBadge({ value }) {
  if (value > 0.1) return (
    <span style={{ fontSize: "10px", fontFamily: "monospace", fontWeight: 700, color: "#00ff88", border: "1px solid #00ff8844", padding: "2px 8px", borderRadius: "3px", letterSpacing: "1px" }}>
      🔥 VALUE +{Math.round(value * 100)}%
    </span>
  );
  if (value > 0) return (
    <span style={{ fontSize: "10px", fontFamily: "monospace", fontWeight: 700, color: "#ffaa00", border: "1px solid #ffaa0044", padding: "2px 8px", borderRadius: "3px", letterSpacing: "1px" }}>
      ⚡ VALUE +{Math.round(value * 100)}%
    </span>
  );
  return (
    <span style={{ fontSize: "10px", fontFamily: "monospace", color: "#444", border: "1px solid #222", padding: "2px 8px", borderRadius: "3px", letterSpacing: "1px" }}>
      ⚠️ PAS DE VALUE
    </span>
  );
}

function SportIcon({ sport }) {
  const icons = { football: "⚽", tennis: "🎾", basketball: "🏀" };
  return <span>{icons[sport] || "🏆"}</span>;
}

function MatchCard({ match, bankroll }) {
  const [expanded, setExpanded] = useState(false);
  const matchDate = match.commenceTime ? new Date(match.commenceTime) : null;
  const dateStr = matchDate ? matchDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '--';
  const timeStr = matchDate ? matchDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '--:--';
  const scoreColor = match.globalScore >= 7 ? "#00ff88" : match.globalScore >= 5 ? "#ffaa00" : "#ff4466";

  return (
    <div style={{
      background: "linear-gradient(135deg, #0d0d20 0%, #080816 100%)",
      border: `1px solid ${scoreColor}18`,
      borderLeft: `3px solid ${scoreColor}`,
      borderRadius: "10px", padding: "16px", marginBottom: "10px",
      cursor: "pointer", transition: "all 0.2s",
    }}
      onClick={() => setExpanded(!expanded)}
      onMouseEnter={e => e.currentTarget.style.background = "linear-gradient(135deg, #111128 0%, #0c0c1e 100%)"}
      onMouseLeave={e => e.currentTarget.style.background = "linear-gradient(135deg, #0d0d20 0%, #080816 100%)"}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <SportIcon sport={match.sport} />
            <span style={{ fontSize: "10px", color: "#555", fontFamily: "monospace", letterSpacing: "2px" }}>
              {match.league} · {dateStr} {timeStr}
            </span>
          </div>
          <div style={{ fontFamily: "'Bebas Neue', monospace", fontSize: "20px", letterSpacing: "1px" }}>
            <GlowText color="#e0e0e0">{match.homeTeam}</GlowText>
            <span style={{ color: "#333", margin: "0 8px", fontSize: "14px" }}>VS</span>
            <GlowText color="#e0e0e0">{match.awayTeam}</GlowText>
          </div>
          {match.score && (
            <div style={{ fontFamily: "monospace", fontSize: "14px", color: "#00ff88", marginTop: "4px" }}>
              {match.score}
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
          <ValueBadge value={match.homeValue} />
          <span style={{ fontSize: "10px", color: "#444" }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Cotes */}
      {(match.homeOdds || match.awayOdds) && (
        <div style={{ display: "grid", gridTemplateColumns: match.drawOdds ? "1fr 1fr 1fr" : "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
          {[
            { label: "DOM", odds: match.homeOdds, prob: match.homeEstimated, color: "#00ff88" },
            ...(match.drawOdds ? [{ label: "NUL", odds: match.drawOdds, prob: null, color: "#ffaa00" }] : []),
            { label: "EXT", odds: match.awayOdds, prob: match.awayImplied, color: "#ff4466" },
          ].map((item, i) => item.odds && (
            <div key={i} style={{ background: "#060613", borderRadius: "8px", padding: "10px", textAlign: "center", border: "1px solid #1a1a2e" }}>
              <div style={{ fontSize: "9px", color: "#555", fontFamily: "monospace", marginBottom: "2px" }}>{item.label}</div>
              <div style={{ fontFamily: "monospace", fontSize: "22px", fontWeight: 700, color: item.color }}>{item.odds}</div>
              {item.prob && <div style={{ fontSize: "9px", color: "#444", fontFamily: "monospace" }}>{item.prob}% impl.</div>}
            </div>
          ))}
        </div>
      )}

      {/* Score */}
      <ScoreMeter score={match.globalScore} />

      {/* Détails expandés */}
      {expanded && (
        <div style={{ marginTop: "14px", borderTop: "1px solid #1a1a2e", paddingTop: "14px", animation: "slideIn 0.2s ease" }}>

          {/* Analyse */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
            {[
              { label: "PROBA WINAMAX", value: `${match.homeImplied}%`, color: "#888" },
              { label: "PROBA ESTIMÉE", value: `${match.homeEstimated}%`, color: "#00ff88" },
              { label: "CONFIANCE", value: `${Math.round(match.confidence * 100)}%`, color: "#ffaa00" },
              { label: "VALUE", value: match.homeValue > 0 ? `+${Math.round(match.homeValue * 100)}%` : `${Math.round(match.homeValue * 100)}%`, color: match.homeValue > 0 ? "#00ff88" : "#ff4466" },
            ].map((item, i) => (
              <div key={i} style={{ background: "#060613", borderRadius: "6px", padding: "8px 12px", border: "1px solid #1a1a2e" }}>
                <div style={{ fontSize: "9px", color: "#444", fontFamily: "monospace", marginBottom: "2px" }}>{item.label}</div>
                <div style={{ fontFamily: "monospace", fontSize: "16px", fontWeight: 700, color: item.color }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* Recommandation de mise */}
          {match.homeKelly && match.homeValue > 0 && (
            <div style={{ background: "#00ff8808", border: "1px solid #00ff8820", borderRadius: "8px", padding: "12px" }}>
              <div style={{ fontSize: "10px", color: "#00ff88", fontFamily: "monospace", fontWeight: 700, marginBottom: "6px", letterSpacing: "1px" }}>
                → BET RECOMMANDÉ
              </div>
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                <div>
                  <span style={{ fontSize: "10px", color: "#555", fontFamily: "monospace" }}>ÉQUIPE </span>
                  <span style={{ fontFamily: "monospace", fontSize: "13px", color: "#e0e0e0" }}>{match.homeTeam}</span>
                </div>
                <div>
                  <span style={{ fontSize: "10px", color: "#555", fontFamily: "monospace" }}>COTE </span>
                  <GlowText color="#ffaa00"><span style={{ fontFamily: "monospace", fontSize: "13px" }}>{match.homeOdds}</span></GlowText>
                </div>
                <div>
                  <span style={{ fontSize: "10px", color: "#555", fontFamily: "monospace" }}>MISE </span>
                  <GlowText color="#00ff88"><span style={{ fontFamily: "monospace", fontSize: "13px", fontWeight: 700 }}>{match.homeKelly.stake}€</span></GlowText>
                </div>
                <div>
                  <span style={{ fontSize: "10px", color: "#555", fontFamily: "monospace" }}>KELLY FRAC </span>
                  <span style={{ fontFamily: "monospace", fontSize: "13px", color: "#888" }}>{match.homeKelly.kellyFrac.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Stats NBA réelles */}
          {match.nbaStats?.available && (
            <div style={{ marginTop: "10px" }}>

              {/* Stats avancées */}
              <div style={{ background: "#00aaff08", border: "1px solid #00aaff20", borderRadius: "8px", padding: "12px", marginBottom: "8px" }}>
                <div style={{ fontSize: "10px", color: "#00aaff", fontFamily: "monospace", fontWeight: 700, marginBottom: "10px", letterSpacing: "1px" }}>
                  🏀 STATS AVANCÉES NBA (/{match.nbaStats.homeTeam.gamesAnalyzed} matchs)
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "10px" }}>
                  {[
                    { label: "🏠 " + match.nbaStats.homeTeam.fullName, stats: match.nbaStats.homeTeam },
                    { label: "✈️ " + match.nbaStats.awayTeam.fullName, stats: match.nbaStats.awayTeam },
                  ].map((item, i) => (
                    <div key={i} style={{ background: "#060613", borderRadius: "6px", padding: "10px", border: "1px solid #1a1a2e" }}>
                      <div style={{ fontSize: "9px", color: "#555", fontFamily: "monospace", marginBottom: "6px" }}>{item.label}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", marginBottom: "6px" }}>
                        {[
                          { l: "OFF RTG", v: item.stats.offRating, c: item.stats.offRating >= 112 ? "#00ff88" : item.stats.offRating >= 108 ? "#ffaa00" : "#ff4466" },
                          { l: "DEF RTG", v: item.stats.defRating, c: item.stats.defRating <= 108 ? "#00ff88" : item.stats.defRating <= 113 ? "#ffaa00" : "#ff4466" },
                          { l: "NET RTG", v: (item.stats.netRating > 0 ? "+" : "") + item.stats.netRating, c: item.stats.netRating >= 3 ? "#00ff88" : item.stats.netRating >= -2 ? "#ffaa00" : "#ff4466" },
                          { l: "PACE", v: item.stats.pace, c: "#888" },
                        ].map((s, j) => (
                          <div key={j}>
                            <div style={{ fontSize: "8px", color: "#444", fontFamily: "monospace" }}>{s.l}</div>
                            <div style={{ fontSize: "13px", fontFamily: "monospace", fontWeight: 700, color: s.c }}>{s.v}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize: "11px", fontFamily: "monospace", marginBottom: "4px" }}>
                        {item.stats.form?.map((r, j) => (
                          <span key={j} style={{ color: r === "W" ? "#00ff88" : "#ff4466", marginRight: "3px", fontWeight: 700 }}>{r}</span>
                        ))}
                        <span style={{ fontSize: "9px", color: "#444", marginLeft: "4px" }}>{item.stats.winRate}% wins</span>
                      </div>
                      {item.stats.backToBack && (
                        <div style={{ fontSize: "9px", color: "#ff4466", fontFamily: "monospace", background: "#ff446610", padding: "2px 6px", borderRadius: "3px", display: "inline-block" }}>
                          ⚠️ BACK-TO-BACK
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Résumé */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
                  {[
                    { l: "ÉCART NET RTG", v: (match.nbaStats.netDiff > 0 ? "+" : "") + match.nbaStats.netDiff, c: Math.abs(match.nbaStats.netDiff) >= 4 ? "#00ff88" : "#ffaa00" },
                    { l: "TOTAL PROJETÉ", v: match.nbaStats.projectedTotal + " pts", c: "#00aaff" },
                    { l: "PACE MOYEN", v: match.nbaStats.avgPace, c: "#888" },
                  ].map((item, i) => (
                    <div key={i} style={{ background: "#060613", borderRadius: "6px", padding: "8px", textAlign: "center", border: "1px solid #1a1a2e" }}>
                      <div style={{ fontSize: "8px", color: "#444", fontFamily: "monospace", marginBottom: "2px" }}>{item.l}</div>
                      <div style={{ fontSize: "14px", fontFamily: "monospace", fontWeight: 700, color: item.c }}>{item.v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommandations de paris */}
              {match.nbaStats.bets?.length > 0 && (
                <div style={{ background: "#00ff8806", border: "1px solid #00ff8818", borderRadius: "8px", padding: "12px" }}>
                  <div style={{ fontSize: "10px", color: "#00ff88", fontFamily: "monospace", fontWeight: 700, marginBottom: "8px", letterSpacing: "1px" }}>
                    🎯 PARIS RECOMMANDÉS
                  </div>
                  {match.nbaStats.bets.map((bet, i) => (
                    <div key={i} style={{ background: "#060613", borderRadius: "6px", padding: "10px", border: "1px solid #1a1a2e", marginBottom: "6px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "14px" }}>{bet.emoji}</span>
                          <span style={{ fontFamily: "monospace", fontSize: "12px", fontWeight: 700, color: bet.color }}>{bet.label}</span>
                          {bet.odds && <span style={{ fontFamily: "monospace", fontSize: "11px", color: "#ffaa00" }}>@ {bet.odds}</span>}
                        </div>
                        <div style={{ background: bet.color + "20", border: "1px solid " + bet.color + "40", borderRadius: "4px", padding: "2px 8px", fontFamily: "monospace", fontSize: "10px", color: bet.color }}>
                          {bet.confidence}% confiance
                        </div>
                      </div>
                      <div style={{ fontSize: "10px", color: "#555", fontFamily: "monospace" }}>{bet.reason}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {match.homeValue <= 0 && (
            <div style={{ background: "#ff446608", border: "1px solid #ff446620", borderRadius: "8px", padding: "10px", fontFamily: "monospace", fontSize: "11px", color: "#ff4466" }}>
              ⛔ Pas de value détectée — ne pas parier sur ce match
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KellyCalculator({ bankroll }) {
  const [prob, setProb] = useState(55);
  const [odds, setOdds] = useState(2.0);

  const p = prob / 100;
  const kelly = calculateKellyStake(p, odds, bankroll);
  const value = calculateValue(p, odds);

  return (
    <div style={{ background: "#0a0a1a", borderRadius: "12px", padding: "20px", border: "1px solid #1e1e3f" }}>
      <div style={{ fontFamily: "monospace", fontSize: "12px", color: "#666", letterSpacing: "2px", marginBottom: "16px", fontWeight: 700 }}>
        ⚙️ CALCULATEUR KELLY
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
        <div>
          <label style={{ fontSize: "10px", color: "#555", fontFamily: "monospace", display: "block", marginBottom: "6px" }}>
            MA PROBA ESTIMÉE
          </label>
          <input type="range" min="25" max="90" value={prob}
            onChange={e => setProb(Number(e.target.value))}
            style={{ width: "100%", accentColor: "#00ff88", marginBottom: "4px" }} />
          <GlowText color="#00ff88"><span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "20px" }}>{prob}%</span></GlowText>
        </div>
        <div>
          <label style={{ fontSize: "10px", color: "#555", fontFamily: "monospace", display: "block", marginBottom: "6px" }}>
            COTE WINAMAX
          </label>
          <input type="range" min="1.1" max="6" step="0.05" value={odds}
            onChange={e => setOdds(Number(e.target.value))}
            style={{ width: "100%", accentColor: "#ffaa00", marginBottom: "4px" }} />
          <GlowText color="#ffaa00"><span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "20px" }}>{odds.toFixed(2)}</span></GlowText>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
        {[
          { label: "VALUE", value: value > 0 ? `+${(value * 100).toFixed(1)}%` : `${(value * 100).toFixed(1)}%`, color: value > 0 ? "#00ff88" : "#ff4466" },
          { label: "KELLY FRAC", value: `${kelly.kellyFrac.toFixed(1)}%`, color: "#ffaa00" },
          { label: "MISE", value: `${kelly.stake}€`, color: "#00aaff" },
        ].map((item, i) => (
          <div key={i} style={{ background: "#060613", borderRadius: "8px", padding: "12px", textAlign: "center", border: "1px solid #1e1e3f" }}>
            <div style={{ fontSize: "9px", color: "#555", fontFamily: "monospace", marginBottom: "4px" }}>{item.label}</div>
            <div style={{ fontFamily: "monospace", fontSize: "16px", fontWeight: 700, color: item.color }}>{item.value}</div>
          </div>
        ))}
      </div>
      {value <= 0 && (
        <div style={{ marginTop: "10px", background: "#ff446610", border: "1px solid #ff446622", borderRadius: "6px", padding: "8px 12px", fontFamily: "monospace", fontSize: "11px", color: "#ff4466" }}>
          ⛔ Pas de value — ne pas parier
        </div>
      )}
    </div>
  );
}

function BankrollManager({ bankroll, setBankroll }) {

  const stopLoss = bankroll * 0.7;
  const target = bankroll * 1.2;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ background: "#0a0a1a", borderRadius: "12px", padding: "20px", border: "1px solid #1e1e3f" }}>
        <div style={{ fontFamily: "monospace", fontSize: "12px", color: "#666", letterSpacing: "2px", marginBottom: "16px", fontWeight: 700 }}>
          💰 MA BANKROLL
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
          <input
            type="number"
            value={bankroll}
            onChange={e => setBankroll(Number(e.target.value))}
            style={{
              background: "#060613", border: "1px solid #1e1e3f", color: "#00ff88",
              fontFamily: "monospace", fontSize: "28px", fontWeight: 700,
              width: "150px", padding: "8px 12px", borderRadius: "8px", textAlign: "right"
            }}
          />
          <span style={{ color: "#00ff88", fontSize: "28px", fontWeight: 700, fontFamily: "monospace" }}>€</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          {[
            { label: "STOP LOSS (-30%)", value: `${Math.round(stopLoss)}€`, color: "#ff4466" },
            { label: "OBJECTIF (+20%)", value: `${Math.round(target)}€`, color: "#00ff88" },
            { label: "MISE MAX (5%)", value: `${Math.round(bankroll * 0.05)}€`, color: "#ffaa00" },
            { label: "MISE STANDARD (2%)", value: `${Math.round(bankroll * 0.02)}€`, color: "#00aaff" },
          ].map((item, i) => (
            <div key={i} style={{ background: "#060613", borderRadius: "8px", padding: "10px", border: "1px solid #1e1e3f" }}>
              <div style={{ fontSize: "9px", color: "#555", fontFamily: "monospace", marginBottom: "4px" }}>{item.label}</div>
              <div style={{ fontFamily: "monospace", fontSize: "16px", fontWeight: 700, color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: "#0a0a1a", borderRadius: "12px", padding: "20px", border: "1px solid #1e1e3f" }}>
        <div style={{ fontFamily: "monospace", fontSize: "12px", color: "#666", letterSpacing: "2px", marginBottom: "16px", fontWeight: 700 }}>
          📋 RÈGLES D'OR
        </div>
        {[
          ["⛔", "Ne jamais dépasser 5% de bankroll par pari", "#ff4466"],
          ["✅", "Parier uniquement si value > 0", "#00ff88"],
          ["⚡", "Max 3 paris simultanés", "#ffaa00"],
          ["📊", "Tenir un journal de chaque pari", "#00aaff"],
          ["🔄", "Retirer 50% si bankroll × 2", "#aa44ff"],
          ["🛑", "Stop si bankroll -30% sur le mois", "#ff4466"],
        ].map(([icon, rule, color], i) => (
          <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start", marginBottom: "10px" }}>
            <span style={{ fontSize: "14px" }}>{icon}</span>
            <span style={{ fontFamily: "monospace", fontSize: "11px", color, lineHeight: "1.5" }}>{rule}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// APP PRINCIPALE
// ============================================
export default function App() {
  const [bankroll, setBankroll] = useState(300);
  const [activeSport, setActiveSport] = useState("all");
  const [activeTab, setActiveTab] = useState("matches");

  const { matches, loading, error, lastUpdated, refresh } = useDashboardData(bankroll);
  const [bets, setBets] = useState([]);
  const [showAddBet, setShowAddBet] = useState(false);
  const [newBet, setNewBet] = useState({ match: "", equipe: "", cote: "", mise: "", type: "Moneyline" });

  useEffect(() => { setBets(loadBets()); }, []);

  const handleAddBet = () => {
    if (!newBet.match || !newBet.equipe || !newBet.cote || !newBet.mise) return;
    const bet = addBet({ ...newBet, cote: parseFloat(newBet.cote), mise: parseFloat(newBet.mise) });
    setBets(prev => [bet, ...prev]);
    setNewBet({ match: "", equipe: "", cote: "", mise: "", type: "Moneyline" });
    setShowAddBet(false);
  };

  const handleStatus = (id, status) => {
    const updated = updateBetStatus(id, status);
    setBets(updated);
  };

  const handleDelete = (id) => {
    const updated = deleteBet(id);
    setBets(updated);
  };

  const stats = calcStats(bets);

  const filteredMatches = useMemo(() => {
    if (activeSport === "all") return matches;
    return matches.filter(m => m.sport === activeSport);
  }, [matches, activeSport]);

  const bestBets = useMemo(() =>
    filteredMatches.filter(m => m.globalScore >= 7).slice(0, 3),
    [filteredMatches]
  );

  const sports = [
    { key: "all", label: "TOUS" },
    { key: "football", label: "⚽ FOOT" },
    { key: "tennis", label: "🎾 TENNIS" },
    { key: "basketball", label: "🏀 BASKET" },
  ];

  const tabs = ["matches", "kelly", "bankroll", "journal"];

  return (
    <div style={{ minHeight: "100vh", background: "#060613", color: "#e0e0e0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Share+Tech+Mono&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #060613; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: #060613; }
        ::-webkit-scrollbar-thumb { background: #1e1e3f; border-radius: 2px; }
        @keyframes slideIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        input[type=range] { height: 3px; }
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
      `}</style>

      {/* HEADER */}
      <div style={{
        borderBottom: "1px solid #1a1a2e", padding: "14px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "#080814", position: "sticky", top: 0, zIndex: 100,
      }}>
        <div>
          <h1 style={{ fontFamily: "'Bebas Neue', monospace", fontSize: "26px", letterSpacing: "4px" }}>
            EDGE<GlowText color="#00ff88">LAB</GlowText>
          </h1>
          <div style={{ fontSize: "9px", color: "#333", letterSpacing: "3px", fontFamily: "monospace" }}>
            SPORTS BETTING INTELLIGENCE
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {lastUpdated && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "9px", color: "#333", fontFamily: "monospace" }}>DERNIÈRE MAJ</div>
              <div style={{ fontSize: "11px", color: "#555", fontFamily: "monospace" }}>
                {lastUpdated.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          )}
          <button onClick={refresh} disabled={loading} style={{
            background: "transparent", border: "1px solid #1e1e3f", color: loading ? "#333" : "#666",
            fontFamily: "monospace", fontSize: "11px", padding: "6px 12px", borderRadius: "6px",
            cursor: loading ? "not-allowed" : "pointer", letterSpacing: "1px",
          }}>
            {loading ? "..." : "↻ REFRESH"}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{
              width: "7px", height: "7px", borderRadius: "50%",
              background: loading ? "#ffaa00" : "#00ff88",
              animation: "pulse 2s infinite",
              boxShadow: `0 0 6px ${loading ? "#ffaa00" : "#00ff88"}`
            }} />
            <span style={{ fontSize: "9px", color: loading ? "#ffaa00" : "#00ff88", fontFamily: "monospace", letterSpacing: "1px" }}>
              {loading ? "CHARGEMENT" : "LIVE"}
            </span>
          </div>
        </div>
      </div>

      {/* SPORT SELECTOR */}
      <div style={{ padding: "12px 20px", borderBottom: "1px solid #0d0d1e", display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {sports.map(s => (
          <button key={s.key} onClick={() => setActiveSport(s.key)} style={{
            fontFamily: "monospace", fontSize: "11px", fontWeight: 700,
            padding: "7px 16px", borderRadius: "6px", cursor: "pointer",
            letterSpacing: "1px", transition: "all 0.15s",
            background: activeSport === s.key ? "#00ff8812" : "transparent",
            color: activeSport === s.key ? "#00ff88" : "#444",
            border: activeSport === s.key ? "1px solid #00ff8830" : "1px solid #1a1a2e",
          }}>{s.label}</button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
          {tabs.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              fontFamily: "monospace", fontSize: "11px", fontWeight: 700,
              padding: "7px 14px", borderRadius: "6px", cursor: "pointer",
              letterSpacing: "1px", textTransform: "uppercase", transition: "all 0.15s",
              background: activeTab === tab ? "#ffffff08" : "transparent",
              color: activeTab === tab ? "#e0e0e0" : "#444",
              border: activeTab === tab ? "1px solid #2a2a3e" : "1px solid transparent",
            }}>{tab}</button>
          ))}
        </div>
      </div>

      {/* BEST BETS BANNER */}
      {bestBets.length > 0 && activeTab === "matches" && (
        <div style={{ padding: "12px 20px", borderBottom: "1px solid #0d0d1e" }}>
          <div style={{ fontSize: "9px", color: "#333", fontFamily: "monospace", letterSpacing: "2px", marginBottom: "8px" }}>
            🔥 MEILLEURS BETS DU MOMENT
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {bestBets.map((m, i) => (
              <div key={i} style={{
                background: "#00ff8808", border: "1px solid #00ff8820",
                borderRadius: "8px", padding: "8px 12px",
                fontFamily: "monospace", fontSize: "11px",
              }}>
                <GlowText color="#00ff88">{m.homeTeam}</GlowText>
                <span style={{ color: "#444", margin: "0 6px" }}>vs</span>
                <span style={{ color: "#888" }}>{m.awayTeam}</span>
                <span style={{ color: "#555", margin: "0 6px" }}>·</span>
                <GlowText color="#ffaa00">{m.homeOdds}</GlowText>
                <span style={{ color: "#555", margin: "0 6px" }}>·</span>
                <GlowText color="#00ff88">{m.globalScore}/10</GlowText>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CONTENU PRINCIPAL */}
      <div style={{ padding: "16px 20px", maxWidth: "900px", margin: "0 auto" }}>

        {error && (
          <div style={{ background: "#ff446610", border: "1px solid #ff446630", borderRadius: "8px", padding: "12px 16px", fontFamily: "monospace", fontSize: "12px", color: "#ff4466", marginBottom: "16px" }}>
            ⚠️ {error}
          </div>
        )}

        {/* TAB MATCHS */}
        {activeTab === "matches" && (
          <div style={{ animation: "slideIn 0.3s ease" }}>
            {loading && matches.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <div style={{ fontSize: "30px", animation: "spin 1s linear infinite", display: "inline-block", marginBottom: "12px" }}>⟳</div>
                <div style={{ fontFamily: "monospace", color: "#444", fontSize: "12px", letterSpacing: "2px" }}>CHARGEMENT DES MATCHS...</div>
              </div>
            ) : filteredMatches.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <div style={{ fontSize: "40px", marginBottom: "12px" }}>📭</div>
                <div style={{ fontFamily: "monospace", color: "#444", fontSize: "12px", letterSpacing: "2px" }}>AUCUN MATCH DISPONIBLE AUJOURD'HUI</div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: "10px", color: "#333", fontFamily: "monospace", letterSpacing: "2px", marginBottom: "12px" }}>
                  {filteredMatches.length} MATCH{filteredMatches.length > 1 ? 'S' : ''} · TRIÉS PAR SCORE
                </div>
                {filteredMatches.map((match, i) => (
                  <MatchCard key={match.id || i} match={match} bankroll={bankroll} />
                ))}
              </>
            )}
          </div>
        )}

        {/* TAB KELLY */}
        {activeTab === "kelly" && (
          <div style={{ animation: "slideIn 0.3s ease" }}>
            <div style={{ fontSize: "10px", color: "#333", fontFamily: "monospace", letterSpacing: "2px", marginBottom: "16px" }}>
              CALCULATEUR DE MISE — BANKROLL {bankroll}€
            </div>
            <KellyCalculator bankroll={bankroll} />
          </div>
        )}

        {/* TAB BANKROLL */}
        {activeTab === "bankroll" && (
          <div style={{ animation: "slideIn 0.3s ease" }}>
            <div style={{ fontSize: "10px", color: "#333", fontFamily: "monospace", letterSpacing: "2px", marginBottom: "16px" }}>
              GESTION DE BANKROLL
            </div>
            <BankrollManager bankroll={bankroll} setBankroll={setBankroll} />
          </div>
        )}

        {/* TAB JOURNAL */}
        {activeTab === "journal" && (
          <div style={{ animation: "slideIn 0.3s ease" }}>

            {/* Stats globales */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "16px" }}>
              {[
                { l: "PARIS TOTAL", v: stats.total, c: "#888" },
                { l: "GAGNÉS", v: stats.won, c: "#00ff88" },
                { l: "PERDUS", v: stats.lost, c: "#ff4466" },
                { l: "EN COURS", v: stats.pending, c: "#ffaa00" },
              ].map((s, i) => (
                <div key={i} style={{ background: "#0a0a1a", borderRadius: "8px", padding: "12px", textAlign: "center", border: "1px solid #1e1e3f" }}>
                  <div style={{ fontSize: "9px", color: "#444", fontFamily: "monospace", marginBottom: "4px" }}>{s.l}</div>
                  <div style={{ fontSize: "22px", fontFamily: "monospace", fontWeight: 700, color: s.c }}>{s.v}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "16px" }}>
              {[
                { l: "PROFIT", v: (stats.profit >= 0 ? "+" : "") + stats.profit + "€", c: stats.profit >= 0 ? "#00ff88" : "#ff4466" },
                { l: "ROI", v: (stats.roi >= 0 ? "+" : "") + stats.roi + "%", c: stats.roi >= 0 ? "#00ff88" : "#ff4466" },
                { l: "WIN RATE", v: stats.winRate + "%", c: stats.winRate >= 55 ? "#00ff88" : stats.winRate >= 45 ? "#ffaa00" : "#ff4466" },
              ].map((s, i) => (
                <div key={i} style={{ background: "#0a0a1a", borderRadius: "8px", padding: "12px", textAlign: "center", border: "1px solid #1e1e3f" }}>
                  <div style={{ fontSize: "9px", color: "#444", fontFamily: "monospace", marginBottom: "4px" }}>{s.l}</div>
                  <div style={{ fontSize: "20px", fontFamily: "monospace", fontWeight: 700, color: s.c }}>{s.v}</div>
                </div>
              ))}
            </div>

            {/* Bouton ajouter */}
            <button onClick={() => setShowAddBet(!showAddBet)} style={{
              width: "100%", padding: "12px", marginBottom: "12px",
              background: showAddBet ? "#ff446610" : "#00ff8810",
              border: showAddBet ? "1px solid #ff446630" : "1px solid #00ff8830",
              color: showAddBet ? "#ff4466" : "#00ff88",
              fontFamily: "monospace", fontSize: "12px", fontWeight: 700,
              borderRadius: "8px", cursor: "pointer", letterSpacing: "1px",
            }}>
              {showAddBet ? "✕ ANNULER" : "+ AJOUTER UN PARI"}
            </button>

            {/* Formulaire ajout */}
            {showAddBet && (
              <div style={{ background: "#0a0a1a", border: "1px solid #1e1e3f", borderRadius: "10px", padding: "16px", marginBottom: "16px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                  {[
                    { label: "MATCH", key: "match", placeholder: "Ex: Lakers vs Celtics" },
                    { label: "ÉQUIPE PARIÉE", key: "equipe", placeholder: "Ex: Lakers" },
                    { label: "COTE", key: "cote", placeholder: "Ex: 1.85" },
                    { label: "MISE (€)", key: "mise", placeholder: "Ex: 20" },
                  ].map((field, i) => (
                    <div key={i}>
                      <div style={{ fontSize: "9px", color: "#555", fontFamily: "monospace", marginBottom: "4px" }}>{field.label}</div>
                      <input
                        type="text"
                        placeholder={field.placeholder}
                        value={newBet[field.key]}
                        onChange={e => setNewBet(prev => ({ ...prev, [field.key]: e.target.value }))}
                        style={{
                          width: "100%", background: "#060613", border: "1px solid #1e1e3f",
                          color: "#e0e0e0", fontFamily: "monospace", fontSize: "12px",
                          padding: "8px 10px", borderRadius: "6px",
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom: "10px" }}>
                  <div style={{ fontSize: "9px", color: "#555", fontFamily: "monospace", marginBottom: "4px" }}>TYPE DE PARI</div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {["Moneyline", "Handicap", "Over", "Under", "B2B Fade"].map(type => (
                      <button key={type} onClick={() => setNewBet(prev => ({ ...prev, type }))} style={{
                        padding: "6px 10px", borderRadius: "4px", cursor: "pointer",
                        fontFamily: "monospace", fontSize: "10px", fontWeight: 700,
                        background: newBet.type === type ? "#00ff8815" : "transparent",
                        color: newBet.type === type ? "#00ff88" : "#444",
                        border: newBet.type === type ? "1px solid #00ff8830" : "1px solid #1a1a2e",
                      }}>{type}</button>
                    ))}
                  </div>
                </div>
                <button onClick={handleAddBet} style={{
                  width: "100%", padding: "10px", background: "#00ff8815",
                  border: "1px solid #00ff8830", color: "#00ff88",
                  fontFamily: "monospace", fontSize: "12px", fontWeight: 700,
                  borderRadius: "6px", cursor: "pointer", letterSpacing: "1px",
                }}>
                  ✓ ENREGISTRER LE PARI
                </button>
              </div>
            )}

            {/* Liste des paris */}
            {bets.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", fontFamily: "monospace", color: "#333", fontSize: "12px", letterSpacing: "2px" }}>
                📋 AUCUN PARI ENREGISTRÉ
              </div>
            ) : (
              bets.map(bet => {
                const gain = bet.status === 'won' ? Math.round((bet.mise * bet.cote - bet.mise) * 100) / 100 : bet.status === 'lost' ? -bet.mise : null;
                const statusColor = bet.status === 'won' ? '#00ff88' : bet.status === 'lost' ? '#ff4466' : '#ffaa00';
                return (
                  <div key={bet.id} style={{
                    background: "#0a0a1a", border: `1px solid ${statusColor}22`,
                    borderLeft: `3px solid ${statusColor}`,
                    borderRadius: "8px", padding: "14px", marginBottom: "8px",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                      <div>
                        <div style={{ fontFamily: "monospace", fontSize: "13px", fontWeight: 700, color: "#e0e0e0", marginBottom: "2px" }}>
                          {bet.equipe} <span style={{ color: "#444", fontSize: "11px" }}>— {bet.match}</span>
                        </div>
                        <div style={{ display: "flex", gap: "10px" }}>
                          <span style={{ fontSize: "10px", color: "#555", fontFamily: "monospace" }}>📅 {new Date(bet.date).toLocaleDateString('fr-FR')}</span>
                          <span style={{ fontSize: "10px", color: "#ffaa00", fontFamily: "monospace" }}>@ {bet.cote}</span>
                          <span style={{ fontSize: "10px", color: "#888", fontFamily: "monospace" }}>Mise: {bet.mise}€</span>
                          <span style={{ fontSize: "10px", color: "#555", fontFamily: "monospace" }}>{bet.type}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                        {gain !== null && (
                          <span style={{ fontFamily: "monospace", fontSize: "14px", fontWeight: 700, color: gain >= 0 ? "#00ff88" : "#ff4466" }}>
                            {gain >= 0 ? "+" : ""}{gain}€
                          </span>
                        )}
                        <span style={{ fontSize: "9px", fontFamily: "monospace", color: statusColor, border: `1px solid ${statusColor}44`, padding: "2px 6px", borderRadius: "3px" }}>
                          {bet.status === 'won' ? '✓ GAGNÉ' : bet.status === 'lost' ? '✗ PERDU' : '⏳ EN COURS'}
                        </span>
                      </div>
                    </div>
                    {bet.status === 'pending' && (
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button onClick={() => handleStatus(bet.id, 'won')} style={{
                          flex: 1, padding: "6px", background: "#00ff8810", border: "1px solid #00ff8830",
                          color: "#00ff88", fontFamily: "monospace", fontSize: "10px", fontWeight: 700,
                          borderRadius: "4px", cursor: "pointer",
                        }}>✓ GAGNÉ</button>
                        <button onClick={() => handleStatus(bet.id, 'lost')} style={{
                          flex: 1, padding: "6px", background: "#ff446610", border: "1px solid #ff446630",
                          color: "#ff4466", fontFamily: "monospace", fontSize: "10px", fontWeight: 700,
                          borderRadius: "4px", cursor: "pointer",
                        }}>✗ PERDU</button>
                        <button onClick={() => handleDelete(bet.id)} style={{
                          padding: "6px 10px", background: "transparent", border: "1px solid #1a1a2e",
                          color: "#333", fontFamily: "monospace", fontSize: "10px",
                          borderRadius: "4px", cursor: "pointer",
                        }}>🗑</button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
