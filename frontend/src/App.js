import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Provider, useSelector, useDispatch } from 'react-redux';
import store from './store';
import { checkLoginStatus, selectUser } from './store/slices/authSlice';
import Header from './components/Header';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import NotFoundPage from './pages/NotFoundPage';
import ApplicationDetailPage from './pages/ApplicationDetailPage';
import PeopleRecordsPage from './pages/PeopleRecordsPage';
import AddressRecordsPage from './pages/AddressRecordsPage';
import PaymentSuccessPage from './pages/PaymentSuccessPage';
import ApplicationLayout from './pages/apply/ApplicationLayout';
import StudentInfoStep from './pages/apply/StudentInfoStep';
import HealthInfoStep from './pages/apply/HealthInfoStep';
import GuardianInfoStep from './pages/apply/GuardianInfoStep';
import AdditionalSupportStep from './pages/apply/AdditionalSupportStep';
import QuestionnaireStep from './pages/apply/QuestionnaireStep';
import CommitmentStep from './pages/apply/CommitmentStep';
import DocumentsStep from './pages/apply/DocumentsStep';
import ReviewStep from './pages/apply/ReviewStep';
import './index.css';

function AuthRedirect({ children }) {
  const user = useSelector(selectUser);
  const location = useLocation();

  if (user && (location.pathname === '/login' || location.pathname === '/register')) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function AppInner() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(checkLoginStatus());
  }, [dispatch]);

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        dispatch(checkLoginStatus());
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [dispatch]);

  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />

        <Route
          path="/login"
          element={
            <AuthRedirect>
              <LoginPage />
            </AuthRedirect>
          }
        />

        <Route
          path="/register"
          element={
            <AuthRedirect>
              <RegisterPage />
            </AuthRedirect>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/application/:id"
          element={
            <ProtectedRoute>
              <ApplicationDetailPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/records/people"
          element={
            <ProtectedRoute>
              <PeopleRecordsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/records/addresses"
          element={
            <ProtectedRoute>
              <AddressRecordsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/payment-success"
          element={
            <ProtectedRoute>
              <PaymentSuccessPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/apply"
          element={
            <ProtectedRoute>
              <ApplicationLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="student-info" replace />} />
          <Route path="student-info" element={<StudentInfoStep />} />
          <Route path="health-info" element={<HealthInfoStep />} />
          <Route path="guardian-info" element={<GuardianInfoStep />} />
          <Route path="additional-support" element={<AdditionalSupportStep />} />
          <Route path="questionnaire" element={<QuestionnaireStep />} />
          <Route path="commitment" element={<CommitmentStep />} />
          <Route path="documents" element={<DocumentsStep />} />
          <Route path="review" element={<ReviewStep />} />
          <Route path=":step" element={<StudentInfoStep />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Footer />
    </BrowserRouter>
  );
}

function App() {
  return (
    <Provider store={store}>
      <AppInner />
    </Provider>
  );
}

export default App;
