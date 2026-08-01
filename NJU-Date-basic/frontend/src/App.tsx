import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigationType } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ToastProvider } from './components/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import NotificationBell from './components/NotificationBell';

const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Survey = lazy(() => import('./pages/Survey'));
const Reveal = lazy(() => import('./pages/Reveal'));
const Heartbox = lazy(() => import('./pages/Heartbox'));
const HeartboxReveal = lazy(() => import('./pages/HeartboxReveal'));
const StudentIdBind = lazy(() => import('./pages/StudentIdBind'));
const Settings = lazy(() => import('./pages/Settings'));
const CardBuilder = lazy(() => import('./pages/CardBuilder'));
const CircleDetail = lazy(() => import('./pages/CircleDetail'));
const AccountSettings = lazy(() => import('./pages/AccountSettings'));
const About = lazy(() => import('./pages/About'));
const Changelog = lazy(() => import('./pages/Changelog'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Admin = lazy(() => import('./pages/Admin'));
const PersonalityTest = lazy(() => import('./pages/PersonalityTest'));
const PersonalityResult = lazy(() => import('./pages/PersonalityResult'));
const CircleHome = lazy(() => import('./pages/CircleHome').then((module) => ({ default: module.CircleHome })));
const CircleManage = lazy(() => import('./pages/CircleManage'));
const CircleTeamHall = lazy(() => import('./pages/CircleTeamHall'));
const CircleLiveChat = lazy(() => import('./pages/CircleLiveChat'));
const TeamUpDetail = lazy(() => import('./pages/TeamUpDetail'));
const CreateTeamUp = lazy(() => import('./pages/CreateTeamUp'));
const Forum = lazy(() => import('./pages/Forum'));
const ForumPost = lazy(() => import('./pages/ForumPost'));
const ForumRanking = lazy(() => import('./pages/ForumRanking'));
const NotificationCenter = lazy(() => import('./pages/NotificationCenter'));
const Guestbook = lazy(() => import('./pages/Guestbook'));
const UserProfile = lazy(() => import('./pages/UserProfile'));
const Messages = lazy(() => import('./pages/Messages'));
const FollowList = lazy(() => import('./pages/FollowList'));
const Agent = lazy(() => import('./pages/Agent'));

function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  useEffect(() => {
    // Don't reset scroll on back/forward (POP) — let the page handle its own restoration
    if (navigationType === 'POP') return;
    window.scrollTo(0, 0);
  }, [pathname, navigationType]);
  return null;
}

function PageLoading() {
  return (
    <div className="boot-loading" role="status" aria-live="polite">
      <div className="boot-loading__inner">
        <div className="boot-loading__spinner" aria-hidden="true" />
        <div className="boot-loading__brand">NJU Match</div>
        <div className="boot-loading__text">正在打开</div>
      </div>
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
    <AuthProvider>
      <NotificationProvider>
      <Router>
        <ScrollToTop />
        <NotificationBell />
        <Suspense fallback={<PageLoading />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/about" element={<About />} />
            <Route path="/personality-test" element={<PersonalityTest />} />
            <Route path="/personality-result" element={<PersonalityResult />} />
            <Route path="/changelog" element={<Changelog />} />
            <Route path="/privacy" element={<Privacy />} />

            {/* Protected routes */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/agent" element={<ProtectedRoute><Agent /></ProtectedRoute>} />
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/survey" element={<ProtectedRoute><Survey /></ProtectedRoute>} />
            <Route path="/reveal" element={<ProtectedRoute><Reveal /></ProtectedRoute>} />
            <Route path="/heartbox" element={<ProtectedRoute><Heartbox /></ProtectedRoute>} />
            <Route path="/heartbox/reveal" element={<ProtectedRoute><HeartboxReveal /></ProtectedRoute>} />
            <Route path="/student-id/bind" element={<ProtectedRoute><StudentIdBind /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/settings/card" element={<ProtectedRoute><CardBuilder /></ProtectedRoute>} />
            <Route path="/account" element={<ProtectedRoute><AccountSettings /></ProtectedRoute>} />

            <Route path="/circles" element={<ProtectedRoute><CircleHome /></ProtectedRoute>} />
            <Route path="/circles/:id" element={<ProtectedRoute><CircleDetail /></ProtectedRoute>} />
            <Route path="/circles/:id/manage" element={<ProtectedRoute><CircleManage /></ProtectedRoute>} />
            <Route path="/circles/:id/teamups" element={<ProtectedRoute><CircleTeamHall /></ProtectedRoute>} />
            <Route path="/circles/:id/livechat" element={<ProtectedRoute><CircleLiveChat /></ProtectedRoute>} />
            <Route path="/circles/:id/create-teamup" element={<ProtectedRoute><CreateTeamUp /></ProtectedRoute>} />
            <Route path="/circles/:id/teamups/:teamupId" element={<ProtectedRoute><TeamUpDetail /></ProtectedRoute>} />
            <Route path="/forum" element={<ProtectedRoute><Forum /></ProtectedRoute>} />
            <Route path="/forum/ranking" element={<ProtectedRoute><ForumRanking /></ProtectedRoute>} />
            <Route path="/forum/guestbook" element={<ProtectedRoute><Guestbook /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><NotificationCenter /></ProtectedRoute>} />
            <Route path="/forum/:postId" element={<ProtectedRoute><ForumPost /></ProtectedRoute>} />
            <Route path="/user/:userId" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
            <Route path="/follows" element={<ProtectedRoute><FollowList /></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
            <Route path="/messages/:userId" element={<ProtectedRoute><Messages /></ProtectedRoute>} />

            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Router>
      </NotificationProvider>
    </AuthProvider>
    </ToastProvider>
  );
}

export default App;
