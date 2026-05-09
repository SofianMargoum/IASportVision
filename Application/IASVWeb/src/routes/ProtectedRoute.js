import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canViewPage } from '../utils/permissions';

export default function ProtectedRoute({ children, page, roles }) {
  const { isAuthenticated, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="iasv-fullscreen-loader">Chargement…</div>;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (page && !canViewPage(role, page, true)) {
    return <Navigate to="/dashboard" replace />;
  }
  if (roles && Array.isArray(roles) && roles.length > 0 && role !== 'admin' && !roles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}
