import { StyleSheet } from 'react-native';

const scale = 0.85;

export const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: '#010914',
  },
  header: {
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 5,
    shadowColor: '#00A0E9',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 6,
    elevation: 3,
    backgroundColor: '#010914',
  },
  logoMain: {
    position: 'absolute',
    left: 0,
    opacity: 0.2,
  },
  logo: {
    width: 2500 * scale,
    height: 50 * scale,
    resizeMode: 'contain',
  },
  selectedClubLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15 * scale,
  },
  clubLogo: {
    width: 50 * scale,
    height: 50 * scale,
    borderRadius: 25 * scale,
    marginRight: 15 * scale,
  },
  selectedClubText: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  clubName: {
    fontSize: 18 * scale,
    fontWeight: 'bold',
    color: '#fff',
  },
  competitionLabel: {
    fontSize: 14 * scale,
    fontStyle: 'italic',
    color: '#ffffff',
  },
  tabBarStyle: {
    backgroundColor: '#010E1E',
    borderTopWidth: 0,
    height: 60 * scale,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  iconContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%', // Pour s'assurer que l'icône occupe toute la largeur de son conteneur
    height: '100%', // Pour remplir la hauteur du conteneur
  },
  iconActive: {
    backgroundColor: '#001F3F', // Exemple de fond actif (modifiable selon vos besoins)
    borderRadius: 10, // Exemple pour adoucir les angles
  },
});

export default styles;
