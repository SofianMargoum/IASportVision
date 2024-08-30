import React, { useEffect } from 'react';

function Resultat() {
  useEffect(() => {
    // Effectuer des actions lorsque ce composant est monté ou lorsque les dépendances changent
    console.log('Resultat component mounted or dependencies changed');
  }, []);

  return (
    <div>
      {/* Contenu de la page Resultat */}
      <h1>Resultat Page</h1>
    </div>
  );
}

export default Resultat;
