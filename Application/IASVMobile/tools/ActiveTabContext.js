import React, { createContext, useContext, useMemo } from 'react';

const ActiveTabContext = createContext(null);

export const ActiveTabProvider = ({ activeKey, children }) => {
  const value = useMemo(() => ({ activeKey }), [activeKey]);
  return <ActiveTabContext.Provider value={value}>{children}</ActiveTabContext.Provider>;
};

export const useActiveTab = () => {
  const ctx = useContext(ActiveTabContext);
  if (!ctx) throw new Error('useActiveTab must be used within ActiveTabProvider');
  return ctx;
};
