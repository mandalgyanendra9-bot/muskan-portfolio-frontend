import { Suspense, lazy, useState } from "react";
import { Navigate, Routes, Route } from "react-router-dom";

import { NotificationProvider } from "./context/NotificationContext";
import NotificationToast from "./components/NotificationToast";
import ProtectedRoute from "./components/ProtectedRoute";
import PrivacyShield from "./components/PrivacyShield";
import AgeVerificationGate from "./components/AgeVerificationGate";

const Home = lazy(() => import("./pages/Home"));
const About = lazy(() => import("./pages/About"));
const Projects = lazy(() => import("./pages/Projects"));
const Blog = lazy(() => import("./pages/Blog"));
const Experts = lazy(() => import("./pages/Experts"));
const Contact = lazy(() => import("./pages/Contact"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Admin = lazy(() => import("./pages/Admin"));
const Messages = lazy(() => import("./pages/Messages"));
const ManageProjects = lazy(() => import("./pages/ManageProjects"));
const UploadDP = lazy(() => import("./pages/UploadDP"));
const ExpertDetail = lazy(() => import("./pages/ExpertDetail"));
const VideoCall = lazy(() => import("./pages/VideoCall"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const Profile = lazy(() => import("./pages/Profile"));
const Billing = lazy(() => import("./pages/Billing"));
const Live = lazy(() => import("./pages/Live"));
const AIFeatures = lazy(() => import("./pages/AIFeatures"));
const Security = lazy(() => import("./pages/Security"));

const AGE_VERIFIED_STORAGE_KEY = "ageVerified18Plus";
const AGE_VERIFIED_COOKIE_KEY = "ageVerified18Plus";
const UNDERAGE_REDIRECT_URL = "https://www.google.com";

const getCookieValue = (name) => {
  if (typeof document === "undefined") return null;
  const cookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return cookie ? cookie.split("=")[1] : null;
};

const hasAgeVerification = () => {
  if (typeof window === "undefined") return false;
  const localStorageValue = window.localStorage.getItem(AGE_VERIFIED_STORAGE_KEY);
  if (localStorageValue === "true") return true;
  return getCookieValue(AGE_VERIFIED_COOKIE_KEY) === "true";
};

const persistAgeVerification = () => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AGE_VERIFIED_STORAGE_KEY, "true");
  document.cookie = `${AGE_VERIFIED_COOKIE_KEY}=true; Max-Age=31536000; Path=/; SameSite=Lax`;
};

const PageLoader = () => (
  <div className="min-h-screen bg-surface flex items-center justify-center text-primary-400">
    Loading...
  </div>
);

function App() {
  const [ageVerified, setAgeVerified] = useState(() => hasAgeVerification());

  const handleConfirmAge = () => {
    persistAgeVerification();
    setAgeVerified(true);
  };

  const handleExitForUnderage = () => {
    window.location.href = UNDERAGE_REDIRECT_URL;
  };

  if (!ageVerified) {
    return (
      <AgeVerificationGate
        onConfirm={handleConfirmAge}
        onExit={handleExitForUnderage}
      />
    );
  }

  return (
    <NotificationProvider>
      <PrivacyShield />
      <Suspense fallback={<PageLoader />}>
        <Routes>
            {/* Public */}
            <Route path="/" element={<Home />} />
            <Route path="/home" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/project" element={<Projects />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/experts" element={<Experts />} />
            <Route path="/expert" element={<Experts />} />
            <Route path="/live" element={<Live />} />
            <Route path="/ai" element={<AIFeatures />} />
            <Route path="/security" element={<Security />} />
            <Route path="/contact" element={<Contact />} />

            {/* Auth */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/verify-email/:token" element={<VerifyEmail />} />

            {/* Protected */}
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/billing"
              element={
                <ProtectedRoute>
                  <Billing />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute adminOnly={true}>
                  <Admin />
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages"
              element={
                <ProtectedRoute>
                  <Messages />
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages/:otherId"
              element={
                <ProtectedRoute>
                  <Messages />
                </ProtectedRoute>
              }
            />
            <Route
              path="/manage-projects"
              element={
                <ProtectedRoute>
                  <ManageProjects />
                </ProtectedRoute>
              }
            />
            <Route path="/expert/:id" element={<ExpertDetail />} />
            <Route
              path="/video-call/:roomId"
              element={
                <ProtectedRoute>
                  <VideoCall />
                </ProtectedRoute>
              }
            />
            <Route
              path="/upload"
              element={
                <ProtectedRoute>
                  <UploadDP />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <NotificationToast />
    </NotificationProvider>
  );
}

export default App;
