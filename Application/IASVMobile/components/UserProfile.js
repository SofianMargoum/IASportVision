import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';

const UserProfile = ({ user, onLogout }) => {
  return (
    <View style={styles.container}>
      {user.photo && <Image source={{ uri: user.photo }} style={styles.profileImage} />}
      <Text style={styles.title}>Bonjour, {user.name}</Text>
      <Text style={styles.email}>{user.email}</Text>

      <View style={styles.buttonsContainer}>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.squareButton}>
            <Image source={require('../assets/list.png')} style={styles.iconImage} />
            <Text style={styles.logoutBtnTexts}>Effectif</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.squareButton}>
            <Image source={require('../assets/stade.png')} style={styles.iconImage} />
            <Text style={styles.logoutBtnTexts}>Composition</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.squareButton}>
            <Image source={require('../assets/stat.png')} style={styles.iconImage} />
            <Text style={styles.logoutBtnTexts}>Statistiques</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.squareButton}>
            <Image source={require('../assets/cam.png')} style={styles.iconImage} />
            <Text style={styles.logoutBtnTexts}>Appareils</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
        <Text style={styles.logoutBtnText}>Se déconnecter</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    height: '100%',
  },
  profileImage: {
    width: 50,
    height: 50,
    marginTop: 20,
    borderRadius: 50,
    marginBottom: 15,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  email: {
    fontSize: 12,
    color: '#aaa',
    marginBottom: 20,
  },
  buttonsContainer: {
    marginVertical: 50,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    width: '80%',
    alignSelf: 'center',
  },
  squareButton: {
    width: '47%', // Augmenté pour occuper plus d'espace
    aspectRatio: 1, // Conserve la forme carrée
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#001A31',
    borderRadius: 10,
    shadowColor: '#00A0E9',
    shadowOpacity: 1,
    elevation: 3,
    justifyContent: 'flex-end',
    backgroundColor: '#010914',
  },
  iconImage: {
    width: 50, // Taille augmentée
    height: 50,
    marginBottom: 10, // Espacement ajusté
  },
  logoutBtn: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 15,
    justifyContent: 'flex-end',
    flex: 1, 
  },
  logoutBtnText: {
    padding: 15,
    borderWidth: 1,
    borderColor: '#001A31',
    alignItems: 'center',
    borderRadius: 10,
    shadowColor: '#00A0E9',
    shadowOpacity: 1,
    elevation: 3,
    justifyContent: 'flex-end',
    backgroundColor: '#010914',
    width: '100%',
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  logoutBtnTexts: {
    padding: 15,
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: '#010914',
    width: '100%',
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default UserProfile;
