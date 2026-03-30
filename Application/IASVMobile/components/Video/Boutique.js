import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';

const { width } = Dimensions.get('window');
const scale = 0.85;

const PRODUCTS = [
  // ✅ CLUBS (B2B)
  {
    id: 'club-1',
    target: 'clubs',
    name: 'Pack Caméra IA Sport (Club)',
    price: '1990€',
    description: 'Caméra 4K + Installation + Application IA Sport Vision',
    image: require('../../assets/cover.png'),
    cta: 'Demander un devis',
  },
  {
    id: 'club-2',
    target: 'clubs',
    name: 'Option Multi-Caméras (Stade)',
    price: 'Sur devis',
    description: 'Installation multi-angles + configuration avancée',
    image: require('../../assets/cover.png'),
    cta: 'Être rappelé',
  },
  {
    id: 'club-3',
    target: 'clubs',
    name: 'Abonnement Club Pro',
    price: 'À partir de 99€/mois',
    description: 'Stockage, accès staff, partage, exports, gestion club',
    image: require('../../assets/cover.png'),
    cta: 'Choisir',
  },

  // ✅ JOUEURS
  {
    id: 'player-1',
    target: 'players',
    name: 'Abonnement Joueur',
    price: '4,99€/mois',
    description: 'Accès à tes matchs, clips, moments forts, partage',
    image: require('../../assets/cover.png'),
    cta: 'S’abonner',
  },
  {
    id: 'player-2',
    target: 'players',
    name: 'Pack Highlights',
    price: '9,99€',
    description: 'Montage automatique des meilleurs moments d’un match',
    image: require('../../assets/cover.png'),
    cta: 'Acheter',
  },
  {
    id: 'player-3',
    target: 'players',
    name: 'Profil Joueur Premium',
    price: '2,99€/mois',
    description: 'Stats, vitrine, liens, exports, visibilité',
    image: require('../../assets/cover.png'),
    cta: 'Activer',
  },

  // ✅ SUPPORTERS
  {
    id: 'fan-1',
    target: 'supporters',
    name: 'Pass Supporter (Club)',
    price: '2,99€/mois',
    description: 'Accès aux matchs du club, replays, meilleurs moments',
    image: require('../../assets/cover.png'),
    cta: 'Prendre le pass',
  },
  {
    id: 'fan-2',
    target: 'supporters',
    name: 'Replay à l’unité',
    price: '0,99€',
    description: 'Accès à un match complet (replay) à l’unité',
    image: require('../../assets/cover.png'),
    cta: 'Acheter',
  },
  {
    id: 'fan-3',
    target: 'supporters',
    name: 'Dons au club',
    price: 'Libre',
    description: 'Soutenir le club (matériel, déplacement, jeunes)',
    image: require('../../assets/cover.png'),
    cta: 'Soutenir',
  },
];

const ProductCard = ({ item, onPress }) => {
  return (
    <View style={styles.card}>
      <Image source={item.image} style={styles.image} resizeMode="cover" />

      <View style={styles.cardContent}>
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={styles.productDescription}>{item.description}</Text>
        <Text style={styles.productPrice}>{item.price}</Text>

        <TouchableOpacity style={styles.ctaButton} activeOpacity={0.85} onPress={() => onPress(item)}>
          <Icon name="shopping-cart" size={14} color="#ffffff" />
          <Text style={styles.ctaText}>{item.cta || 'Commander'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const Boutique = () => {
  const [activeTarget, setActiveTarget] = useState('clubs'); // 'clubs' | 'players' | 'supporters'

  const filtered = useMemo(() => {
    return PRODUCTS.filter((p) => p.target === activeTarget);
  }, [activeTarget]);



  const handleProductPress = (item) => {
    // ✅ À brancher plus tard : navigation, modal, lien checkout, contact, etc.
    // Pour l’instant on ne fait rien pour rester “safe” et éviter les erreurs.
    // console.log('Selected product:', item);
  };

  return (
    <View style={styles.container}>
      {/* ✅ 3 segments (style identique à tes tabs) */}
      <View style={styles.segmentHeader}>
        <TouchableOpacity
          style={[styles.segmentButton, activeTarget === 'clubs' && styles.segmentButtonActive]}
          onPress={() => setActiveTarget('clubs')}
          activeOpacity={0.85}
        >
          <Text style={[styles.segmentText, activeTarget === 'clubs' && styles.segmentTextActive]}>
            Clubs
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentButton, activeTarget === 'players' && styles.segmentButtonActive]}
          onPress={() => setActiveTarget('players')}
          activeOpacity={0.85}
        >
          <Text style={[styles.segmentText, activeTarget === 'players' && styles.segmentTextActive]}>
            Joueurs
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentButton, activeTarget === 'supporters' && styles.segmentButtonActive]}
          onPress={() => setActiveTarget('supporters')}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.segmentText,
              activeTarget === 'supporters' && styles.segmentTextActive,
            ]}
          >
            Supporters
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ProductCard item={item} onPress={handleProductPress} />}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

export default Boutique;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#010914',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  headerTitle: {
    fontSize: 20 * scale,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
  },


  // ✅ Segments
  segmentHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#010E1E',
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 14,
  },
  segmentButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  segmentButtonActive: {
    // ne change pas ton style : on garde juste texte blanc, pas de couleur flash
  },
  segmentText: {
    color: '#808080',
    fontWeight: '700',
    fontSize: 14,
  },
  segmentTextActive: {
    color: '#ffffff',
  },

  listContainer: {
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#010E1E',
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  image: {
    width: '100%',
    height: width * 0.45,
  },
  cardContent: {
    padding: 16,
  },
  productName: {
    fontSize: 18 * scale,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  productDescription: {
    fontSize: 14 * scale,
    color: '#CCCCCC',
    marginBottom: 10,
  },
  productPrice: {
    fontSize: 16 * scale,
    fontWeight: '700',
    color: '#00A0E9',
    marginBottom: 12,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00A0E9',
    paddingVertical: 10,
    borderRadius: 999,
  },
  ctaText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14 * scale,
    marginLeft: 8,
  },
});