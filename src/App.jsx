import { Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import About from "./pages/About";
import Projects from "./pages/Projects";
import Blog from "./pages/Blog";
import Experts from "./pages/Experts";
import Contact from "./pages/Contact";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import Messages from "./pages/Messages";
import ManageProjects from "./pages/ManageProjects";
import UploadDP from "./pages/UploadDP";
import ExpertDetail from "./pages/ExpertDetail";
import VideoCall from "./pages/VideoCall";

import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/projects" element={<Projects />} />
      <Route path="/blog" element={<Blog />} />
      <Route path="/experts" element={<Experts />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
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
          <ProtectedRoute>
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
    </Routes>
  );
}

export default App;