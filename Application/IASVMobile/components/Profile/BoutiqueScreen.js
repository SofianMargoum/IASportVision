import React, { useEffect } from 'react';
import { BackHandler, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
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
  },
});

export default BoutiqueScreen;
