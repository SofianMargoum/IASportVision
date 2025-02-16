import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const Composition = ({ onBack }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Composition</Text>
      <Text style={styles.content}>Voici la composition actuelle de l'équipe.</Text>
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>Retour</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  content: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
  },
  backButton: {
    backgroundColor: '#007BFF',
    padding: 10,
    borderRadius: 5,
  },
  backButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default Composition;
