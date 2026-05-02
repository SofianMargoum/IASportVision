import React, { useMemo, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  useWindowDimensions,
} from 'react-native';
import PagerView from 'react-native-pager-view';
import { moderateScale, scale as s } from './../../tools/responsive';

const ms = moderateScale;

const TABS = [
  { key: 'clubs', label: 'Clubs', icon: 'shield-outline' },
  { key: 'players', label: 'Joueurs', icon: 'person-outline' },
  { key: 'supporters', label: 'Supporters', icon: 'heart-outline' },
];

const PRODUCTS = [
  // ── CLUBS (B2B) ──
  {
    id: 'club-1',
    target: 'clubs',
    name: 'Pack Caméra IA Sport',
    price: '1 990 €',
    description: 'Caméra 4K + Installation + Application IA Sport Vision',
    image: require('../../assets/cover.png'),
    cta: 'Demander un devis',
    ctaIcon: 'document-text-outline',
    badge: 'Populaire',
  },
  {
    id: 'club-2',
    target: 'clubs',
    name: 'Option Multi-Caméras',
    price: 'Sur devis',
    description: 'Installation multi-angles + configuration avancée stade',
    image: require('../../assets/cover.png'),
    cta: 'Être rappelé',
    ctaIcon: 'call-outline',
  },
  {
    id: 'club-3',
    target: 'clubs',
    name: 'Abonnement Club Pro',
    price: '99 €/mois',
    description: 'Stockage, accès staff, partage, exports, gestion club',
    image: require('../../assets/cover.png'),
    cta: 'Choisir',
    ctaIcon: 'checkmark-circle-outline',
    priceNote: 'À partir de',
  },

  // ── JOUEURS ──
  {
    id: 'player-1',
    target: 'players',
    name: 'Abonnement Joueur',
    price: '4,99 €/mois',
    description: 'Accès à tes matchs, clips, moments forts, partage',
    image: require('../../assets/cover.png'),
    cta: "S'abonner",
    ctaIcon: 'star-outline',
    badge: 'Essentiel',
  },
  {
    id: 'player-2',
    target: 'players',
    name: 'Pack Highlights',
    price: '9,99 €',
    description: "Montage automatique des meilleurs moments d'un match",
    image: require('../../assets/cover.png'),
    cta: 'Acheter',
    ctaIcon: 'film-outline',
  },
  {
    id: 'player-3',
    target: 'players',
    name: 'Profil Joueur Premium',
    price: '2,99 €/mois',
    description: 'Stats, vitrine, liens, exports, visibilité',
    image: require('../../assets/cover.png'),
    cta: 'Activer',
    ctaIcon: 'trophy-outline',
  },

  // ── SUPPORTERS ──
  {
    id: 'fan-1',
    target: 'supporters',
    name: 'Pass Supporter',
    price: '2,99 €/mois',
    description: 'Accès aux matchs du club, replays, meilleurs moments',
    image: require('../../assets/cover.png'),
    cta: 'Prendre le pass',
    ctaIcon: 'ticket-outline',
    badge: 'Fan',
  },
  {
    id: 'fan-2',
    target: 'supporters',
    name: "Replay à l'unité",
    price: '0,99 €',
    description: "Accès à un match complet (replay) à l'unité",
    image: require('../../assets/cover.png'),
    cta: 'Acheter',
    ctaIcon: 'play-circle-outline',
  },
  {
    id: 'fan-3',
    target: 'supporters',
    name: 'Dons au club',
    price: 'Libre',
    description: 'Soutenir le club (matériel, déplacement, jeunes)',
    image: require('../../assets/cover.png'),
    cta: 'Soutenir',
    ctaIcon: 'heart-outline',
  },
];

// ─── Product Card ───

const ProductCard = ({ item, onPress, imageHeight }) => (
  <View style={styles.card}>
    {/* Image + badge */}
    <View style={styles.imageWrap}>
      <Image source={item.image} style={[styles.image, imageHeight && { height: imageHeight }]} resizeMode="cover" />
      {item.badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.badge}</Text>
        </View>
      )}
    </View>

    <View style={styles.cardContent}>
      <Text style={styles.productName}>{item.name}</Text>
      <Text style={styles.productDescription}>{item.description}</Text>

      <View style={styles.priceRow}>
        {item.priceNote && <Text style={styles.priceNote}>{item.priceNote}</Text>}
        <Text style={styles.productPrice}>{item.price}</Text>
      </View>

      <TouchableOpacity
        style={styles.ctaButton}
        activeOpacity={0.7}
        onPress={() => onPress(item)}
      >
        <Text style={styles.ctaText}>{item.cta || 'Commander'}</Text>
      </TouchableOpacity>
    </View>
  </View>
);

// ─── Main ───

const ProductList = ({ target, onPress, imageHeight }) => {
  const filtered = useMemo(
    () => PRODUCTS.filter((p) => p.target === target),
    [target],
  );
  return (
    <FlatList
      data={filtered}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <ProductCard item={item} onPress={onPress} imageHeight={imageHeight} />
      )}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );
};

const Boutique = () => {
  const { width } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const pagerRef = useRef(null);

  const handleTabPress = useCallback((index) => {
    setActiveIndex(index);
    pagerRef.current?.setPage(index);
  }, []);

  const handlePageSelected = useCallback((e) => {
    setActiveIndex(e.nativeEvent.position);
  }, []);

  const handleProductPress = (item) => {
    // TODO: navigation, modal, lien checkout, contact…
  };

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabBar}>
        {TABS.map((tab, index) => {
          const active = activeIndex === index;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => handleTabPress(index)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Swipeable pages */}
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={handlePageSelected}
      >
        {TABS.map((tab) => (
          <View key={tab.key} style={styles.page}>
            <ProductList target={tab.key} onPress={handleProductPress} imageHeight={width * 0.35} />
          </View>
        ))}
      </PagerView>
    </View>
  );
};

export default Boutique;

// ═══════════════════════════════════════
// ─── Styles ───
// ═══════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },

  // ── Tabs ──
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#010E1E',
    borderRadius: ms(10),
    borderWidth: 1,
    borderColor: '#1A2D45',
    padding: s(4),
    marginBottom: s(14),
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: s(10),
    borderRadius: ms(8),
    gap: s(5),
  },
  tabActive: {
    backgroundColor: '#1A2D45',
  },
  tabText: {
    color: '#607D8B',
    fontWeight: '700',
    fontSize: ms(12),
  },
  tabTextActive: {
    color: '#fff',
  },

  // ── List ──
  listContent: {
    paddingBottom: s(30),
  },

  // ── Card ──
  card: {
    backgroundColor: '#010E1E',
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: '#1A2D45',
    overflow: 'hidden',
    marginBottom: s(12),
  },
  imageWrap: {
    position: 'relative',
  },
  image: {
    width: '100%',
  },
  badge: {
    position: 'absolute',
    top: s(10),
    right: s(10),
    backgroundColor: 'rgba(26,45,69,0.9)',
    borderRadius: ms(6),
    paddingHorizontal: s(8),
    paddingVertical: s(4),
  },
  badgeText: {
    color: '#fff',
    fontSize: ms(10),
    fontWeight: '700',
  },

  cardContent: {
    padding: s(14),
  },
  productName: {
    fontSize: ms(15),
    fontWeight: '700',
    color: '#fff',
    marginBottom: s(4),
  },
  productDescription: {
    fontSize: ms(12),
    color: '#607D8B',
    marginBottom: s(10),
    lineHeight: ms(17),
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: s(12),
    gap: s(4),
  },
  priceNote: {
    color: '#607D8B',
    fontSize: ms(10),
  },
  productPrice: {
    fontSize: ms(17),
    fontWeight: '800',
    color: '#fff',
  },

  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A2D45',
    paddingVertical: s(11),
    borderRadius: ms(8),
    gap: s(6),
  },
  ctaText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: ms(13),
  },
});
