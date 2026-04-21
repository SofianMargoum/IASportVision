import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  BackHandler,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useEffectifContext } from './../../tools/EffectifContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const scale = 0.85;

const STAT_FIELDS = [
  { key: 'buts', label: 'Buts', icon: 'football-outline' },
  { key: 'passes', label: 'P. déc.', icon: 'eye-outline' },
  { key: 'tirs', label: 'Tirs', icon: 'locate-outline' },
  { key: 'cles', label: 'P. clés', icon: 'key-outline' },
  { key: 'recups', label: 'Récups', icon: 'hand-left-outline' },
  { key: 'dribles', label: 'Dribbles', icon: 'flash-outline' },
  { key: 'tacles', label: 'Tacles', icon: 'shield-outline' },
  { key: 'fautes', label: 'Fautes', icon: 'alert-circle-outline' },
];

const CARD_FIELDS = [
  { key: 'carton_j', label: 'CJ', color: '#F5A623' },
  { key: 'carton_r', label: 'CR', color: '#D0021B' },
];

const ALL_KEYS = [...STAT_FIELDS.map(f => f.key), ...CARD_FIELDS.map(f => f.key)];

const emptyPlayerStats = () => {
  const obj = {};
  ALL_KEYS.forEach(k => { obj[k] = 0; });
  return obj;
};

// ─── Barre horizontale ───

const HBar = ({ label, value, maxValue, color }) => {
  const pct = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;
  return (
    <View style={styles.hBarRow}>
      <Text style={styles.hBarLabel} numberOfLines={1}>{label}</Text>
      <View style={styles.hBarTrack}>
        <View style={[styles.hBarFill, { width: `${Math.max(pct, 3)}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.hBarValue}>{value}</Text>
    </View>
  );
};

// ─── Boîte vue d'ensemble ───

const OverviewBox = ({ value, label, icon }) => (
  <View style={styles.overviewBox}>
    <Icon name={icon} size={16 * scale} color="#607D8B" style={{ marginBottom: 4 }} />
    <Text style={styles.overviewValue}>{value}</Text>
    <Text style={styles.overviewLabel}>{label}</Text>
  </View>
);

// ─── Separator ───

const Separator = () => (
  <View style={styles.separatorWrap}>
    <View style={styles.separator} />
  </View>
);

// ═══════════════════════════════════════
// ─── Composant principal ───
// ═══════════════════════════════════════

const Statistiques = ({ onBack }) => {
  const { effectif } = useEffectifContext();
  const [stats, setStats] = useState({});
  const [matchs, setMatchs] = useState(0);
  const [expandedPlayer, setExpandedPlayer] = useState(null);

  useEffect(() => {
    const backAction = () => { onBack(); return true; };
    const sub = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => sub.remove();
  }, [onBack]);

  // Load
  useEffect(() => {
    (async () => {
      try {
        const [savedStats, savedMatchs] = await Promise.all([
          AsyncStorage.getItem('@player_stats'),
          AsyncStorage.getItem('@team_matchs'),
        ]);
        if (savedStats) setStats(JSON.parse(savedStats));
        else {
          const init = {};
          effectif.forEach(p => { init[p.numero] = emptyPlayerStats(); });
          setStats(init);
        }
        if (savedMatchs) setMatchs(parseInt(savedMatchs, 10) || 0);
      } catch (e) {
        console.error('Stats load error', e);
      }
    })();
  }, [effectif]);

  // Save stats
  useEffect(() => {
    if (Object.keys(stats).length > 0) {
      AsyncStorage.setItem('@player_stats', JSON.stringify(stats)).catch(() => {});
    }
  }, [stats]);

  // Save matchs
  useEffect(() => {
    AsyncStorage.setItem('@team_matchs', String(matchs)).catch(() => {});
  }, [matchs]);

  function updateValue(numero, field, delta) {
    setStats(prev => ({
      ...prev,
      [numero]: {
        ...prev[numero],
        [field]: Math.max(0, (prev[numero]?.[field] || 0) + delta),
      },
    }));
  }

  // ─── Calculs ───

  const totals = useMemo(() => {
    const t = {};
    ALL_KEYS.forEach(k => { t[k] = 0; });
    Object.values(stats).forEach(s => {
      ALL_KEYS.forEach(k => { t[k] += s[k] || 0; });
    });
    t.total = STAT_FIELDS.reduce((sum, f) => sum + t[f.key], 0);
    return t;
  }, [stats]);

  const playerRanking = useMemo(() => {
    if (!effectif.length) return [];
    return effectif
      .map(p => {
        const s = stats[p.numero] || emptyPlayerStats();
        const total = STAT_FIELDS.reduce((sum, f) => sum + (s[f.key] || 0), 0);
        return { ...p, stats: s, total };
      })
      .sort((a, b) => b.total - a.total);
  }, [effectif, stats]);

  const topThree = useMemo(() => playerRanking.slice(0, 3), [playerRanking]);

  const getBest = (field) => {
    if (!effectif.length) return null;
    let best = null, max = 0;
    effectif.forEach(p => {
      const val = stats[p.numero]?.[field] || 0;
      if (val > max) { max = val; best = p; }
    });
    return best ? { player: best, value: max } : null;
  };

  const handleReset = () => {
    const init = {};
    effectif.forEach(p => { init[p.numero] = emptyPlayerStats(); });
    setStats(init);
    setMatchs(0);
  };

  // ─── Render ───

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="arrow-back" size={22} color="#C5D0DC" />
        </TouchableOpacity>
        <Text style={styles.title}>Statistiques</Text>
        <TouchableOpacity onPress={handleReset} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="refresh-outline" size={20} color="#607D8B" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* ══════ Compteur de matchs ══════ */}
        <View style={styles.matchBar}>
          <Icon name="calendar-outline" size={16 * scale} color="#607D8B" />
          <Text style={styles.matchLabel}>Matchs joués</Text>
          <TouchableOpacity onPress={() => setMatchs(m => Math.max(0, m - 1))} style={styles.matchBtn}>
            <Icon name="remove" size={16} color="#607D8B" />
          </TouchableOpacity>
          <Text style={styles.matchValue}>{matchs}</Text>
          <TouchableOpacity onPress={() => setMatchs(m => m + 1)} style={styles.matchBtn}>
            <Icon name="add" size={16} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* ══════ Vue d'ensemble ══════ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vue d'ensemble</Text>
          <View style={styles.overviewGrid}>
            {STAT_FIELDS.map(({ key, label, icon }) => (
              <OverviewBox key={key} value={totals[key]} label={label} icon={icon} />
            ))}
          </View>
          <View style={styles.totalActionsRow}>
            <Text style={styles.totalActionsLabel}>Total actions</Text>
            <Text style={styles.totalActionsValue}>{totals.total}</Text>
          </View>
        </View>

        {/* ══════ Moyennes / match ══════ */}
        {matchs > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Moyennes / match</Text>
            <View style={styles.avgGrid}>
              {STAT_FIELDS.map(({ key, label }) => (
                <View key={key} style={styles.avgItem}>
                  <Text style={styles.avgValue}>{(totals[key] / matchs).toFixed(1)}</Text>
                  <Text style={styles.avgLabel}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ══════ Podium ══════ */}
        {topThree.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Podium</Text>
            <View style={styles.podiumRow}>
              {/* 2e */}
              <View style={styles.podiumSlot}>
                <View style={[styles.podiumBadge, { backgroundColor: 'rgba(192,192,192,0.15)' }]}>
                  <Text style={[styles.podiumRank, { color: '#C0C0C0' }]}>2</Text>
                </View>
                <Text style={[styles.podiumName, { color: '#C0C0C0' }]} numberOfLines={1}>
                  {topThree[1]?.joueur || '-'}
                </Text>
                <Text style={styles.podiumPts}>{topThree[1]?.total || 0} pts</Text>
                <View style={[styles.podiumBar, { height: 40, backgroundColor: '#C0C0C0' }]} />
              </View>
              {/* 1er */}
              <View style={styles.podiumSlot}>
                <View style={[styles.podiumBadge, { backgroundColor: 'rgba(255,215,0,0.2)' }]}>
                  <Text style={[styles.podiumRank, { color: '#FFD700' }]}>1</Text>
                </View>
                <Text style={[styles.podiumName, { color: '#FFD700' }]} numberOfLines={1}>
                  {topThree[0]?.joueur || '-'}
                </Text>
                <Text style={styles.podiumPts}>{topThree[0]?.total || 0} pts</Text>
                <View style={[styles.podiumBar, { height: 60, backgroundColor: '#FFD700' }]} />
              </View>
              {/* 3e */}
              <View style={styles.podiumSlot}>
                <View style={[styles.podiumBadge, { backgroundColor: 'rgba(205,127,50,0.15)' }]}>
                  <Text style={[styles.podiumRank, { color: '#CD7F32' }]}>3</Text>
                </View>
                <Text style={[styles.podiumName, { color: '#CD7F32' }]} numberOfLines={1}>
                  {topThree[2]?.joueur || '-'}
                </Text>
                <Text style={styles.podiumPts}>{topThree[2]?.total || 0} pts</Text>
                <View style={[styles.podiumBar, { height: 28, backgroundColor: '#CD7F32' }]} />
              </View>
            </View>
          </View>
        )}

        {/* ══════ Classement général ══════ */}
        {playerRanking.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Classement général</Text>
            {playerRanking.map((p, i) => (
              <HBar
                key={p.numero}
                label={`${i + 1}. ${p.joueur}`}
                value={p.total}
                maxValue={playerRanking[0]?.total || 1}
                color={i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : '#455A64'}
              />
            ))}
          </View>
        )}

        {/* ══════ Top par catégorie ══════ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Meilleurs par catégorie</Text>
          <View style={styles.bestGrid}>
            {STAT_FIELDS.map(({ key, label, icon }) => {
              const best = getBest(key);
              return (
                <View key={key} style={styles.bestCard}>
                  <Icon name={icon} size={20 * scale} color="#C5D0DC" />
                  <Text style={styles.bestLabel}>{label}</Text>
                  <Text style={styles.bestPlayer} numberOfLines={1}>
                    {best ? best.player.joueur : '-'}
                  </Text>
                  <Text style={styles.bestValue}>
                    {best ? best.value : 0}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* ══════ Discipline ══════ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Discipline</Text>
          <View style={styles.disciplineRow}>
            <View style={styles.disciplineCard}>
              <View style={[styles.cardIconWrap, { backgroundColor: 'rgba(245,166,35,0.15)' }]}>
                <Icon name="square" size={18 * scale} color="#F5A623" />
              </View>
              <Text style={styles.disciplineValue}>{totals.carton_j || 0}</Text>
              <Text style={styles.disciplineLabel}>Cartons jaunes</Text>
            </View>
            <View style={styles.disciplineCard}>
              <View style={[styles.cardIconWrap, { backgroundColor: 'rgba(208,2,27,0.15)' }]}>
                <Icon name="square" size={18 * scale} color="#D0021B" />
              </View>
              <Text style={styles.disciplineValue}>{totals.carton_r || 0}</Text>
              <Text style={styles.disciplineLabel}>Cartons rouges</Text>
            </View>
            <View style={styles.disciplineCard}>
              <View style={[styles.cardIconWrap, { backgroundColor: 'rgba(96,125,139,0.15)' }]}>
                <Icon name="alert-circle-outline" size={18 * scale} color="#607D8B" />
              </View>
              <Text style={styles.disciplineValue}>{totals.fautes || 0}</Text>
              <Text style={styles.disciplineLabel}>Fautes</Text>
            </View>
          </View>
        </View>

        <Separator />

        {/* ══════ Détail par joueur ══════ */}
        <Text style={styles.detailTitle}>Détail par joueur</Text>
        {effectif.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="people-outline" size={36} color="#1A2D45" />
            <Text style={styles.emptyText}>Ajoutez des joueurs dans l'effectif</Text>
          </View>
        ) : (
          effectif.map(player => {
            const ps = stats[player.numero] || emptyPlayerStats();
            const isExpanded = expandedPlayer === player.numero;
            const playerTotal = STAT_FIELDS.reduce((s, f) => s + (ps[f.key] || 0), 0);

            return (
              <View key={player.numero} style={styles.playerCard}>
                {/* Header (toggle) */}
                <TouchableOpacity
                  style={styles.playerHeader}
                  onPress={() => setExpandedPlayer(isExpanded ? null : player.numero)}
                  activeOpacity={0.7}
                >
                  <View style={styles.playerNumBadge}>
                    <Text style={styles.playerNumText}>{player.numero}</Text>
                  </View>
                  <Text style={styles.playerName} numberOfLines={1}>{player.joueur}</Text>
                  <Text style={styles.playerTotal}>{playerTotal}</Text>
                  <Icon
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#607D8B"
                  />
                </TouchableOpacity>

                {/* Expanded counters */}
                {isExpanded && (
                  <View style={styles.expandedContent}>
                    {/* Row 1: Offensive */}
                    <View style={styles.statsRow}>
                      {STAT_FIELDS.slice(0, 4).map(({ key, label }) => (
                        <View key={key} style={styles.counterBox}>
                          <Text style={styles.statLabel}>{label}</Text>
                          <View style={styles.counter}>
                            <TouchableOpacity
                              style={styles.counterBtn}
                              onPress={() => updateValue(player.numero, key, 1)}
                              activeOpacity={0.6}
                            >
                              <Icon name="add" size={14} color="#fff" />
                            </TouchableOpacity>
                            <Text style={styles.valueText}>{ps[key] || 0}</Text>
                            <TouchableOpacity
                              style={styles.counterBtn}
                              onPress={() => updateValue(player.numero, key, -1)}
                              activeOpacity={0.6}
                            >
                              <Icon name="remove" size={14} color="#607D8B" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </View>

                    {/* Row 2: Defensive */}
                    <View style={[styles.statsRow, { marginTop: 8 }]}>
                      {STAT_FIELDS.slice(4, 8).map(({ key, label }) => (
                        <View key={key} style={styles.counterBox}>
                          <Text style={styles.statLabel}>{label}</Text>
                          <View style={styles.counter}>
                            <TouchableOpacity
                              style={styles.counterBtn}
                              onPress={() => updateValue(player.numero, key, 1)}
                              activeOpacity={0.6}
                            >
                              <Icon name="add" size={14} color="#fff" />
                            </TouchableOpacity>
                            <Text style={styles.valueText}>{ps[key] || 0}</Text>
                            <TouchableOpacity
                              style={styles.counterBtn}
                              onPress={() => updateValue(player.numero, key, -1)}
                              activeOpacity={0.6}
                            >
                              <Icon name="remove" size={14} color="#607D8B" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </View>

                    {/* Cartons */}
                    <View style={styles.cartonsRow}>
                      {CARD_FIELDS.map(({ key, label, color }) => (
                        <View key={key} style={styles.cartonBox}>
                          <Icon name="square" size={12} color={color} />
                          <Text style={[styles.cartonLabel, { color }]}>{label}</Text>
                          <TouchableOpacity onPress={() => updateValue(player.numero, key, -1)}>
                            <Icon name="remove-circle-outline" size={20} color="#607D8B" />
                          </TouchableOpacity>
                          <Text style={styles.cartonValue}>{ps[key] || 0}</Text>
                          <TouchableOpacity onPress={() => updateValue(player.numero, key, 1)}>
                            <Icon name="add-circle-outline" size={20} color={color} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
};

// ═══════════════════════════════════════
// ─── Styles ───
// ═══════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16 * scale,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
  },
  backButton: {
    padding: 4,
  },
  title: {
    flex: 1,
    fontSize: 18 * scale,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  scrollContent: {
    paddingBottom: 24,
  },

  // ── Match counter ──
  matchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#010E1E',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1A2D45',
    padding: 10 * scale,
    marginBottom: 12,
  },
  matchLabel: {
    flex: 1,
    color: '#C5D0DC',
    fontSize: 14 * scale,
    fontWeight: '600',
    marginLeft: 8,
  },
  matchBtn: {
    width: 30 * scale,
    height: 30 * scale,
    borderRadius: 15 * scale,
    backgroundColor: '#111D2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchValue: {
    color: '#fff',
    fontSize: 18 * scale,
    fontWeight: '800',
    marginHorizontal: 14,
    minWidth: 28,
    textAlign: 'center',
  },

  // ── Section card ──
  section: {
    backgroundColor: '#010E1E',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1A2D45',
    padding: 14 * scale,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#C5D0DC',
    fontSize: 14 * scale,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: 0.3,
  },

  // ── Vue d'ensemble ──
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  overviewBox: {
    width: '24%',
    alignItems: 'center',
    backgroundColor: '#111D2E',
    borderRadius: 8,
    paddingVertical: 10 * scale,
    marginBottom: 6,
  },
  overviewValue: {
    color: '#fff',
    fontSize: 18 * scale,
    fontWeight: '800',
  },
  overviewLabel: {
    color: '#607D8B',
    fontSize: 10 * scale,
    marginTop: 2,
    textAlign: 'center',
  },
  totalActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111D2E',
    borderRadius: 8,
    paddingVertical: 10 * scale,
    paddingHorizontal: 14 * scale,
    marginTop: 4,
  },
  totalActionsLabel: {
    color: '#607D8B',
    fontSize: 13 * scale,
    fontWeight: '600',
  },
  totalActionsValue: {
    color: '#fff',
    fontSize: 20 * scale,
    fontWeight: '800',
  },

  // ── Moyennes ──
  avgGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  avgItem: {
    width: '24%',
    alignItems: 'center',
    backgroundColor: '#111D2E',
    borderRadius: 8,
    paddingVertical: 8 * scale,
    marginBottom: 6,
  },
  avgValue: {
    color: '#fff',
    fontSize: 16 * scale,
    fontWeight: '700',
  },
  avgLabel: {
    color: '#607D8B',
    fontSize: 10 * scale,
    marginTop: 2,
    textAlign: 'center',
  },

  // ── Podium ──
  podiumRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingTop: 8,
    paddingBottom: 4,
  },
  podiumSlot: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  podiumBadge: {
    width: 34 * scale,
    height: 34 * scale,
    borderRadius: 17 * scale,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  podiumRank: {
    fontSize: 16 * scale,
    fontWeight: '800',
  },
  podiumName: {
    fontSize: 12 * scale,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  podiumPts: {
    color: '#607D8B',
    fontSize: 11 * scale,
    marginBottom: 6,
  },
  podiumBar: {
    width: '60%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    opacity: 0.5,
  },

  // ── HBar (classement) ──
  hBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  hBarLabel: {
    width: '35%',
    color: '#C5D0DC',
    fontSize: 12 * scale,
    fontWeight: '600',
  },
  hBarTrack: {
    flex: 1,
    height: 10,
    backgroundColor: '#111D2E',
    borderRadius: 5,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  hBarFill: {
    height: '100%',
    borderRadius: 5,
    opacity: 0.7,
  },
  hBarValue: {
    width: 30,
    color: '#C5D0DC',
    fontSize: 12 * scale,
    fontWeight: '700',
    textAlign: 'right',
  },

  // ── Meilleurs par catégorie ──
  bestGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  bestCard: {
    width: '48%',
    backgroundColor: '#111D2E',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12 * scale,
    marginBottom: 8,
  },
  bestLabel: {
    color: '#607D8B',
    fontSize: 11 * scale,
    marginTop: 4,
    marginBottom: 4,
  },
  bestPlayer: {
    color: '#C5D0DC',
    fontSize: 13 * scale,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  bestValue: {
    color: '#fff',
    fontSize: 16 * scale,
    fontWeight: '800',
    marginTop: 2,
  },

  // ── Discipline ──
  disciplineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  disciplineCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#111D2E',
    borderRadius: 10,
    paddingVertical: 12 * scale,
    marginHorizontal: 3,
  },
  cardIconWrap: {
    width: 36 * scale,
    height: 36 * scale,
    borderRadius: 18 * scale,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  disciplineValue: {
    color: '#fff',
    fontSize: 20 * scale,
    fontWeight: '800',
  },
  disciplineLabel: {
    color: '#607D8B',
    fontSize: 10 * scale,
    marginTop: 4,
    textAlign: 'center',
  },

  // ── Separator ──
  separatorWrap: {
    marginVertical: 4,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  // ── Detail title ──
  detailTitle: {
    color: '#C5D0DC',
    fontSize: 14 * scale,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 4,
    letterSpacing: 0.3,
  },

  // ── Player card ──
  playerCard: {
    backgroundColor: '#010E1E',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1A2D45',
    marginBottom: 8 * scale,
    overflow: 'hidden',
  },
  playerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12 * scale,
  },
  playerNumBadge: {
    width: 28 * scale,
    height: 28 * scale,
    borderRadius: 14 * scale,
    backgroundColor: '#111D2E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  playerNumText: {
    color: '#C5D0DC',
    fontSize: 12 * scale,
    fontWeight: '700',
  },
  playerName: {
    flex: 1,
    fontSize: 15 * scale,
    fontWeight: '600',
    color: '#C5D0DC',
  },
  playerTotal: {
    color: '#fff',
    fontSize: 15 * scale,
    fontWeight: '800',
    marginRight: 8,
  },

  // ── Expanded content ──
  expandedContent: {
    paddingHorizontal: 12 * scale,
    paddingBottom: 12 * scale,
    borderTopWidth: 1,
    borderTopColor: '#1A2D45',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  counterBox: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    color: '#607D8B',
    fontSize: 10 * scale,
    marginBottom: 4,
  },
  counter: {
    alignItems: 'center',
    backgroundColor: '#111D2E',
    borderRadius: 8,
    width: 36 * scale,
    paddingVertical: 2,
  },
  counterBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36 * scale,
    height: 26 * scale,
  },
  valueText: {
    color: '#fff',
    fontSize: 14 * scale,
    fontWeight: '700',
    marginVertical: 1,
  },

  // ── Cartons ──
  cartonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  cartonBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cartonLabel: {
    fontSize: 12 * scale,
    fontWeight: '700',
    marginRight: 4,
  },
  cartonValue: {
    color: '#fff',
    fontSize: 15 * scale,
    fontWeight: '800',
    marginHorizontal: 4,
  },

  // ── Empty ──
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    color: '#607D8B',
    fontSize: 14 * scale,
    marginTop: 10,
  },
});

export default Statistiques;
