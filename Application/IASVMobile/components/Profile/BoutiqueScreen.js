import React, { useEffect } from 'react';
import { BackHandler, Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import FaIcon from 'react-native-vector-icons/FontAwesome';
import { moderateScale, scale as s } from './../../tools/responsive';

const ms = moderateScale;

const FEATURES = [
  {
    title: 'Captation automatique',
    desc: 'La caméra suit le ballon et l\'action en temps réel, sans intervention humaine.',
  },
  {
    title: 'Vidéo complète du match',
    desc: 'Récupérez la vidéo intégrale dès la fin de la rencontre, en 4K, prête à être partagée.',
  },
  {
    title: 'Résumés et replays',
    desc: 'Buts, occasions, temps forts : nos algorithmes génèrent un replay exploitable par tous.',
  },
  {
    title: 'Extraits personnalisés',
    desc: 'Chaque joueur peut récupérer ses propres séquences pour progresser ou les partager.',
  },
];

const BoutiqueScreen = ({ onBack }) => {
  useEffect(() => {
    const backAction = () => { onBack?.(); return true; };
    const sub = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => sub.remove();
  }, [onBack]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="arrow-back" size={22} color="#C5D0DC" />
        </TouchableOpacity>
        <Text style={styles.title}>Découvrir</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Image
          source={require('../../assets/camera_installe.png')}
          style={styles.cameraImage}
          resizeMode="contain"
        />

        <View style={styles.badge}>
          <Text style={styles.badgeText}>LA SOLUTION</Text>
        </View>

        <Text style={styles.headline}>Une caméra intelligente, des vidéos prêtes à partager</Text>
        <Text style={styles.subtext}>
          Installez la caméra IA Sport Vision sur votre terrain : la captation se lance automatiquement,
          suit le jeu et produit en quelques minutes la vidéo complète du match, le résumé et les
          meilleurs extraits, sans cameraman.
        </Text>

        <View style={styles.grid}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.featureCard}>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: s(80) }} />
      </ScrollView>

      <TouchableOpacity
        style={styles.discoverCta}
        onPress={() => Linking.openURL('https://iasportvision.com')}
      >
        <Text style={styles.discoverCtaText}>Découvrir iasportvision.com</Text>
        <FaIcon name="external-link" size={14} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: s(16),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: s(12),
    paddingVertical: s(8),
  },
  backBtn: {
    padding: s(4),
  },
  title: {
    flex: 1,
    fontSize: ms(18),
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: s(16),
  },
  cameraImage: {
    width: '100%',
    height: s(200),
    borderRadius: ms(12),
    marginBottom: s(20),
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#0D3660',
    borderRadius: ms(20),
    paddingHorizontal: s(12),
    paddingVertical: s(4),
    marginBottom: s(12),
  },
  badgeText: {
    color: '#5BB8FF',
    fontSize: ms(11),
    fontWeight: '700',
    letterSpacing: 1,
  },
  headline: {
    fontSize: ms(22),
    fontWeight: '800',
    color: '#fff',
    lineHeight: ms(30),
    marginBottom: s(12),
  },
  subtext: {
    fontSize: ms(13),
    color: '#A0B0C0',
    lineHeight: ms(20),
    marginBottom: s(20),
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s(10),
  },
  featureCard: {
    width: '47%',
    backgroundColor: '#0D1F35',
    borderRadius: ms(12),
    padding: s(14),
  },
  featureTitle: {
    fontSize: ms(13),
    fontWeight: '700',
    color: '#fff',
    marginBottom: s(6),
  },
  featureDesc: {
    fontSize: ms(12),
    color: '#A0B0C0',
    lineHeight: ms(18),
  },
  discoverCta: {
    position: 'absolute',
    left: s(16),
    right: s(16),
    bottom: s(12),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(8),
    backgroundColor: '#010914',
    paddingVertical: s(10),
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  discoverCtaText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: ms(14),
  },
});

export default BoutiqueScreen;
