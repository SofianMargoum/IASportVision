import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import Appareil from './Appareils'; // Import du composant Appareil
import Effectif from './Effectif'; // Import du composant Effectif
import Composition from './Composition'; // Import du composant Composition
import Statistiques from './Statistiques'; // Import du composant Statistiques

const UserProfile = ({ user, onLogout }) => {
  const [activeComponent, setActiveComponent] = useState(null); // État pour afficher les composants dynamiques

  const renderActiveComponent = () => {
    switch (activeComponent) {
      case 'Appareils':
        return <Appareil onBack={() => setActiveComponent(null)} />;
      case 'Effectif':
        return <Effectif onBack={() => setActiveComponent(null)} />;
      case 'Composition':
        return <Composition onBack={() => setActiveComponent(null)} />;
      case 'Statistiques':
        return <Statistiques onBack={() => setActiveComponent(null)} />;
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {!activeComponent ? (
        <>
          <View style={styles.header}>
            {user.photo && <Image source={{ uri: user.photo }} style={styles.profileImage} />}
            <Text style={styles.title}>{user.name}</Text>
            <Text style={styles.email}>{user.email}</Text>
          </View>
          <View style={styles.buttonsContainer}>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.squareButton}
                onPress={() => setActiveComponent('Effectif')} // Afficher Effectif
              >
                <Image source={require('../../assets/list.png')} style={styles.iconImage} />
                <Text style={styles.logoutBtnTexts}>Effectif</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.squareButton}
                onPress={() => setActiveComponent('Composition')} // Afficher Composition
              >
                <Image source={require('../../assets/stade.png')} style={styles.iconImage} />
                <Text style={styles.logoutBtnTexts}>Composition</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.squareButton}
                onPress={() => setActiveComponent('Statistiques')} // Afficher Statistiques
              >
                <Image source={require('../../assets/stat.png')} style={styles.iconImage} />
                <Text style={styles.logoutBtnTexts}>Statistiques</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.squareButton}
                onPress={() => setActiveComponent('Appareils')} // Afficher Appareils
              >
                <Image source={require('../../assets/cam.png')} style={styles.iconImage} />
                <Text style={styles.logoutBtnTexts}>Appareils</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.logoutBtn}>
            <TouchableOpacity style={styles.logoutBtncont} onPress={onLogout}>
              <Text style={styles.logoutBtnText}>Se déconnecter</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        renderActiveComponent() // Afficher le composant actif
      )}
    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    height:'100%', // Utilisez flex: 1 pour remplir toute la hauteur disponible.
    justifyContent: 'space-between', // Assure que les éléments sont répartis avec de l'espace entre eux.
    alignItems: 'center',
    width:'100%',
  },
  profileImage: {
    width: 50,
    height: 50,
    marginTop: 20,
    borderRadius: 50,
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

  header: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',// Ajoute un espace vertical autour du bouton.
  },
  logoutBtn: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end', // Ajoute un espace vertical autour du bouton.
  },
  logoutBtncont: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 5, // Facultatif, pour arrondir les bords.
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
