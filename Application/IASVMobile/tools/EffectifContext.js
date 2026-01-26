import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

const EffectifContext = createContext();

export const EffectifProvider = ({ children }) => {
  const [effectif, setEffectif] = useState([]);

  // Charger les joueurs depuis le stockage local
  useEffect(() => {
    const loadEffectif = async () => {
      try {
        const data = await AsyncStorage.getItem('@effectif');
        if (data) {
          setEffectif(JSON.parse(data));
        } else {
          setEffectif([]); // ✅ Aucun joueur par défaut
        }
      } catch (error) {
        console.error('Erreur de chargement de l’effectif :', error);
      }
    };
    loadEffectif();
  }, []);

  // Sauvegarde automatique dans AsyncStorage
  useEffect(() => {
    const saveEffectif = async () => {
      try {
        await AsyncStorage.setItem('@effectif', JSON.stringify(effectif));
      } catch (error) {
        console.error('Erreur de sauvegarde de l’effectif :', error);
      }
    };
    saveEffectif();
  }, [effectif]);

  // Ajouter un joueur (avec vérif + tri croissant)
  const addPlayer = (nom, numero) => {
    if (!nom.trim() || !numero) return;

    setEffectif((prev) => {
      // Vérifie l'unicité du numéro
      const numeroExiste = prev.some((p) => p.numero === Number(numero));
      if (numeroExiste) {
        Alert.alert(
          'Numéro déjà utilisé',
          `Le numéro ${numero} est déjà attribué à un autre joueur.`
        );
        return prev;
      }

      // Ajoute le joueur et trie la liste par numéro
      const updated = [...prev, { joueur: nom.trim(), numero: Number(numero) }];
      return updated.sort((a, b) => a.numero - b.numero);
    });
  };

  // Supprimer un joueur
  const removePlayer = (index) => {
    setEffectif((prev) => prev.filter((_, i) => i !== index));
  };

  // Modifier un joueur existant (et re-trier si changement de numéro)
  const updatePlayer = (index, nouveauNom, nouveauNumero) => {
    setEffectif((prev) => {
      const numeroExiste = prev.some(
        (p, i) => i !== index && p.numero === Number(nouveauNumero)
      );
      if (numeroExiste) {
        Alert.alert(
          'Numéro déjà utilisé',
          `Le numéro ${nouveauNumero} est déjà attribué à un autre joueur.`
        );
        return prev;
      }

      const next = [...prev];
      next[index] = {
        joueur: nouveauNom.trim() || next[index].joueur,
        numero: Number(nouveauNumero) || next[index].numero,
      };

      // ✅ Trie après modification
      return next.sort((a, b) => a.numero - b.numero);
    });
  };

  return (
    <EffectifContext.Provider
      value={{ effectif, addPlayer, removePlayer, updatePlayer }}
    >
      {children}
    </EffectifContext.Provider>
  );
};

export const useEffectifContext = () => useContext(EffectifContext);
