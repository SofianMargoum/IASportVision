import React, { useEffect } from 'react';

function Notifications() {
  useEffect(() => {
    // Effectuer des actions lorsque ce composant est monté ou lorsque les dépendances changent
    console.log('Notifications component mounted or dependencies changed');
  }, []);

  return (
    <div>
      {/* Contenu de la page Notifications */}
      <h1>Notifications Page</h1>
    </div>
  );
}

export default Notifications;