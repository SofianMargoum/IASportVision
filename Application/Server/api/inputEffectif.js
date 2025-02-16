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
        console.log('Connexion réussie à la base de données PostgreSQL pour inputEffectif');
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

	// Route pour ajouter un joueur à la table 'effectif'
	router.post('/inputEffectif', async (req, res) => {
	  if (!pool) {
		console.error('Le pool PostgreSQL n\'a pas été initialisé.');
		return res.status(500).json({
		  message: 'Le pool PostgreSQL n\'a pas été initialisé.',
		});
	  }

	  try {
		const { nom, equipe, joueur } = req.body;

		// Vérifier si les données nécessaires sont fournies
		if (!nom || !equipe || !joueur) {
		  return res.status(400).json({
			message: 'Les champs "nom", "equipe" et "joueur" sont requis.',
		  });
		}

		const query = 'INSERT INTO effectif (nom, equipe, joueur) VALUES ($1, $2, $3) RETURNING *';
		const values = [nom, equipe, joueur];

		const result = await pool.query(query, values);

		res.status(201).json({
		  message: 'Joueur ajouté avec succès.',
		  joueur: result.rows[0], // Retourne le joueur ajouté
		});
	  } catch (error) {
		console.error('Erreur lors de l\'ajout du joueur :', error.message);
		console.error(error.stack);
		res.status(500).json({
		  message: 'Erreur lors de l\'ajout du joueur.',
		  error: error.message,
		});
	  }
	});


  // Middleware global pour capturer les erreurs non gérées
  router.use((err, req, res, next) => {
    console.error('Erreur générale dans le service inputEffectif :', err.message);
    console.error(err.stack);
    res.status(500).json({
      message: 'Erreur générale dans le service inputEffectif.',
      error: err.message,
    });
  });
} catch (error) {
  // Route pour afficher un message en cas d'erreur
  router.get('/inputEffectif', (req, res) => {
    res.status(200).json({ message: 'inputEffectif error last' });
  });
}

module.exports = router;
