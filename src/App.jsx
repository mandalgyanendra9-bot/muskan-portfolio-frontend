import { Suspense, lazy } from "react";
import { Navigate, Routes, Route } from "react-router-dom";

import { NotificationProvider } from "./context/NotificationContext";
import NotificationToast from "./components/NotificationToast";
import ProtectedRoute from "./components/ProtectedRoute";

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

const PageLoader = () => (
  <div className="min-h-screen bg-surface flex items-center justify-center text-primary-400">
    Loading...
  </div>
);

function App() {
  return (
    <NotificationProvider>
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
