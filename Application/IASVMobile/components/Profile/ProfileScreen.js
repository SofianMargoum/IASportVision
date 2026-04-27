import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import { Circle, Line, Polygon, Svg, Text as SvgText } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { fetchCompetitionsForClub, searchClubs } from '../../tools/api';
import { useClubContext } from '../../tools/ClubContext';
import { UserContext } from '../../tools/UserContext';

const scale = 0.85;

const MOI_STATS_PREFIX = '@moi_stats_';

const STATS_SECTIONS = [
  {
    title: 'Général',
    icon: 'stats-chart-outline',
    stats: [
      { key: 'poste',    label: 'Poste' },
      { key: 'numero',   label: 'Numéro' },
      { key: 'tempsJeu', label: 'Temps de jeu (min)' },
      { key: 'note',     label: 'Note /10' },
    ],
  },
  {
    title: 'Attaque',
    icon: 'football-outline',
    stats: [
      { key: 'buts',            label: 'Buts' },
      { key: 'passesDecisives', label: 'Passes décisives' },
      { key: 'tirs',            label: 'Tirs' },
      { key: 'tirsCadres',      label: 'Tirs cadrés' },
      { key: 'dribles',         label: 'Dribbles réussis' },
    ],
  },
  {
    title: 'Passes',
    icon: 'swap-horizontal-outline',
    stats: [
      { key: 'passes',         label: 'Passes totales' },
      { key: 'passesReussies', label: 'Passes réussies' },
      { key: 'centres',        label: 'Centres' },
      { key: 'passesLongues',  label: 'Passes longues' },
    ],
  },
  {
    title: 'Défense',
    icon: 'shield-outline',
    stats: [
      { key: 'tacles',           label: 'Tacles' },
      { key: 'taclesReussis',    label: 'Tacles réussis' },
      { key: 'interceptions',    label: 'Interceptions' },
      { key: 'ballonsRecuperes', label: 'Ballons récupérés' },
      { key: 'degagements',      label: 'Dégagements' },
    ],
  },
  {
    title: 'Physique',
    icon: 'flash-outline',
    stats: [
      { key: 'distanceParcourue', label: 'Distance (km)' },
      { key: 'sprints',           label: 'Sprints' },
      { key: 'duelsGagnes',       label: 'Duels gagnés' },
      { key: 'duelsAeriens',      label: 'Duels aériens gagnés' },
    ],
  },
  {
    title: 'Discipline',
    icon: 'bookmark-outline',
    stats: [
      { key: 'fautes',       label: 'Fautes commises' },
      { key: 'fautesSubies', label: 'Fautes subies' },
      { key: 'cartonJaune',  label: 'Carton jaune' },
      { key: 'cartonRouge',  label: 'Carton rouge' },
      { key: 'horsJeu',      label: 'Hors-jeu' },
    ],
  },
];

const HIGHLIGHTS = [
  { key: 'buts',            label: 'Buts',        icon: 'football',          iconColor: '#5BB8FF', colors: ['#071E35', '#0D3660'] },
  { key: 'passesDecisives', label: 'Passes D.',   icon: 'git-merge-outline', iconColor: '#4ECBA0', colors: ['#071E18', '#0D3228'] },
  { key: 'tirsCadres',      label: 'Tirs cadrés', icon: 'locate-outline',    iconColor: '#FFA050', colors: ['#251005', '#40200A'] },
  { key: 'tempsJeu',        label: 'Temps (min)', icon: 'time-outline',      iconColor: '#A875FF', colors: ['#130A25', '#221542'] },
];

/* ─────────────────────────────────────────────
   Radar chart
───────────────────────────────────────────── */
const RADAR_STATS = [
  { key: 'buts',            label: 'Buts' },
  { key: 'passesDecisives', label: 'Pass. D.' },
  { key: 'tirsCadres',      label: 'Tirs' },
  { key: 'taclesReussis',   label: 'Tacles' },
  { key: 'duelsGagnes',     label: 'Duels' },
  { key: 'passesReussies',  label: 'Passes' },
];

const R_SIZE   = 260;
const R_CX     = R_SIZE / 2;
const R_CY     = R_SIZE / 2;
const R_RADIUS = 82;
const R_LABEL  = R_RADIUS + 19;
const R_LEVELS = 4;
const R_N      = RADAR_STATS.length;

const radarAngle = (i) => (Math.PI * 2 * i) / R_N - Math.PI / 2;
const radarPt    = (i, r) => ({
  x: R_CX + r * Math.cos(radarAngle(i)),
  y: R_CY + r * Math.sin(radarAngle(i)),
});

const RadarChart = ({ data }) => {
  const values = RADAR_STATS.map((s) => Math.max(0, parseFloat(data[s.key]) || 0));
  const maxVal = Math.max(...values, 1);
  const norm   = values.map((v) => v / maxVal);

  const grids = Array.from({ length: R_LEVELS }, (_, l) => {
    const r = (R_RADIUS * (l + 1)) / R_LEVELS;
    return Array.from({ length: R_N }, (_, i) => radarPt(i, r))
      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  });

  const dpts  = norm.map((v, i) => radarPt(i, v * R_RADIUS));
  const dpoly = dpts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <Svg width={R_SIZE} height={R_SIZE}>
      {/* Background circle */}
      <Circle
        cx={R_CX} cy={R_CY} r={R_RADIUS}
        fill="rgba(1,14,30,0.7)"
        stroke="rgba(58,143,199,0.22)"
        strokeWidth={1}
      />
      {/* Grid polygons */}
      {grids.map((pts, i) => (
        <Polygon key={`g${i}`} points={pts} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
      ))}
      {/* Axis lines */}
      {RADAR_STATS.map((_, i) => {
        const p = radarPt(i, R_RADIUS);
        return (
          <Line
            key={`a${i}`}
            x1={`${R_CX}`} y1={`${R_CY}`}
            x2={p.x.toFixed(1)} y2={p.y.toFixed(1)}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={0.6}
          />
        );
      })}
      {/* Data fill */}
      <Polygon points={dpoly} fill="rgba(58,143,199,0.2)" stroke="none" />
      {/* Data stroke */}
      <Polygon points={dpoly} fill="none" stroke="#3A8FC7" strokeWidth={1.8} strokeLinejoin="round" />
      {/* Dots */}
      {dpts.map((p, i) => (
        <Circle
          key={`d${i}`}
          cx={p.x.toFixed(1)} cy={p.y.toFixed(1)}
          r={4}
          fill="#5BB8FF"
          stroke="#010914"
          strokeWidth={1.5}
        />
      ))}
      {/* Labels */}
      {RADAR_STATS.map((s, i) => {
        const ang    = radarAngle(i);
        const lp     = radarPt(i, R_LABEL);
        const cos    = Math.cos(ang);
        const sin    = Math.sin(ang);
        const anchor = cos < -0.15 ? 'end' : cos > 0.15 ? 'start' : 'middle';
        const ly     = (lp.y + (sin < 0 ? 2 : sin > 0 ? 10 : 6)).toFixed(1);
        return (
          <SvgText
            key={`l${i}`}
            x={lp.x.toFixed(1)}
            y={ly}
            textAnchor={anchor}
            fill="#8AAFC0"
            fontSize={8.5}
            fontWeight="600"
          >
            {s.label}
          </SvgText>
        );
      })}
    </Svg>
  );
};

const resolveImageSource = (value) => {
  if (!value) return null;
  const uri = String(value).trim();
  if (!uri) return null;

  if (/^(https?:|file:|content:|data:|asset:|res:)/i.test(uri)) {
    return { uri };
  }

  return null;
};

const getInitials = (name) => {
  const cleaned = String(name ?? '').trim();
  if (!cleaned) return '?';
  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const ProfileScreen = ({ user, onBack }) => {
  const { setUser } = useContext(UserContext);
  const {
    selectedClub, setSelectedClub, setClNo,
    competition, setCompetition, setPhase, setPoule, setCp_no,
  } = useClubContext();

  /* ── Mode édition ── */
  const [editMode, setEditMode] = useState(false);

  /* ── Champs éditables ── */
  const [editNom, setEditNom]       = useState('');
  const [editPrenom, setEditPrenom] = useState('');
  const [editAge, setEditAge]       = useState('');
  const [editPoste, setEditPoste]   = useState('');

  /* ── Recherche club ── */
  const [clubSearch, setClubSearch]     = useState('');
  const [clubResults, setClubResults]   = useState([]);
  const [clubSearching, setClubSearching] = useState(false);
  const [localClub, setLocalClub]       = useState(null);
  const clubTimer = useRef(null);

  /* ── Compétitions (équipe) ── */
  const [competitions, setCompetitions]           = useState([]);
  const [compsLoading, setCompsLoading]           = useState(false);
  const [localCompetition, setLocalCompetition]   = useState(null);

  /* ── Stats du match ── */
  const [moiStats, setMoiStats] = useState({});
  const [matchCount, setMatchCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const matchKeys = allKeys.filter((k) => k.startsWith(MOI_STATS_PREFIX));
        setMatchCount(matchKeys.length);
        if (matchKeys.length === 0) return;
        const pairs = await AsyncStorage.multiGet(matchKeys);
        const totals = {};
        for (const [, value] of pairs) {
          if (!value) continue;
          let data;
          try { data = JSON.parse(value); } catch { continue; }
          for (const [k, v] of Object.entries(data)) {
            if (v === undefined || v === '') continue;
            const num = parseFloat(v);
            if (!isNaN(num)) {
              totals[k] = (totals[k] ?? 0) + num;
            } else if (!totals[k]) {
              totals[k] = v;
            }
          }
        }
        const formatted = {};
        for (const [k, v] of Object.entries(totals)) {
          formatted[k] = typeof v === 'number'
            ? (Number.isInteger(v) ? String(v) : parseFloat(v.toFixed(2)).toString())
            : v;
        }
        setMoiStats(formatted);
      } catch { /* ignore */ }
    })();
  }, []);

  /* ── Sauvegarde ── */
  const [saving, setSaving] = useState(false);

  /* ── Back Android ── */
  useEffect(() => {
    const backAction = () => {
      if (editMode) { handleCancel(); return true; }
      if (typeof onBack === 'function') { onBack(); return true; }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => sub.remove();
  }, [onBack, editMode]);

  const derived = useMemo(() => {
    const rawName = String(user?.name ?? '').trim();
    const parts = rawName ? rawName.split(/\s+/) : [];

    const prenom = String(user?.prenom ?? user?.firstName ?? (parts[0] ?? '')).trim();
    const nom = String(user?.nom ?? user?.lastName ?? (parts.length > 1 ? parts.slice(1).join(' ') : '')).trim();

    const ageValue = user?.age;
    const age = ageValue === 0 || ageValue ? String(ageValue) : '';

    const poste = String(user?.poste ?? user?.position ?? '').trim();

    const displayName = rawName || [prenom, nom].filter(Boolean).join(' ').trim();
    const email = String(user?.email ?? '').trim();

    const photoSource = resolveImageSource(user?.photo);
    const initials = getInitials(displayName);

    return {
      prenom: prenom || '—',
      nom: nom || '—',
      age: age || '—',
      poste: poste || '—',
      displayName: displayName || 'Profil',
      email,
      photoSource,
      initials,
    };
  }, [user]);

  /* ── Entrer en mode édition ── */
  const enterEditMode = () => {
    setEditNom(derived.nom === '—' ? '' : derived.nom);
    setEditPrenom(derived.prenom === '—' ? '' : derived.prenom);
    setEditAge(derived.age === '—' ? '' : derived.age);
    setEditPoste(derived.poste === '—' ? '' : derived.poste);
    setLocalClub(selectedClub ?? null);
    setClubSearch(selectedClub?.name ?? '');
    setClubResults([]);
    setLocalCompetition(competition ? { competitionName: competition } : null);
    setCompetitions([]);
    setEditMode(true);
  };

  const handleCancel = () => {
    setEditMode(false);
    setClubResults([]);
  };

  /* ── Recherche de club ── */
  const handleClubSearch = useCallback((text) => {
    setClubSearch(text);
    setLocalClub(null);
    setLocalCompetition(null);
    setCompetitions([]);
    if (clubTimer.current) clearTimeout(clubTimer.current);
    if (text.trim().length < 2) { setClubResults([]); setClubSearching(false); return; }
    setClubSearching(true);
    clubTimer.current = setTimeout(async () => {
      try {
        const results = await searchClubs(text.trim());
        setClubResults(results);
      } catch {
        setClubResults([]);
      } finally {
        setClubSearching(false);
      }
    }, 400);
  }, []);

  const handleSelectClub = useCallback(async (club) => {
    setLocalClub(club);
    setClubSearch(club.name);
    setClubResults([]);
    setCompetitions([]);
    setLocalCompetition(null);
    setCompsLoading(true);
    try {
      const raw = await fetchCompetitionsForClub(club.cl_no);
      const unique = raw.filter(
        (c, i, arr) => arr.findIndex(x => x.competitionName === c.competitionName) === i,
      );
      setCompetitions(unique);
      if (unique.length > 0) setLocalCompetition(unique[0]);
    } catch {
      setCompetitions([]);
    } finally {
      setCompsLoading(false);
    }
  }, []);

  /* ── Sauvegarder ── */
  const handleSave = async () => {
    setSaving(true);
    try {
      const updatedUser = {
        ...user,
        nom:    editNom.trim()    || undefined,
        prenom: editPrenom.trim() || undefined,
        age:    editAge.trim()    || undefined,
        poste:  editPoste.trim()  || undefined,
      };
      setUser(updatedUser);
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));

      if (localClub) {
        setSelectedClub(localClub);
        setClNo(localClub.cl_no);
        await AsyncStorage.setItem('selectedClub', JSON.stringify(localClub));
      }
      if (localCompetition) {
        setCompetition(localCompetition.competitionName);
        setPhase(localCompetition.phaseNumber ?? null);
        setPoule(localCompetition.stageNumber ?? null);
        setCp_no(localCompetition.cp_no ?? null);
        await AsyncStorage.setItem('selectedCompetition', localCompetition.competitionName);
      }
      setEditMode(false);
    } finally {
      setSaving(false);
    }
  };

  const infoRows = [
    { icon: 'person-outline',   label: 'Nom',    value: derived.nom,    editValue: editNom,    onEdit: setEditNom,    keyboardType: 'default' },
    { icon: 'person-outline',   label: 'Prénom', value: derived.prenom, editValue: editPrenom, onEdit: setEditPrenom, keyboardType: 'default' },
    { icon: 'calendar-outline', label: 'Âge',    value: derived.age,    editValue: editAge,    onEdit: setEditAge,    keyboardType: 'numeric' },
    { icon: 'football-outline', label: 'Poste',  value: derived.poste,  editValue: editPoste,  onEdit: setEditPoste,  keyboardType: 'default' },
  ];

  const clubDisplay   = selectedClub?.name ?? '—';
  const equipeDisplay = competition        ?? '—';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* ── En-tête navigation ── */}
        <View style={styles.header}>
          {editMode ? (
            <TouchableOpacity onPress={handleCancel} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="close" size={22} color="#C5D0DC" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel="Retour">
              <Icon name="arrow-back" size={22} color="#C5D0DC" />
            </TouchableOpacity>
          )}
          <Text style={styles.title}>{editMode ? 'Modifier le profil' : 'Profil'}</Text>
          {editMode ? (
            <TouchableOpacity onPress={handleSave} style={styles.saveBtn} disabled={saving} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              {saving
                ? <ActivityIndicator size="small" color="#3A8FC7" />
                : <Icon name="checkmark" size={22} color="#3A8FC7" />}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={enterEditMode} style={styles.editBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel="Modifier">
              <Icon name="pencil-outline" size={20} color="#3A8FC7" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* ── Carte avatar ── */}
          <LinearGradient colors={['#011A35', '#010E1E']} style={styles.profileCard}>
            <View style={styles.avatarRing}>
              {derived.photoSource ? (
                <Image source={derived.photoSource} style={styles.profileImage} />
              ) : (
                <View style={[styles.profileImage, styles.profilePlaceholder]}>
                  <Text style={styles.initials}>{derived.initials}</Text>
                </View>
              )}
            </View>
            <Text style={styles.profileName} numberOfLines={1}>
              {[derived.prenom, derived.nom].filter(v => v !== '—').join(' ') || derived.displayName}
            </Text>
          </LinearGradient>

          {/* ── Informations ── */}
          <Text style={styles.sectionLabel}>Informations</Text>
          <View style={styles.card}>
            {infoRows.map((row, index) => (
              <View key={row.label} style={[styles.row, index === infoRows.length - 1 && !editMode && styles.rowLast]}>
                <View style={styles.rowLeft}>
                  <Icon name={row.icon} size={16} color="#3A8FC7" style={styles.rowIcon} />
                  <Text style={styles.label}>{row.label}</Text>
                </View>
                {editMode ? (
                  <TextInput
                    style={styles.input}
                    value={row.editValue}
                    onChangeText={row.onEdit}
                    keyboardType={row.keyboardType}
                    placeholderTextColor="#3A4D5C"
                    placeholder={row.label}
                    returnKeyType="done"
                  />
                ) : (
                  <Text style={styles.value} numberOfLines={2}>{row.value}</Text>
                )}
              </View>
            ))}

            {/* ── Ligne Club ── */}
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Icon name="shield-outline" size={16} color="#3A8FC7" style={styles.rowIcon} />
                <Text style={styles.label}>Club</Text>
              </View>
              {editMode ? (
                <View style={styles.clubSearchWrapper}>
                  <TextInput
                    style={[styles.input, styles.inputFull]}
                    value={clubSearch}
                    onChangeText={handleClubSearch}
                    placeholder="Rechercher un club…"
                    placeholderTextColor="#3A4D5C"
                    returnKeyType="search"
                  />
                  {clubSearching && <ActivityIndicator size="small" color="#3A8FC7" style={styles.clubLoader} />}
                </View>
              ) : (
                <Text style={styles.value} numberOfLines={2}>{clubDisplay}</Text>
              )}
            </View>

            {/* Résultats recherche club */}
            {editMode && clubResults.length > 0 && (
              <FlatList
                data={clubResults}
                keyExtractor={(item) => String(item.cl_no)}
                keyboardShouldPersistTaps="handled"
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.clubResultRow, localClub?.cl_no === item.cl_no && styles.clubResultSelected]}
                    onPress={() => handleSelectClub(item)}
                    activeOpacity={0.7}
                  >
                    {item.logo ? (
                      <Image source={{ uri: item.logo }} style={styles.clubResultLogo} />
                    ) : (
                      <View style={[styles.clubResultLogo, styles.clubLogoPlaceholder]}>
                        <Icon name="shield-outline" size={14} color="#607D8B" />
                      </View>
                    )}
                    <Text style={styles.clubResultName} numberOfLines={1}>{item.name}</Text>
                    {localClub?.cl_no === item.cl_no && (
                      <Icon name="checkmark-circle" size={16} color="#3A8FC7" />
                    )}
                  </TouchableOpacity>
                )}
              />
            )}

            {/* ── Ligne Équipe ── */}
            <View style={[styles.row, styles.rowLast]}>
              <View style={styles.rowLeft}>
                <Icon name="people-outline" size={16} color="#3A8FC7" style={styles.rowIcon} />
                <Text style={styles.label}>Équipe</Text>
              </View>
              {editMode ? (
                compsLoading ? (
                  <ActivityIndicator size="small" color="#3A8FC7" />
                ) : competitions.length === 0 ? (
                  <Text style={styles.valueHint}>
                    {localClub ? 'Aucune équipe trouvée' : 'Sélectionnez un club'}
                  </Text>
                ) : (
                  <View style={styles.compList}>
                    {competitions.map((comp) => (
                      <TouchableOpacity
                        key={comp.competitionName}
                        style={[
                          styles.compChip,
                          localCompetition?.competitionName === comp.competitionName && styles.compChipSelected,
                        ]}
                        onPress={() => setLocalCompetition(comp)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.compChipText,
                            localCompetition?.competitionName === comp.competitionName && styles.compChipTextSelected,
                          ]}
                          numberOfLines={2}
                        >
                          {comp.competitionName}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )
              ) : (
                <Text style={styles.value} numberOfLines={2}>{equipeDisplay}</Text>
              )}
            </View>
          </View>
          {/* ── Statistiques du match ── */}
          {Object.keys(moiStats).length > 0 && (
            <>
              {/* En-tête section */}
              <View style={styles.statsHeaderRow}>
                <View style={styles.statsHeaderLeft}>
                  <Icon name="stats-chart" size={13} color="#607D8B" />
                  <Text style={styles.sectionLabel}>Statistiques</Text>
                </View>
                {matchCount > 0 && (
                  <View style={styles.statsMatchBadge}>
                    <Icon name="trophy-outline" size={10} color="#3A8FC7" />
                    <Text style={styles.statsMatchBadgeText}>{matchCount} match{matchCount > 1 ? 's' : ''}</Text>
                  </View>
                )}
              </View>

              {/* Métriques clés */}
              {HIGHLIGHTS.some((h) => moiStats[h.key] !== undefined && moiStats[h.key] !== '') && (
                <View style={styles.highlightRow}>
                  {HIGHLIGHTS.filter((h) => moiStats[h.key] !== undefined && moiStats[h.key] !== '').map((h) => (
                    <LinearGradient key={h.key} colors={h.colors} style={styles.highlightCard}>
                      <Icon name={h.icon} size={18} color={h.iconColor} />
                      <Text style={styles.highlightValue}>{moiStats[h.key]}</Text>
                      <Text style={styles.highlightLabel}>{h.label}</Text>
                    </LinearGradient>
                  ))}
                </View>
              )}

              {/* Radar chart */}
              {RADAR_STATS.some((s) => (parseFloat(moiStats[s.key]) || 0) > 0) && (
                <View style={styles.radarCard}>
                  <View style={styles.radarTitleRow}>
                    <Icon name="radio-button-on-outline" size={10} color="#3A5C7A" />
                    <Text style={styles.radarTitle}>Profil du joueur</Text>
                  </View>
                  <RadarChart data={moiStats} />
                  <View style={styles.radarStatsGrid}>
                    {RADAR_STATS.map((s, idx) => (
                      <View
                        key={s.key}
                        style={[
                          styles.radarStatItem,
                          idx % 3 === 2 && styles.radarStatItemNoBorder,
                        ]}
                      >
                        <Text style={styles.radarStatValue}>{moiStats[s.key] || '0'}</Text>
                        <Text style={styles.radarStatLabel}>{s.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Sections avec barres de progression */}
              {STATS_SECTIONS.map((section) => {
                const filledStats = section.stats.filter(
                  (s) => moiStats[s.key] !== undefined && moiStats[s.key] !== ''
                );
                if (filledStats.length === 0) return null;

                const numericVals = filledStats
                  .map((s) => parseFloat(moiStats[s.key]))
                  .filter((n) => !isNaN(n));
                const maxVal = numericVals.length > 0 ? Math.max(...numericVals) : 1;

                return (
                  <View key={section.title} style={styles.statCard}>
                    <LinearGradient
                      colors={['#011530', '#010E1E']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.statCardHeader}
                    >
                      <View style={styles.statCardHeaderLeft}>
                        <View style={styles.statIconBadge}>
                          <Icon name={section.icon} size={12} color="#3A8FC7" />
                        </View>
                        <Text style={styles.statCardTitle}>{section.title}</Text>
                      </View>
                      <Text style={styles.statCountLabel}>{filledStats.length} stat{filledStats.length > 1 ? 's' : ''}</Text>
                    </LinearGradient>

                    {filledStats.map((stat, idx) => {
                      const val = moiStats[stat.key];
                      const num = parseFloat(val);
                      const isNumeric = !isNaN(num);
                      const ratio = isNumeric && maxVal > 0 ? num / maxVal : 0;

                      return (
                        <View
                          key={stat.key}
                          style={[styles.statBarRow, idx === filledStats.length - 1 && styles.statBarRowLast]}
                        >
                          <Text style={styles.statBarLabel} numberOfLines={1}>{stat.label}</Text>
                          <View style={styles.statBarRight}>
                            {isNumeric && (
                              <View style={styles.statBarTrack}>
                                <LinearGradient
                                  colors={['#1A4A7C', '#3A8FC7']}
                                  start={{ x: 0, y: 0 }}
                                  end={{ x: 1, y: 0 }}
                                  style={[styles.statBarFill, { width: `${Math.max(4, Math.round(ratio * 100))}%` }]}
                                />
                              </View>
                            )}
                            <Text style={[styles.statBarValue, !isNumeric && styles.statBarValueText]}>{val}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#010914',
    paddingHorizontal: 16 * scale,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
  },
  headerSpacer: {
    width: 30,
  },
  backBtn: {
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

  /* ── Carte avatar ── */
  profileCard: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 24 * scale,
    paddingHorizontal: 16 * scale,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1A2D45',
    marginBottom: 16,
  },
  avatarRing: {
    padding: 3,
    borderRadius: 44 * scale,
    borderWidth: 2,
    borderColor: '#3A8FC7',
    marginBottom: 12 * scale,
  },
  profileImage: {
    width: 72 * scale,
    height: 72 * scale,
    borderRadius: 36 * scale,
  },
  profilePlaceholder: {
    backgroundColor: '#011A35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#fff',
    fontSize: 26 * scale,
    fontWeight: '700',
  },
  profileName: {
    color: '#fff',
    fontSize: 17 * scale,
    fontWeight: '700',
    textAlign: 'center',
  },
  profileEmail: {
    marginTop: 4,
    color: '#607D8B',
    fontSize: 13 * scale,
    textAlign: 'center',
  },
  posteBadge: {
    marginTop: 10 * scale,
    paddingHorizontal: 12 * scale,
    paddingVertical: 4 * scale,
    backgroundColor: '#011A35',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3A8FC7',
  },
  posteBadgeText: {
    color: '#3A8FC7',
    fontSize: 12 * scale,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  /* ── Section label ── */
  sectionLabel: {
    color: '#607D8B',
    fontSize: 12 * scale,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },

  /* ── Card infos ── */
  card: {
    width: '100%',
    backgroundColor: '#010E1E',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1A2D45',
    paddingHorizontal: 14 * scale,
    paddingVertical: 6 * scale,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12 * scale,
    borderBottomWidth: 1,
    borderBottomColor: '#1A2D45',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    marginRight: 12 * scale,
  },
  rowIcon: {
    marginRight: 8 * scale,
  },
  label: {
    color: '#C5D0DC',
    fontSize: 14 * scale,
    fontWeight: '600',
  },
  value: {
    color: '#fff',
    fontSize: 14 * scale,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  valueHint: {
    color: '#607D8B',
    fontSize: 13 * scale,
    fontStyle: 'italic',
    flex: 1,
    textAlign: 'right',
  },

  /* ── Champs éditables ── */
  input: {
    flex: 1,
    textAlign: 'right',
    color: '#fff',
    fontSize: 14 * scale,
    fontWeight: '600',
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#3A8FC7',
  },
  inputFull: {
    textAlign: 'left',
  },
  saveBtn: {
    width: 30,
    alignItems: 'flex-end',
  },
  editBtn: {
    width: 30,
    alignItems: 'flex-end',
  },

  /* ── Club search ── */
  clubSearchWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  clubLoader: {
    marginLeft: 6,
  },
  clubResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8 * scale,
    paddingHorizontal: 8 * scale,
    borderRadius: 8,
    marginVertical: 2,
  },
  clubResultSelected: {
    backgroundColor: '#011A35',
  },
  clubResultLogo: {
    width: 28 * scale,
    height: 28 * scale,
    borderRadius: 14 * scale,
    marginRight: 10 * scale,
  },
  clubLogoPlaceholder: {
    backgroundColor: '#010914',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubResultName: {
    flex: 1,
    color: '#C5D0DC',
    fontSize: 13 * scale,
  },

  /* ── Radar chart ── */
  radarCard: {
    backgroundColor: '#010E1E',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1A2D45',
    marginBottom: 10,
    alignItems: 'center',
    overflow: 'hidden',
  },
  radarTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingLeft: 14,
    paddingTop: 10,
    paddingBottom: 0,
  },
  radarTitle: {
    color: '#3A5C7A',
    fontSize: 10 * scale,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  radarStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#1A2D45',
  },
  radarStatItem: {
    width: '33.33%',
    alignItems: 'center',
    paddingVertical: 9,
    borderRightWidth: 1,
    borderRightColor: '#1A2D45',
    borderBottomWidth: 0,
  },
  radarStatItemNoBorder: {
    borderRightWidth: 0,
  },
  radarStatValue: {
    color: '#fff',
    fontSize: 15 * scale,
    fontWeight: '800',
  },
  radarStatLabel: {
    color: '#3A5C7A',
    fontSize: 8.5 * scale,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },

  /* ── Stats globales ── */
  statsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 10,
  },
  statsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statsMatchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(58, 143, 199, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(58, 143, 199, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statsMatchBadgeText: {
    color: '#3A8FC7',
    fontSize: 11 * scale,
    fontWeight: '700',
  },
  highlightRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  highlightCard: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12 * scale,
    paddingHorizontal: 4 * scale,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1A2D45',
  },
  highlightValue: {
    color: '#fff',
    fontSize: 18 * scale,
    fontWeight: '800',
    marginTop: 6,
    marginBottom: 2,
  },
  highlightLabel: {
    color: '#7A9AAC',
    fontSize: 9 * scale,
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statCard: {
    backgroundColor: '#010E1E',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1A2D45',
    marginBottom: 8,
    overflow: 'hidden',
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12 * scale,
    paddingVertical: 9 * scale,
    borderBottomWidth: 1,
    borderBottomColor: '#1A2D45',
  },
  statCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statIconBadge: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: 'rgba(58, 143, 199, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCardTitle: {
    color: '#C5D0DC',
    fontSize: 12 * scale,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  statCountLabel: {
    color: '#3A5C7A',
    fontSize: 10 * scale,
  },
  statBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12 * scale,
    paddingVertical: 9 * scale,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(26, 45, 69, 0.5)',
  },
  statBarRowLast: {
    borderBottomWidth: 0,
  },
  statBarLabel: {
    color: '#7A8E9E',
    fontSize: 11 * scale,
    fontWeight: '500',
    width: 90 * scale,
    flexShrink: 0,
    marginRight: 8,
  },
  statBarRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statBarTrack: {
    flex: 1,
    height: 4,
    backgroundColor: '#0D1E30',
    borderRadius: 2,
    overflow: 'hidden',
  },
  statBarFill: {
    height: 4,
    borderRadius: 2,
  },
  statBarValue: {
    color: '#fff',
    fontSize: 12 * scale,
    fontWeight: '800',
    minWidth: 24,
    textAlign: 'right',
  },
  statBarValueText: {
    color: '#C5D0DC',
    fontWeight: '600',
    fontSize: 11 * scale,
  },

  /* ── Compétitions chips ── */
  compList: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 6,
    paddingLeft: 8,
  },
  compChip: {
    paddingHorizontal: 10 * scale,
    paddingVertical: 5 * scale,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1A2D45',
    backgroundColor: '#010914',
  },
  compChipSelected: {
    borderColor: '#3A8FC7',
    backgroundColor: '#011A35',
  },
  compChipText: {
    color: '#C5D0DC',
    fontSize: 12 * scale,
    textAlign: 'right',
  },
  compChipTextSelected: {
    color: '#3A8FC7',
    fontWeight: '700',
  },
});

export default ProfileScreen;
