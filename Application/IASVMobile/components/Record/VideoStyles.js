import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const scale = 0.85; // Ajustez cette valeur selon vos besoins

export default StyleSheet.create({
    container: {
        flexGrow: 1, // Allows ScrollView to grow if content is small
        padding: 10,
        backgroundColor: '#010914',
        alignItems: 'center',
      },
      notConnectedContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
      },
      notConnectedText: {
        fontSize: 18,
        color: 'red',
      },
      content: {
        flex: 1,
        backgroundColor: '#010914',
        alignItems: 'center',
      },
      title: {
        fontSize: 24 * scale, // Taille ajustée ici
        color: '#ffffff',
        marginBottom: 20,
        textAlign: 'center',
        fontWeight: 'bold',
      },
      clearButton: {
        marginLeft: 10,
        padding: 5,
        justifyContent: 'center',
        alignItems: 'center',
      },
      clearButtonText: {
        fontSize: 14,
        color: '#ccc',
      },
      topSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingVertical: 10,
        width: '100%', // Make width responsive
        backgroundColor: '#010E1E',
        borderRadius: 15,
      },
      disabledButton: {
        backgroundColor: '#ccc', // Couleur désactivée
        opacity: 0.3, // Rendre visuellement désactivé
      },
      selectedClubInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 8,
        padding: 10,
      },
      selectedClubLogo: {
        width: 30 * scale, // Taille ajustée ici
        height: 30 * scale, // Taille ajustée ici
        marginRight: 10,
        borderRadius: 5,
      },
      selectedClubName: {
        fontSize: 15,
        color: '#ffffff',
        fontWeight: '500',
      },
      placeholderText: {
        color: '#ccc',
        fontSize: 15 * scale, // Taille ajustée ici
      },
      counterContainer: {
        flexDirection: 'column',
        alignItems: 'center',
        borderRadius: 8,
        padding: 10,
      },
      counterButton: {
        padding: 5,
      },
      counterLabel: {
        fontSize: 20 * scale, // Taille ajustée ici
        fontWeight: 'bold',
        color: '#ffffff',
        marginHorizontal: 10,
      },
      inputContainer: {
        marginTop: 20,
      },
      input: {
        color: '#ccc',
        padding: 10,
        fontSize: 16 * scale, // Taille ajustée ici
        borderRadius: 5,
      },
      searchResults: {
        maxHeight: 150,
        borderRadius: 8,
        padding: 10,
      },
      result: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 5,
      },
      resultLogo: {
        width: 30 * scale, // Taille ajustée ici
        height: 30 * scale, // Taille ajustée ici
        marginRight: 10,
        borderRadius: 5,
      },
      resultName: {
        color: '#ffffff',
        fontSize: 16 * scale, // Taille ajustée ici
      },
      timer: {
        marginTop: 20,
        alignItems: 'center',
      },
      timerText: {
        fontSize: 18 * scale, // Taille ajustée ici
        color: '#ffffff',
      },
      message: {
        marginTop: 20,
        alignItems: 'center',
      },
      messageText: {
        color: '#ff4d4d',
      },
      buttonContainer: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'flex-end',
        flex: 1, // Permet de prendre tout l'espace vertical disponible
      },
    
      outerCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 5,
        borderColor: 'black',
        backgroundColor: 'white',
      },
      defaultOuter: {
        borderColor: 'black',
      },
      recordingOuter: {
        borderColor: 'red',
      },
      innerCircle: {
        width: 40,
        height: 40,
        borderRadius: 25,
      },
      defaultInner: {
        backgroundColor: 'red',
      },
      recordingInner: {
        backgroundColor: 'black',
      },
      notConnectedContainer: {
        flex: 1,
        width: '100%',          // ✅ s’étend sur toute la largeur
        height: '100%',         // ✅ prend toute la hauteur de l’écran
        backgroundColor: 'transparent',// facultatif, mais propre
        justifyContent: 'center',
        alignItems: 'center',
      },

    });
    