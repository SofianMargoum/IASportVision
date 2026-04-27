import React, { useEffect } from 'react';
import { BackHandler, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import FaIcon from 'react-native-vector-icons/FontAwesome';
import Boutique from '../Video/Boutique';

const scale = 0.85;

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
        <Text style={styles.title}>Boutique</Text>
        <View style={{ width: 30 }} />
      </View>
      <View style={styles.content}>
        <Boutique />
      </View>

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
    padding: 16 * scale,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
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
  content: {
    flex: 1,
    paddingBottom: 70,
  },

  discoverCta: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#010914',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  discoverCtaText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14 * scale,
  },
});

export default BoutiqueScreen;
