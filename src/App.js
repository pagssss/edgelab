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

          {/* Stats FOOT réelles */}
          {match.footballStats?.available && (
            <div style={{ marginTop: "10px" }}>
              <div style={{ background: "#00ff8806", border: "1px solid #00ff8818", borderRadius: "8px", padding: "12px", marginBottom: "8px" }}>
                <div style={{ fontSize: "10px", color: "#00ff88", fontFamily: "monospace", fontWeight: 700, marginBottom: "10px", letterSpacing: "1px" }}>
                  ⚽ STATS LIGUE EN TEMPS RÉEL
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "10px" }}>
                  {[
                    { label: "🏠 " + match.footballStats.homeTeam.teamName, stats: match.footballStats.homeTeam },
                    { label: "✈️ " + match.footballStats.awayTeam.teamName, stats: match.footballStats.awayTeam },
                  ].map((item, i) => (
                    <div key={i} style={{ background: "#060613", borderRadius: "6px", padding: "10px", border: "1px solid #1a1a2e" }}>
                      <div style={{ fontSize: "9px", color: "#555", fontFamily: "monospace", marginBottom: "6px" }}>{item.label}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", marginBottom: "6px" }}>
                        {[
                          { l: "CLASSEMENT", v: item.stats.position + "e", c: item.stats.position <= 4 ? "#00ff88" : item.stats.position <= 10 ? "#ffaa00" : "#ff4466" },
                          { l: "POINTS", v: item.stats.points, c: "#888" },
                          { l: "BUT/MATCH", v: item.stats.avgGoalsFor, c: item.stats.avgGoalsFor >= 1.8 ? "#00ff88" : item.stats.avgGoalsFor >= 1.2 ? "#ffaa00" : "#ff4466" },
                          { l: "ENCAISSÉ", v: item.stats.avgGoalsAgainst, c: item.stats.avgGoalsAgainst <= 1 ? "#00ff88" : item.stats.avgGoalsAgainst <= 1.5 ? "#ffaa00" : "#ff4466" },
                        ].map((s, j) => (
                          <div key={j}>
                            <div style={{ fontSize: "8px", color: "#444", fontFamily: "monospace" }}>{s.l}</div>
                            <div style={{ fontSize: "13px", fontFamily: "monospace", fontWeight: 700, color: s.c }}>{s.v}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize: "11px", fontFamily: "monospace", marginBottom: "2px" }}>
                        {item.stats.form?.map((r, j) => (
                          <span key={j} style={{ color: r === "W" ? "#00ff88" : r === "D" ? "#ffaa00" : "#ff4466", marginRight: "3px", fontWeight: 700 }}>{r}</span>
                        ))}
                        <span style={{ fontSize: "9px", color: "#444", marginLeft: "4px" }}>{item.stats.winRate}% pts</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                  {[
                    { l: "ÉCART CLASSEMENT", v: match.footballStats.positionDiff > 0 ? "DOM +" + match.footballStats.positionDiff : "EXT +" + Math.abs(match.footballStats.positionDiff), c: "#888" },
                    { l: "TOTAL PROJETÉ", v: match.footballStats.projectedTotal + " buts", c: "#00aaff" },
                  ].map((item, i) => (
                    <div key={i} style={{ background: "#060613", borderRadius: "6px", padding: "8px", textAlign: "center", border: "1px solid #1a1a2e" }}>
                      <div style={{ fontSize: "8px", color: "#444", fontFamily: "monospace", marginBottom: "2px" }}>{item.l}</div>
                      <div style={{ fontSize: "14px", fontFamily: "monospace", fontWeight: 700, color: item.c }}>{item.v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Paris recommandés foot */}
              {match.footballStats.bets?.length > 0 && (
                <div style={{ background: "#00ff8806", border: "1px solid #00ff8818", borderRadius: "8px", padding: "12px", marginBottom: "8px" }}>
                  <div style={{ fontSize: "10px", color: "#00ff88", fontFamily: "monospace", fontWeight: 700, marginBottom: "8px", letterSpacing: "1px" }}>
                    🎯 PARIS RECOMMANDÉS
                  </div>
                  {match.footballStats.bets.map((bet, i) => (
                    <div key={i} style={{ background: "#060613", borderRadius: "6px", padding: "10px", border: "1px solid #1a1a2e", marginBottom: "6px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "14px" }}>{bet.emoji}</span>
                          <span style={{ fontFamily: "monospace", fontSize: "12px", fontWeight: 700, color: bet.color }}>{bet.label}</span>
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

          {match.homeValue <= 0 && !match.footballStats?.available && !match.nbaStats?.available && (
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
  const startBankroll = 50;
  const stopLoss = bankroll * 0.60; // -40%
  const withdrawalTarget = bankroll * 2; // ×2
  const toWithdraw = Math.round(withdrawalTarget * 0.25 * 100) / 100;
  const toKeep = Math.round(withdrawalTarget * 0.75 * 100) / 100;
  const maxBet = bankroll < 100 ? bankroll * 0.03 : bankroll * 0.05;
  const progress = Math.min(100, Math.round(((bankroll - startBankroll) / (withdrawalTarget - startBankroll)) * 100));
  const growthX = Math.round((bankroll / startBankroll) * 10) / 10;

  // Paliers de croissance
  const milestones = [
    { label: "Départ", value: 50, reached: bankroll >= 50 },
    { label: "×2", value: 100, reached: bankroll >= 100 },
    { label: "×3", value: 150, reached: bankroll >= 150 },
    { label: "×5", value: 250, reached: bankroll >= 250 },
    { label: "×10", value: 500, reached: bankroll >= 500 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

      {/* Bankroll actuelle */}
      <div style={{ background: "#0a0a1a", borderRadius: "12px", padding: "20px", border: "1px solid #1e1e3f" }}>
        <div style={{ fontFamily: "monospace", fontSize: "12px", color: "#666", letterSpacing: "2px", marginBottom: "16px", fontWeight: 700 }}>
          💰 MA BANKROLL
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
          <input
            type="number"
            value={bankroll}
            onChange={e => setBankroll(parseFloat(e.target.value) || 0)}
            style={{ background: "#060613", border: "1px solid #1e1e3f", color: "#00ff88", fontFamily: "monospace", fontSize: "28px", fontWeight: 700, padding: "8px 12px", borderRadius: "8px", width: "160px" }}
          />
          <span style={{ fontFamily: "monospace", fontSize: "28px", color: "#00ff88", fontWeight: 700 }}>€</span>
          <div style={{ marginLeft: "8px" }}>
            <div style={{ fontFamily: "monospace", fontSize: "11px", color: "#555", marginBottom: "2px" }}>CROISSANCE</div>
            <div style={{ fontFamily: "monospace", fontSize: "22px", fontWeight: 700, color: growthX >= 2 ? "#00ff88" : growthX >= 1.5 ? "#ffaa00" : "#888" }}>×{growthX}</div>
          </div>
        </div>

        {/* Barre de progression vers le prochain retrait */}
        <div style={{ marginBottom: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ fontFamily: "monospace", fontSize: "9px", color: "#444" }}>PROGRESSION VERS RETRAIT</span>
            <span style={{ fontFamily: "monospace", fontSize: "9px", color: "#ffaa00" }}>{bankroll.toFixed(0)}€ / {withdrawalTarget.toFixed(0)}€</span>
          </div>
          <div style={{ height: "6px", background: "#1a1a2e", borderRadius: "3px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: progress >= 100 ? "#00ff88" : "linear-gradient(90deg, #ffaa00, #ff8800)", borderRadius: "3px", transition: "width 0.5s ease" }} />
          </div>
          <div style={{ textAlign: "right", marginTop: "4px", fontFamily: "monospace", fontSize: "9px", color: "#444" }}>{progress}%</div>
        </div>
      </div>

      {/* Stratégie exponentielle */}
      <div style={{ background: "#0a0a1a", borderRadius: "12px", padding: "20px", border: "1px solid #1e1e3f" }}>
        <div style={{ fontFamily: "monospace", fontSize: "12px", color: "#666", letterSpacing: "2px", marginBottom: "16px", fontWeight: 700 }}>
          📈 STRATÉGIE CROISSANCE EXPONENTIELLE
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
          {[
            { l: "RETRAIT À", v: withdrawalTarget.toFixed(0) + "€", sub: "quand bankroll ×2", c: "#ffaa00" },
            { l: "RETIRER", v: toWithdraw.toFixed(0) + "€", sub: "25% du total", c: "#00ff88" },
            { l: "GARDER", v: toKeep.toFixed(0) + "€", sub: "75% continue", c: "#00aaff" },
            { l: "MISE MAX", v: maxBet.toFixed(2) + "€", sub: bankroll < 100 ? "3% (< 100€)" : "5% (> 100€)", c: "#aa44ff" },
          ].map((item, i) => (
            <div key={i} style={{ background: "#060613", borderRadius: "8px", padding: "12px", border: "1px solid #1a1a2e" }}>
              <div style={{ fontFamily: "monospace", fontSize: "9px", color: "#444", marginBottom: "4px" }}>{item.l}</div>
              <div style={{ fontFamily: "monospace", fontSize: "20px", fontWeight: 700, color: item.c, marginBottom: "2px" }}>{item.v}</div>
              <div style={{ fontFamily: "monospace", fontSize: "9px", color: "#333" }}>{item.sub}</div>
            </div>
          ))}
        </div>

        {/* Stop loss */}
        <div style={{ background: "#ff446608", border: "1px solid #ff446620", borderRadius: "8px", padding: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontFamily: "monospace", fontSize: "9px", color: "#ff4466", letterSpacing: "1px", marginBottom: "2px" }}>⛔ STOP-LOSS (-40%)</div>
              <div style={{ fontFamily: "monospace", fontSize: "18px", fontWeight: 700, color: "#ff4466" }}>{stopLoss.toFixed(0)}€</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "monospace", fontSize: "9px", color: "#444", marginBottom: "2px" }}>MARGE RESTANTE</div>
              <div style={{ fontFamily: "monospace", fontSize: "16px", fontWeight: 700, color: bankroll - stopLoss < bankroll * 0.15 ? "#ff4466" : "#888" }}>
                {(bankroll - stopLoss).toFixed(0)}€
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Paliers de croissance */}
      <div style={{ background: "#0a0a1a", borderRadius: "12px", padding: "20px", border: "1px solid #1e1e3f" }}>
        <div style={{ fontFamily: "monospace", fontSize: "12px", color: "#666", letterSpacing: "2px", marginBottom: "16px", fontWeight: 700 }}>
          🎯 PALIERS DE CROISSANCE
        </div>
        <div style={{ position: "relative" }}>
          {milestones.map((m, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: i < milestones.length - 1 ? "16px" : "0" }}>
              <div style={{
                width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0,
                background: m.reached ? "#00ff8820" : "#1a1a2e",
                border: `2px solid ${m.reached ? "#00ff88" : "#2a2a4e"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "monospace", fontSize: "10px", fontWeight: 700,
                color: m.reached ? "#00ff88" : "#444",
              }}>
                {m.reached ? "✓" : (i + 1)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "monospace", fontSize: "12px", fontWeight: 700, color: m.reached ? "#00ff88" : "#444" }}>{m.label}</span>
                  <span style={{ fontFamily: "monospace", fontSize: "12px", color: m.reached ? "#00ff88" : "#333" }}>{m.value}€</span>
                </div>
                {m.reached && m.value > startBankroll && (
                  <div style={{ fontFamily: "monospace", fontSize: "9px", color: "#444", marginTop: "1px" }}>
                    Retirer {Math.round(m.value * 0.25)}€ → garder {Math.round(m.value * 0.75)}€
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Règles rappel */}
      <div style={{ background: "#0a0a1a", borderRadius: "12px", padding: "16px", border: "1px solid #1e1e3f" }}>
        <div style={{ fontFamily: "monospace", fontSize: "12px", color: "#666", letterSpacing: "2px", marginBottom: "12px", fontWeight: 700 }}>
          📋 RÈGLES D'OR
        </div>
        {[
          { e: "📈", t: "Retrait seulement à ×2 de bankroll", c: "#00ff88" },
          { e: "💸", t: "Retirer 25%, laisser 75% travailler", c: "#00ff88" },
          { e: "🎯", t: `Mise max ${maxBet.toFixed(2)}€ (${bankroll < 100 ? "3%" : "5%"})`, c: "#ffaa00" },
          { e: "⛔", t: `Stop-loss à ${stopLoss.toFixed(0)}€ (−40%)`, c: "#ff4466" },
          { e: "🔒", t: "Max 3 paris simultanés", c: "#888" },
          { e: "🧠", t: "Parier uniquement score ≥ 6/10", c: "#888" },
        ].map((r, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <span style={{ fontSize: "14px" }}>{r.e}</span>
            <span style={{ fontFamily: "monospace", fontSize: "11px", color: r.c }}>{r.t}</span>
          </div>
        ))}
      </div>

    </div>
  );
}


export default App;
