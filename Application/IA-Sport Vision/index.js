/**
 * @format
 */
 
import { AppRegistry } from 'react-native';
import App from './App'; // Assurez-vous que ce chemin pointe vers votre fichier App.js
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);