import React, { useEffect } from 'react';
import { BackHandler, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import FaIcon from 'react-native-vector-icons/FontAwesome';
import Boutique from '../Video/Boutique';
import { moderateScale, scale as s } from './../../tools/responsive';

const ms = moderateScale;

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
  content: {
    flex: 1,
    paddingBottom: s(70),
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
