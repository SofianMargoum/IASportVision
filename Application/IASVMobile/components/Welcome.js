import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SearchClub from './Explore/SearchClub';
import { moderateScale, scale as s } from './../tools/responsive';
import { useUserRole } from './../tools/UserRoleContext';
import { SELECTABLE_ROLES } from '../constants/roles';

const STEPS = { ROLE: 'role', CLUB: 'club' };

const Welcome = () => {
  const { role, setRole } = useUserRole();

  // Si le rôle est déjà défini (mais pas le club), on saute directement à l'étape 2.
  const [step, setStep] = useState(role ? STEPS.CLUB : STEPS.ROLE);

  const handleSelectRole = async (selectedKey) => {
    await setRole(selectedKey);
    setStep(STEPS.CLUB);
  };

  const handleBack = () => setStep(STEPS.ROLE);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.backgroundGlow} />

        <View style={styles.header}>
          <Text style={styles.kicker}>IA Sport Vision</Text>
          <Text style={styles.welcomeText}>Bienvenue !</Text>
          <View style={styles.titleUnderline} />
          <Text style={styles.instructionText}>
            {step === STEPS.ROLE
              ? 'Sélectionnez votre profil'
              : 'Sélectionnez votre club'}
          </Text>
        </View>

        {step === STEPS.ROLE && (
          <View style={styles.rolesContainer}>
            {SELECTABLE_ROLES.map((r) => (
              <TouchableOpacity
                key={r.key}
                style={styles.roleCard}
                activeOpacity={0.85}
                onPress={() => handleSelectRole(r.key)}
              >
                <Text style={styles.roleLabel}>{r.label}</Text>
                <Text style={styles.roleDescription}>{r.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === STEPS.CLUB && (
          <>
            <View style={styles.searchContainer}>
              <SearchClub />
            </View>
            <TouchableOpacity
              style={styles.backButton}
              activeOpacity={0.8}
              onPress={handleBack}
            >
              <Text style={styles.backButtonText}>← Précédent</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#010914',
  },
  container: {
    flexGrow: 1,
    backgroundColor: '#010914',
    justifyContent: 'center',
    alignItems: 'center',
    padding: s(20),
  },
  backgroundGlow: {
    position: 'absolute',
    top: -s(120),
    right: -s(80),
    width: s(260),
    height: s(260),
    borderRadius: s(130),
    backgroundColor: 'rgba(0, 153, 255, 0.18)',
  },
  header: {
    width: '100%',
    alignItems: 'center',
    marginBottom: s(24),
  },
  kicker: {
    fontSize: moderateScale(12),
    letterSpacing: 2,
    color: '#7FB6FF',
    marginBottom: s(6),
    fontWeight: '600',
  },
  welcomeText: {
    fontSize: moderateScale(28),
    color: '#FFFFFF',
    fontWeight: '800',
    textAlign: 'center',
  },
  titleUnderline: {
    width: s(64),
    height: 4,
    backgroundColor: '#2F8CFF',
    borderRadius: 2,
    marginTop: s(10),
    marginBottom: s(14),
  },
  instructionText: {
    fontSize: moderateScale(14),
    color: '#C8D4E3',
    textAlign: 'center',
    lineHeight: moderateScale(20),
    paddingHorizontal: s(10),
  },
  rolesContainer: {
    width: '100%',
  },
  roleCard: {
    width: '100%',
    backgroundColor: '#0A1424',
    borderRadius: moderateScale(16),
    padding: s(16),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: s(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  roleLabel: {
    fontSize: moderateScale(18),
    color: '#FFFFFF',
    fontWeight: '700',
    marginBottom: s(4),
  },
  roleDescription: {
    fontSize: moderateScale(13),
    color: '#9FB1C7',
    lineHeight: moderateScale(18),
  },
  searchContainer: {
    width: '100%',
    backgroundColor: '#0A1424',
    borderRadius: moderateScale(16),
    padding: s(14),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  backButton: {
    marginTop: s(18),
    paddingVertical: s(10),
    paddingHorizontal: s(18),
    borderRadius: moderateScale(12),
    borderWidth: 1,
    borderColor: 'rgba(127, 182, 255, 0.4)',
    backgroundColor: 'rgba(47, 140, 255, 0.08)',
  },
  backButtonText: {
    color: '#7FB6FF',
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
});

export default Welcome;