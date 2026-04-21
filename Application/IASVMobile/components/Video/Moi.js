import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';

const STATS_SECTIONS = [
  {
    title: 'Général',
    icon: 'futbol-o',
    stats: [
      { key: 'poste', label: 'Poste', placeholder: 'Ex: Milieu offensif' },
      { key: 'numero', label: 'Numéro', placeholder: 'Ex: 10', keyboardType: 'numeric' },
      { key: 'tempsJeu', label: 'Temps de jeu (min)', placeholder: '0', keyboardType: 'numeric' },
      { key: 'note', label: 'Note /10', placeholder: '0', keyboardType: 'numeric' },
    ],
  },
  {
    title: 'Attaque',
    icon: 'bullseye',
    stats: [
      { key: 'buts', label: 'Buts', placeholder: '0', keyboardType: 'numeric' },
      { key: 'passesDecisives', label: 'Passes décisives', placeholder: '0', keyboardType: 'numeric' },
      { key: 'tirs', label: 'Tirs', placeholder: '0', keyboardType: 'numeric' },
      { key: 'tirsCadres', label: 'Tirs cadrés', placeholder: '0', keyboardType: 'numeric' },
      { key: 'dribles', label: 'Dribbles réussis', placeholder: '0', keyboardType: 'numeric' },
    ],
  },
  {
    title: 'Passes',
    icon: 'exchange',
    stats: [
      { key: 'passes', label: 'Passes totales', placeholder: '0', keyboardType: 'numeric' },
      { key: 'passesReussies', label: 'Passes réussies', placeholder: '0', keyboardType: 'numeric' },
      { key: 'centres', label: 'Centres', placeholder: '0', keyboardType: 'numeric' },
      { key: 'passesLongues', label: 'Passes longues', placeholder: '0', keyboardType: 'numeric' },
    ],
  },
  {
    title: 'Défense',
    icon: 'shield',
    stats: [
      { key: 'tacles', label: 'Tacles', placeholder: '0', keyboardType: 'numeric' },
      { key: 'taclesReussis', label: 'Tacles réussis', placeholder: '0', keyboardType: 'numeric' },
      { key: 'interceptions', label: 'Interceptions', placeholder: '0', keyboardType: 'numeric' },
      { key: 'ballonsRecuperes', label: 'Ballons récupérés', placeholder: '0', keyboardType: 'numeric' },
      { key: 'degagements', label: 'Dégagements', placeholder: '0', keyboardType: 'numeric' },
    ],
  },
  {
    title: 'Physique',
    icon: 'bolt',
    stats: [
      { key: 'distanceParcourue', label: 'Distance parcourue (km)', placeholder: '0.00', keyboardType: 'decimal-pad' },
      { key: 'sprints', label: 'Sprints', placeholder: '0', keyboardType: 'numeric' },
      { key: 'duelsGagnes', label: 'Duels gagnés', placeholder: '0', keyboardType: 'numeric' },
      { key: 'duelsAeriens', label: 'Duels aériens gagnés', placeholder: '0', keyboardType: 'numeric' },
    ],
  },
  {
    title: 'Discipline',
    icon: 'bookmark',
    stats: [
      { key: 'fautes', label: 'Fautes commises', placeholder: '0', keyboardType: 'numeric' },
      { key: 'fautesSubies', label: 'Fautes subies', placeholder: '0', keyboardType: 'numeric' },
      { key: 'cartonJaune', label: 'Carton jaune', placeholder: '0', keyboardType: 'numeric' },
      { key: 'cartonRouge', label: 'Carton rouge', placeholder: '0', keyboardType: 'numeric' },
      { key: 'horsJeu', label: 'Hors-jeu', placeholder: '0', keyboardType: 'numeric' },
    ],
  },
];

const Moi = React.memo(() => {
  const [stats, setStats] = useState({});
  const [expandedSections, setExpandedSections] = useState({ Général: true });

  const updateStat = useCallback((key, value) => {
    setStats((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleSection = useCallback((title) => {
    setExpandedSections((prev) => ({ ...prev, [title]: !prev[title] }));
  }, []);

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerCard}>
        <View style={styles.headerIconWrapper}>
          <Icon name="user" size={24} color="#FFFFFF" />
        </View>
        <Text style={styles.headerTitle}>Mes stats du match</Text>
        <Text style={styles.headerSubtitle}>
          Renseigne tes statistiques personnelles
        </Text>
      </View>

      {STATS_SECTIONS.map((section) => {
        const isExpanded = expandedSections[section.title];
        return (
          <View key={section.title} style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => toggleSection(section.title)}
              activeOpacity={0.7}
            >
              <View style={styles.sectionLeft}>
                <Icon name={section.icon} size={14} color="#A8B4C0" />
                <Text style={styles.sectionTitle}>{section.title}</Text>
              </View>
              <Icon
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={12}
                color="#808080"
              />
            </TouchableOpacity>

            {isExpanded && (
              <View style={styles.sectionBody}>
                {section.stats.map((stat, idx) => (
                  <View
                    key={stat.key}
                    style={[styles.statRow, idx % 2 === 0 && styles.statRowEven]}
                  >
                    <Text style={styles.statLabel}>{stat.label}</Text>
                    <TextInput
                      style={styles.statInput}
                      value={stats[stat.key] || ''}
                      onChangeText={(val) => updateStat(stat.key, val)}
                      placeholder={stat.placeholder}
                      placeholderTextColor="#555"
                      keyboardType={stat.keyboardType || 'default'}
                      returnKeyType="done"
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 12,
  },
  headerCard: {
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 8,
  },
  headerIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: '#A8B4C0',
    fontSize: 12,
  },
  section: {
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  sectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionBody: {
    paddingHorizontal: 4,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  statRowEven: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  statLabel: {
    color: '#A8B4C0',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  statInput: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
    minWidth: 80,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  bottomSpacer: {
    height: 40,
  },
});

export default Moi;
