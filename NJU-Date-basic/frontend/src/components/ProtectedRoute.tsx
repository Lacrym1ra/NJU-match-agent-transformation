import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/** Pages accessible before survey is completed */
const SURVEY_BYPASS = new Set(['/survey', '/dashboard', '/settings', '/account', '/forum']);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { authStatus } = useAuth();
  const location = useLocation();

  switch (authStatus) {
    case 'loading':
      return (
        <div className="boot-loading" role="status" aria-live="polite">
          <div className="boot-loading__inner">
            <div className="boot-loading__spinner" aria-hidden="true" />
            <div className="boot-loading__brand">NJU Match</div>
            <div className="boot-loading__text">正在确认身份</div>
          </div>
        </div>
      );

    case 'unauthenticated':
      return <Navigate to="/login" state={{ from: location }} replace />;

    case 'needs_profile':
      if (location.pathname === '/onboarding') return <>{children}</>;
      return <Navigate to="/onboarding" replace />;

    case 'needs_survey':
      if (
        SURVEY_BYPASS.has(location.pathname) || 
        location.pathname.startsWith('/circles') ||
        location.pathname.startsWith('/forum/')
      ) {
        return <>{children}</>;
      }
      return <Navigate to="/survey" replace />;

    case 'ready':
          return <>{children}</>;
      }
    };

export default ProtectedRoute;
