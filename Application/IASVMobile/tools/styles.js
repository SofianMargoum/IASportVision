import { StyleSheet } from 'react-native';
import { moderateScale, scale as s } from './responsive';

const ms = moderateScale;

export const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: '#010914',
  },
  header: {
    padding: s(10),
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: s(5),
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
    width: ms(2500),
    height: ms(50),
    resizeMode: 'contain',
  },
  selectedClubLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: s(15),
  },
  clubLogo: {
    width: ms(50),
    height: ms(50),
    borderRadius: ms(25),
    marginRight: s(15),
  },
  selectedClubText: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  clubName: {
    fontSize: ms(18),
    fontWeight: 'bold',
    color: '#fff',
  },
  competitionLabel: {
    fontSize: ms(14),
    fontStyle: 'italic',
    color: '#ffffff',
  },
  tabBarStyle: {
    backgroundColor: '#010E1E',
    borderTopWidth: 0,
    height: ms(60),
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
    borderRadius: ms(10), // Exemple pour adoucir les angles
  },
});

export default styles;
