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
import ProfessorNotesPage from "./pages/ProfessorNotesPage";
import ProfessorAbsencesPage from "./pages/ProfessorAbsencesPage";
import StudentAbsencesPage from "./pages/StudentAbsencesPage";
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
import AdminGradesPage from "./pages/AdminGradesPage";
import StudentGradesPage from "./pages/StudentGradesPage";
import StudentAttendanceCertificatesPage from "./pages/StudentAttendanceCertificatesPage";
import ProfessorAttendanceCertificatesPage from "./pages/ProfessorAttendanceCertificatesPage";
import AdminAttendanceCertificatesPage from "./pages/AdminAttendanceCertificatesPage";
import StudentTimetablePage from "./pages/StudentTimetablePage";
import StudentExamCalendarPage from "./pages/StudentExamCalendarPage";
import AdminTimetablePage from "./pages/AdminTimetablePage";
import AdminExamCalendarPage from "./pages/AdminExamCalendarPage";
import DirecteurProfessorTimetablePage from "./pages/DirecteurProfessorTimetablePage";
import DirecteurProfessorExamSurveillancePage from "./pages/DirecteurProfessorExamSurveillancePage";
import ProfessorDocumentsTimetablePage from "./pages/ProfessorDocumentsTimetablePage";
import ProfessorDocumentsExamSurveillancePage from "./pages/ProfessorDocumentsExamSurveillancePage";
import StudentInternshipsPage from "./pages/StudentInternshipsPage";
import DirecteurStagePage from "./pages/DirecteurStagePage";
import AdminMessagesMonitorPage from "./pages/AdminMessagesMonitorPage";

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
          path="/directeur/prof-assignments"
          element={
            <RoleProtectedRoute allow={["directeur_etudes"]}>
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
        <Route
          path="/admin/grades"
          element={
            <RoleProtectedRoute allow={["administrateur"]}>
              <AdminGradesPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/admin/attendance-certificates"
          element={
            <RoleProtectedRoute allow={["administrateur"]}>
              <AdminAttendanceCertificatesPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/admin/messages"
          element={
            <RoleProtectedRoute allow={["administrateur"]}>
              <AdminMessagesMonitorPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/directeur/timetable"
          element={
            <RoleProtectedRoute allow={["directeur_etudes"]}>
              <AdminTimetablePage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/directeur/exam-calendar"
          element={
            <RoleProtectedRoute allow={["directeur_etudes"]}>
              <AdminExamCalendarPage />
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
          path="/student/absences"
          element={
            <RoleProtectedRoute allow={["student"]}>
              <StudentAbsencesPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/student/grades"
          element={
            <RoleProtectedRoute allow={["student"]}>
              <StudentGradesPage />
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
          path="/student/attendance-certificates"
          element={
            <RoleProtectedRoute allow={["student"]}>
              <StudentAttendanceCertificatesPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/student/timetable"
          element={
            <RoleProtectedRoute allow={["student"]}>
              <StudentTimetablePage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/student/exam-calendar"
          element={
            <RoleProtectedRoute allow={["student"]}>
              <StudentExamCalendarPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/student/internships"
          element={
            <RoleProtectedRoute allow={["student"]}>
              <StudentInternshipsPage />
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
          path="/directeur/prof-timetable"
          element={
            <RoleProtectedRoute allow={["directeur_etudes"]}>
              <DirecteurProfessorTimetablePage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/directeur/prof-exam-surveillance"
          element={
            <RoleProtectedRoute allow={["directeur_etudes"]}>
              <DirecteurProfessorExamSurveillancePage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/directeur-stage/internships"
          element={
            <RoleProtectedRoute allow={["directeur_stage"]}>
              <DirecteurStagePage />
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
          path="/professeur/notes"
          element={
            <RoleProtectedRoute allow={["professeur"]}>
              <ProfessorNotesPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/professeur/absences"
          element={
            <RoleProtectedRoute allow={["professeur"]}>
              <ProfessorAbsencesPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/professeur/attendance-certificates"
          element={
            <RoleProtectedRoute allow={["professeur"]}>
              <ProfessorAttendanceCertificatesPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/professeur/timetable"
          element={
            <RoleProtectedRoute allow={["professeur"]}>
              <ProfessorDocumentsTimetablePage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/professeur/exam-surveillance"
          element={
            <RoleProtectedRoute allow={["professeur"]}>
              <ProfessorDocumentsExamSurveillancePage />
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