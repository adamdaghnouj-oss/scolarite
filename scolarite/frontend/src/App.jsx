import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import StudentHome from "./pages/StudentHome";
import AdminPanel from "./pages/AdminPanel";
import AdminProfAssignmentsPage from "./pages/AdminProfAssignmentsPage";
import ClassesPage from "./pages/ClassesPage";
import StudentProfile from "./pages/StudentProfile";
import AccountsPage from "./pages/AccountsPage";
import ProtectedRoute from "./routes/ProtectedRoute";
import RoleProtectedRoute from "./routes/RoleProtectedRoute";
import DirecteurClassesPage from "./pages/DirecteurClassesPage";
import DirecteurPlansPage from "./pages/DirecteurPlansPage";
import ChangePassword from "./pages/ChangePassword";
import ForgotPassword from "./pages/ForgotPassword";
import LanguageSwitcher from "./components/LanguageSwitcher";
import StudentPlansPage from "./pages/StudentPlansPage";
import ProfessorTeachingPage from "./pages/ProfessorTeachingPage";
import StudentFriendsPage from "./pages/StudentFriendsPage";
import StudentFriendProfilePage from "./pages/StudentFriendProfilePage";
import StudentMessagesPage from "./pages/StudentMessagesPage";
import StudentPostsPage from "./pages/StudentPostsPage";
import UserSocialProfilePage from "./pages/UserSocialProfilePage";
import PanierMessagesPage from "./pages/PanierMessagesPage";
import RouteErrorBoundary from "./components/RouteErrorBoundary";
import StudentEventsPage from "./pages/StudentEventsPage";
import StudentContactPage from "./pages/StudentContactPage";
import StudentContactsAdminPage from "./pages/StudentContactsAdminPage";
import StudentAboutPage from "./pages/StudentAboutPage";

export default function App() {
  return (
    <HashRouter>
      <LanguageSwitcher />
      <Routes>
        <Route path="/" element={<StudentHome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/admin"
          element={
            <RoleProtectedRoute allow={["administrateur"]}>
              <AdminPanel />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/classes"
          element={
            <RoleProtectedRoute allow={["administrateur"]}>
              <ClassesPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/admin/prof-assignments"
          element={
            <RoleProtectedRoute allow={["administrateur"]}>
              <AdminProfAssignmentsPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/accounts"
          element={
            <RoleProtectedRoute allow={["administrateur"]}>
              <AccountsPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/admin/student-contacts"
          element={
            <RoleProtectedRoute allow={["administrateur"]}>
              <StudentContactsAdminPage />
            </RoleProtectedRoute>
          }
        />
        <Route path="/profile" element={<StudentProfile />} />
        <Route
          path="/student/plans"
          element={
            <RoleProtectedRoute allow={["student"]}>
              <StudentPlansPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/student/friends"
          element={
            <RoleProtectedRoute allow={["student", "professeur"]}>
              <StudentFriendsPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/student/friends/u/:userId"
          element={
            <RoleProtectedRoute allow={["student", "professeur"]}>
              <UserSocialProfilePage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/student/friends/:id"
          element={
            <RoleProtectedRoute allow={["student", "professeur"]}>
              <StudentFriendProfilePage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/student/posts"
          element={
            <RoleProtectedRoute allow={["student", "professeur"]}>
              <StudentPostsPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/student/events"
          element={
            <RoleProtectedRoute allow={["student"]}>
              <StudentEventsPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/student/about"
          element={
            <RoleProtectedRoute allow={["student"]}>
              <StudentAboutPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/student/contact"
          element={
            <RoleProtectedRoute allow={["student"]}>
              <StudentContactPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/messages/panier"
          element={
            <RoleProtectedRoute allow={["student", "professeur"]}>
              <PanierMessagesPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/student/messages"
          element={
            <RoleProtectedRoute allow={["student"]}>
              <RouteErrorBoundary>
                <StudentMessagesPage />
              </RouteErrorBoundary>
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/directeur/classes"
          element={
            <RoleProtectedRoute allow={["directeur_etudes"]}>
              <DirecteurClassesPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/directeur/plans"
          element={
            <RoleProtectedRoute allow={["directeur_etudes"]}>
              <DirecteurPlansPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/professeur"
          element={
            <RoleProtectedRoute allow={["professeur"]}>
              <ProfessorTeachingPage />
            </RoleProtectedRoute>
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
          path="/change-password"
          element={
            <ProtectedRoute>
              <ChangePassword />
            </ProtectedRoute>
          }
        />
      </Routes>
    </HashRouter>
  );
}