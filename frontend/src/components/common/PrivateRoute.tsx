import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

type AppRole =
  | 'student'
  | 'teacher'
  | 'teaching_assistant'
  | 'department_admin'
  | 'registrar'
  | 'admin'
  | 'platform_admin';

interface PrivateRouteProps {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}

export function PrivateRoute({ children, allowedRoles }: PrivateRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role as AppRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
