const express = require('express');
const router = express.Router();

try {
  const { Pool } = require('pg'); // Assurez-vous que pg est installé
  let pool;
  try {
    // Initialisation de la connexion PostgreSQL avec gestion des erreurs
    pool = new Pool({
      host: '34.163.248.199', // Adresse de votre serveur PostgreSQL
      user: 'postgres', // Nom d'utilisateur de la base de données
      password: 'iasportvision2025', // Mot de passe de la base de données
      database: 'postgres', // Nom de la base de données
      host: `/cloudsql/ia-sport:europe-west9:ia-sport-vision`, // Remplacez par le nom de connexion
    });

    // Test de connexion à PostgreSQL
    (async () => {
      try {
        const client = await pool.connect();
        console.log('Connexion réussie à la base de données PostgreSQL');
        client.release(); // Libère la connexion après le test
      } catch (err) {
        console.error('Erreur lors de la connexion à la base de données PostgreSQL :', err.message);
        console.error(err.stack);
      }
    })();
  } catch (error) {
    console.error('Erreur lors de l\'initialisation du pool PostgreSQL :', error.message);
    console.error(error.stack);
  }

  // Route pour récupérer les données de la table 'device' avec une condition sur 'nom'
  router.get('/device', async (req, res) => {
    if (!pool) {
      console.error('Le pool PostgreSQL n\'a pas été initialisé.');
      return res.status(500).json({
        message: 'Le pool PostgreSQL n\'a pas été initialisé.',
      });
    }

    try {
      // Vérifier si un paramètre "nom" est fourni
      const { nom } = req.query;
      let query = 'SELECT * FROM device';
      const values = [];

      if (nom) {
        query += ' WHERE nom = $1';
        values.push(nom);
      }

      const result = await pool.query(query, values);
      res.status(200).json(result.rows); // PostgreSQL retourne les données dans la propriété rows
    } catch (error) {
      console.error('Erreur lors de la récupération des données :', error.message);
      console.error(error.stack);
      res.status(500).json({
        message: 'Erreur lors de la récupération des données.',
        error: error.message,
      });
    }
  });

  // Middleware global pour capturer les erreurs non gérées
  router.use((err, req, res, next) => {
    console.error('Erreur générale dans le service device :', err.message);
    console.error(err.stack);
    res.status(500).json({
      message: 'Erreur générale dans le service device.',
      error: err.message,
    });
  });

} catch (error) {
  // Route pour afficher un message "Hello World"
  router.get('/device', (req, res) => {
    res.status(200).json({ message: 'device error last' });
  });
}

module.exports = router;
