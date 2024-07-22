import React, { useEffect } from 'react';

function Messages() {
  useEffect(() => {
    // Effectuer des actions lorsque ce composant est monté ou lorsque les dépendances changent
    console.log('Messages component mounted or dependencies changed');
  }, []);

  return (
    <div>
      {/* Contenu de la page Messages */}
      <h1>Messages Page</h1>
    </div>
  );
}

export default Messages;
