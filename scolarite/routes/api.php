<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\UserManagementController;
use App\Http\Controllers\Api\ClasseController;
use App\Http\Controllers\Api\StudentProfileController;
use App\Http\Controllers\Api\PlanEtudeController;
use App\Http\Controllers\Api\FriendController;
use App\Http\Controllers\Api\MessageController;
use App\Http\Controllers\Api\PostController;
use App\Http\Controllers\Api\ProfesseurTeachingController;
use App\Http\Controllers\Api\ProfesseurAcademicController;
use App\Http\Controllers\Api\StudentAcademicController;
use App\Http\Controllers\Api\PanierMessageController;
use App\Http\Controllers\Api\StudentEventController;
use App\Http\Controllers\Api\StudentContactController;
use App\Http\Controllers\Api\AdminGradesController;
use App\Http\Controllers\Api\AttendanceCertificateController;
use App\Http\Controllers\Api\ClassDocumentController;
use App\Http\Controllers\Api\ProfessorDocumentController;
use App\Http\Controllers\Api\DoubleCorrectionRequestController;
use App\Http\Controllers\Api\InternshipController;
use App\Http\Controllers\Api\AdminMessageMonitorController;

Route::middleware('throttle:10,1')->group(function () {
    Route::post('/register',[AuthController::class,'register']);
    Route::post('/login',[AuthController::class,'login']);
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);
});

// OTP Verification routes
Route::middleware('throttle:6,1')->group(function () {
    Route::post('/verify-otp', [AuthController::class, 'verifyOtp']);
    Route::post('/resend-otp', [AuthController::class, 'resendOtp']);
});

Route::get('/departements', [ClasseController::class, 'departements']);

Route::middleware('auth:sanctum')->group(function(){

    Route::post('/logout',[AuthController::class,'logout']);
    Route::post('/change-password', [AuthController::class, 'changePassword']);

    Route::middleware('role:professeur')->group(function () {
        Route::get('/professeur/teaching', [ProfesseurTeachingController::class, 'teachingOverview']);
        Route::get('/professeur/classes/{classId}/students', [ProfesseurTeachingController::class, 'classStudents']);

        Route::get('/professeur/paniers/{panierId}/grades-context', [ProfesseurAcademicController::class, 'panierGradesContext']);
        Route::put('/professeur/paniers/{panierId}/grades', [ProfesseurAcademicController::class, 'upsertPanierGrades']);

        Route::get('/professeur/paniers/{panierId}/absences', [ProfesseurAcademicController::class, 'absenceOverviewPanier']);
        Route::post('/professeur/paniers/{panierId}/sessions', [ProfesseurAcademicController::class, 'storeSessionPanier']);
        Route::put('/professeur/paniers/{panierId}/sessions/{sessionId}', [ProfesseurAcademicController::class, 'updateSessionPanier']);
        Route::delete('/professeur/paniers/{panierId}/sessions/{sessionId}', [ProfesseurAcademicController::class, 'destroySessionPanier']);
        Route::post('/professeur/paniers/{panierId}/students/{studentId}/dismiss-elimination', [ProfesseurAcademicController::class, 'dismissEliminationPanier']);

        Route::get('/professeur/modules/{moduleId}/notes', [ProfesseurAcademicController::class, 'listNotes']);
        Route::put('/professeur/modules/{moduleId}/notes', [ProfesseurAcademicController::class, 'upsertNotes']);
        Route::delete('/professeur/modules/{moduleId}/notes/students/{studentId}', [ProfesseurAcademicController::class, 'deleteStudentNote']);

        Route::get('/professeur/modules/{moduleId}/absences', [ProfesseurAcademicController::class, 'absenceOverview']);
        Route::post('/professeur/modules/{moduleId}/sessions', [ProfesseurAcademicController::class, 'storeSession']);
        Route::put('/professeur/modules/{moduleId}/sessions/{sessionId}', [ProfesseurAcademicController::class, 'updateSession']);
        Route::delete('/professeur/modules/{moduleId}/sessions/{sessionId}', [ProfesseurAcademicController::class, 'destroySession']);
        Route::post('/professeur/modules/{moduleId}/students/{studentId}/dismiss-elimination', [ProfesseurAcademicController::class, 'dismissElimination']);

        // Attendance certificate: professor inbox + decision
        Route::get('/professeur/attendance-certificates', [AttendanceCertificateController::class, 'professeurInbox']);
        Route::post('/professeur/attendance-certificates/{id}/decision', [AttendanceCertificateController::class, 'professeurDecide']);

        // Professor documents (read-only): timetable + exam surveillance
        Route::get('/professeur/documents/{type}', [ProfessorDocumentController::class, 'professeurIndex']);

        // Double correction requests from students
        Route::get('/professeur/double-corrections', [DoubleCorrectionRequestController::class, 'professeurIndex']);
        Route::post('/professeur/double-corrections/{id}/decision', [DoubleCorrectionRequestController::class, 'professeurDecide']);

        // Internship soutenance: jury member publishes schedule for students
        Route::get('/professeur/internships/soutenance-pending', [InternshipController::class, 'professeurSoutenancePending']);
        Route::post('/professeur/internships/{id}/soutenance-publish', [InternshipController::class, 'professeurSoutenancePublish']);
        Route::get('/professeur/internships/encadrement', [InternshipController::class, 'professeurEncadrementIndex']);
    });

    // Student profile
    Route::get('/student/profile', [StudentProfileController::class, 'show']);
    Route::post('/student/profile', [StudentProfileController::class, 'update']);
    Route::post('/student/profile/upload/{field}', [StudentProfileController::class, 'uploadFile']);

});

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

// User management routes (admin only)
Route::middleware(['auth:sanctum', 'role:administrateur'])->group(function () {
    Route::get('/students', [UserManagementController::class, 'indexStudents']);
    Route::post('/students', [UserManagementController::class, 'storeStudent']);
    Route::get('/professeurs', [UserManagementController::class, 'indexProfesseurs']);
    Route::post('/professeurs', [UserManagementController::class, 'storeProfesseur']);
    Route::get('/administrateurs', [UserManagementController::class, 'indexAdministrateurs']);
    Route::post('/administrateurs', [UserManagementController::class, 'storeAdministrateur']);
    Route::get('/directeurs-etudes', [UserManagementController::class, 'indexDirecteursEtudes']);
    Route::post('/directeurs-etudes', [UserManagementController::class, 'storeDirecteurEtudes']);
});

// Classes list (needed by students to pick their class)
Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/classes', [ClasseController::class, 'index']);
});

// Classes + students per class (admin + directeur des etudes)
Route::middleware(['auth:sanctum', 'role:administrateur,directeur_etudes'])->group(function () {
    Route::get('/classes/{id}/students', [ClasseController::class, 'students']);
    Route::get('/classes/{id}/students/attach-candidates', [ClasseController::class, 'attachCandidates']);
    Route::post('/classes/{id}/students/attach', [ClasseController::class, 'attachStudent']);

    // Students per class (allowed for admin + directeur des etudes)
    Route::post('/classes/{id}/students', [ClasseController::class, 'addStudent']);
    Route::put('/classes/{classId}/students/{studentId}', [ClasseController::class, 'updateStudent']);
    Route::delete('/classes/{classId}/students/{studentId}/remove', [ClasseController::class, 'removeStudent']);
});

// Class management (admin only)
Route::middleware(['auth:sanctum', 'role:administrateur'])->group(function () {
    Route::post('/classes', [ClasseController::class, 'store']);
    Route::put('/classes/{id}', [ClasseController::class, 'update']);
    Route::delete('/classes/{id}', [ClasseController::class, 'destroy']);

    // Delete a student entirely (admin only)
    Route::delete('/classes/{classId}/students/{studentId}', [ClasseController::class, 'deleteStudent']);

    Route::get('/admin/student-contacts', [StudentContactController::class, 'adminIndex']);
    Route::post('/admin/student-contacts/{id}/reply', [StudentContactController::class, 'adminReply']);

    Route::get('/admin/classes/{classId}/grades-overview', [AdminGradesController::class, 'gradesOverview']);
    Route::get('/admin/paniers/{panierId}/grades-context', [AdminGradesController::class, 'panierGradesContext']);
    Route::put('/admin/paniers/{panierId}/grades', [AdminGradesController::class, 'upsertPanierGrades']);
    Route::get('/admin/classes/{classId}/semester-summary', [AdminGradesController::class, 'semesterSummary']);
    Route::get('/admin/classes/{classId}/grades/export-pdf', [AdminGradesController::class, 'exportClassGradesPdf']);
    Route::post('/admin/classes/{classId}/grades/publish', [AdminGradesController::class, 'publishGrades']);
    Route::post('/admin/classes/{classId}/grades/unpublish', [AdminGradesController::class, 'unpublishGrades']);

    // Attendance certificate: admin overview + PDF
    Route::get('/admin/attendance-certificates', [AttendanceCertificateController::class, 'adminIndex']);
    Route::get('/admin/attendance-certificates/{id}/pdf', [AttendanceCertificateController::class, 'adminPdf']);
    Route::get('/admin/messages', [AdminMessageMonitorController::class, 'index']);
    Route::delete('/admin/messages/{type}/{id}', [AdminMessageMonitorController::class, 'destroy']);
});

// Directeur des etudes: prof assignments + timetable/exam calendar publishing
Route::middleware(['auth:sanctum', 'role:directeur_etudes'])->group(function () {
    // Professors per module (cours / TP), from plan paniers defined by Director of Studies
    Route::get('/plan-etudes/class-module-assignments', [PlanEtudeController::class, 'classModuleAssignmentsContext']);
    Route::put('/plan-etudes/class-module-assignments', [PlanEtudeController::class, 'saveClassModuleAssignments']);

    // Timetable + exam calendar documents (upload/manage)
    Route::get('/admin/class-documents/{type}', [ClassDocumentController::class, 'adminIndex']);
    Route::post('/admin/class-documents/{type}', [ClassDocumentController::class, 'adminStore']);
    Route::delete('/admin/class-documents/{id}', [ClassDocumentController::class, 'adminDestroy']);

    // Professor documents (upload/manage): timetable + exam surveillance
    Route::get('/directeur/professeur-documents/{type}', [ProfessorDocumentController::class, 'directeurIndex']);
    Route::post('/directeur/professeur-documents/{type}', [ProfessorDocumentController::class, 'directeurStore']);
    Route::delete('/directeur/professeur-documents/{id}', [ProfessorDocumentController::class, 'directeurDestroy']);
});

// Student account management and profile approval (admin only)
Route::middleware(['auth:sanctum', 'role:administrateur'])->group(function () {
    Route::get('/accounts/students', [UserManagementController::class, 'indexStudentAccounts']);
    Route::get('/accounts/students/{id}', [UserManagementController::class, 'showStudentAccount']);
    Route::put('/accounts/students/{id}/status', [UserManagementController::class, 'updateStudentInfoStatus']);

    Route::get('/profiles/pending', [UserManagementController::class, 'getPendingProfiles']);
    Route::post('/profiles/{id}/approve', [UserManagementController::class, 'approveStudentProfile']);
    Route::post('/profiles/{id}/reject', [UserManagementController::class, 'rejectStudentProfile']);
});

// Plans d'etude (directeur des etudes + admin)
Route::middleware(['auth:sanctum', 'role:administrateur,directeur_etudes'])->group(function () {
    // reference
    Route::get('/plan-etudes/specialites', [PlanEtudeController::class, 'listSpecialites']);
    Route::post('/plan-etudes/specialites', [PlanEtudeController::class, 'createSpecialite']);
    Route::get('/plan-etudes/semestres', [PlanEtudeController::class, 'listSemestres']);
    Route::post('/plan-etudes/semestres/seed', [PlanEtudeController::class, 'seedDefaultSemestres']);
    Route::get('/plan-etudes/classes', [PlanEtudeController::class, 'listClasses']);

    // plans
    Route::get('/plan-etudes/plans', [PlanEtudeController::class, 'listPlans']);
    Route::post('/plan-etudes/plans', [PlanEtudeController::class, 'createPlan']);
    Route::put('/plan-etudes/plans/{id}', [PlanEtudeController::class, 'updatePlan']);

    // paniers
    Route::post('/plan-etudes/plans/{planId}/paniers', [PlanEtudeController::class, 'addPanier']);
    Route::put('/plan-etudes/paniers/{panierId}', [PlanEtudeController::class, 'updatePanier']);
    Route::delete('/plan-etudes/paniers/{panierId}', [PlanEtudeController::class, 'deletePanier']);

    // modules
    Route::post('/plan-etudes/paniers/{panierId}/modules', [PlanEtudeController::class, 'addModule']);
    Route::put('/plan-etudes/modules/{moduleId}', [PlanEtudeController::class, 'updateModule']);
    Route::delete('/plan-etudes/modules/{moduleId}', [PlanEtudeController::class, 'deleteModule']);

    // evaluations (whole subject / panier)
    Route::post('/plan-etudes/paniers/{panierId}/evaluations', [PlanEtudeController::class, 'addEvaluationToPanier']);
    Route::put('/plan-etudes/evaluations/{evaluationId}', [PlanEtudeController::class, 'updateEvaluation']);
    Route::delete('/plan-etudes/evaluations/{evaluationId}', [PlanEtudeController::class, 'deleteEvaluation']);

    // affectations
    Route::post('/plan-etudes/affectations', [PlanEtudeController::class, 'createAffectation']);
    Route::delete('/plan-etudes/affectations/{id}', [PlanEtudeController::class, 'deleteAffectation']);
});

// Plans d'etude read-only for students
Route::middleware(['auth:sanctum', 'role:student,administrateur,directeur_etudes'])->group(function () {
    Route::get('/plan-etudes/plans/{id}', [PlanEtudeController::class, 'showPlanTree']);
    Route::get('/plan-etudes/affectations', [PlanEtudeController::class, 'listAffectations']);
});

// Social: students + professors (shared feed, connections, panier class groups)
Route::middleware(['auth:sanctum', 'role:student,professeur'])->group(function () {
    Route::get('/posts/me-context', [PostController::class, 'meContext']);
    Route::get('/friends/suggestions', [FriendController::class, 'suggestions']);
    Route::get('/friends/my', [FriendController::class, 'myFriends']);
    Route::get('/friends/notifications/summary', [FriendController::class, 'notificationsSummary']);
    Route::post('/friends/notifications/accepted/seen', [FriendController::class, 'markAcceptedSeen']);
    Route::get('/friends/invitations/incoming', [FriendController::class, 'incomingInvitations']);
    Route::post('/friends/invitations', [FriendController::class, 'sendInvitation']);
    Route::post('/friends/invitations/{id}/accept', [FriendController::class, 'acceptInvitation']);
    Route::post('/friends/invitations/{id}/reject', [FriendController::class, 'rejectInvitation']);
    Route::get('/friends/students/{id}', [FriendController::class, 'showStudentProfile']);
    Route::get('/friends/users/{userId}', [FriendController::class, 'showUserProfile']);

    Route::get('/messages/panier/conversations', [PanierMessageController::class, 'conversations']);
    Route::get('/messages/panier/threads/{threadId}', [PanierMessageController::class, 'thread']);
    Route::post('/messages/panier/threads/{threadId}', [PanierMessageController::class, 'send']);
    Route::put('/messages/panier/messages/{id}', [PanierMessageController::class, 'update']);
    Route::delete('/messages/panier/messages/{id}', [PanierMessageController::class, 'destroy']);

    Route::get('/posts/feed', [PostController::class, 'feed']);
    Route::get('/posts/my', [PostController::class, 'myPosts']);
    Route::post('/posts', [PostController::class, 'store']);
    Route::put('/posts/{id}', [PostController::class, 'updatePost']);
    Route::delete('/posts/{id}', [PostController::class, 'deletePost']);
    Route::post('/posts/{id}/like', [PostController::class, 'toggleLike']);
    Route::post('/posts/{id}/comments', [PostController::class, 'addComment']);
    Route::post('/posts/comments/{id}/like', [PostController::class, 'toggleCommentLike']);
    Route::post('/posts/comments/{id}/replies', [PostController::class, 'addReply']);
    Route::post('/posts/{id}/share', [PostController::class, 'share']);
});

// Student-only: private friend chat, class wall, stories
Route::middleware(['auth:sanctum', 'role:student'])->group(function () {
    Route::get('/messages/conversations', [MessageController::class, 'conversations']);
    Route::get('/messages/threads/{friendId}', [MessageController::class, 'thread']);
    Route::post('/messages/threads/{friendId}', [MessageController::class, 'send']);
    Route::put('/messages/threads/messages/{id}', [MessageController::class, 'updateFriendMessage']);
    Route::delete('/messages/threads/messages/{id}', [MessageController::class, 'destroyFriendMessage']);
    Route::get('/messages/class/conversation', [MessageController::class, 'classConversation']);
    Route::get('/messages/class/thread', [MessageController::class, 'classThread']);
    Route::post('/messages/class/thread', [MessageController::class, 'sendClassMessage']);
    Route::put('/messages/class/messages/{id}', [MessageController::class, 'updateClassMessage']);
    Route::delete('/messages/class/messages/{id}', [MessageController::class, 'destroyClassMessage']);
    Route::get('/messages/class/members', [MessageController::class, 'classMembers']);

    Route::get('/posts/stories', [PostController::class, 'stories']);
    Route::post('/posts/stories', [PostController::class, 'storeStory']);
    Route::get('/posts/stories/{id}', [PostController::class, 'viewStory']);
    Route::put('/posts/stories/{id}', [PostController::class, 'updateStory']);
    Route::delete('/posts/stories/{id}', [PostController::class, 'deleteStory']);
    Route::post('/posts/stories/{id}/like', [PostController::class, 'toggleStoryLike']);

    Route::get('/events', [StudentEventController::class, 'index']);
    Route::post('/events', [StudentEventController::class, 'store']);
    Route::put('/events/{id}', [StudentEventController::class, 'update']);
    Route::delete('/events/{id}', [StudentEventController::class, 'destroy']);

    Route::get('/student-contacts', [StudentContactController::class, 'studentIndex']);
    Route::post('/student-contacts', [StudentContactController::class, 'studentStore']);

    Route::get('/student/absences-by-panier', [StudentAcademicController::class, 'absencesByPanier']);
    Route::get('/student/my-grades', [StudentAcademicController::class, 'myGrades']);

    // Double correction requests (student)
    Route::get('/student/double-corrections', [DoubleCorrectionRequestController::class, 'studentIndex']);
    Route::post('/student/double-corrections', [DoubleCorrectionRequestController::class, 'studentStore']);

    // Attendance certificate: student create + list
    Route::get('/student/attendance-certificates', [AttendanceCertificateController::class, 'studentIndex']);
    Route::post('/student/attendance-certificates', [AttendanceCertificateController::class, 'studentStore']);

    // Timetable + exam calendar documents (student view - only active window)
    Route::get('/student/class-documents/{type}', [ClassDocumentController::class, 'studentIndex']);

    // Internship workflow
    Route::get('/student/internships/context', [InternshipController::class, 'studentContext']);
    Route::get('/student/internships', [InternshipController::class, 'studentIndex']);
    Route::post('/student/internships', [InternshipController::class, 'studentStore']);
    Route::post('/student/internships/demande-pdf-preview', [InternshipController::class, 'studentDemandePdfPreview']);
    Route::post('/student/internships/submit-signed', [InternshipController::class, 'studentSubmitSigned']);
    Route::put('/student/internships/{id}', [InternshipController::class, 'studentUpdate']);
    Route::post('/student/internships/{id}/upload-signed-demande', [InternshipController::class, 'studentUploadSignedDemande']);
    Route::post('/student/internships/{id}/upload-rapport', [InternshipController::class, 'studentUploadRapport']);
    Route::post('/student/internships/{id}/upload-attestation', [InternshipController::class, 'studentUploadAttestation']);
    Route::get('/student/internships/{id}/demande-pdf', [InternshipController::class, 'studentDemandePdf']);
    Route::get('/student/internships/{id}/affectation-pdf', [InternshipController::class, 'studentAffectationPdf']);
    Route::get('/student/internships/{id}/files/{kind}/view', [InternshipController::class, 'studentViewFile']);
    Route::get('/student/internships/{id}/files/{kind}', [InternshipController::class, 'studentDownloadFile']);
});

// Directeur de stage
Route::middleware(['auth:sanctum', 'role:directeur_stage'])->group(function () {
    Route::get('/directeur-stage/internships', [InternshipController::class, 'directeurIndex']);
    Route::get('/directeur-stage/internships/soutenance-board', [InternshipController::class, 'directeurSoutenanceBoard']);
    Route::patch('/directeur-stage/internships/{id}/soutenance', [InternshipController::class, 'directeurSoutenanceUpdate']);
    Route::post('/directeur-stage/internships/{id}/soutenance/publish', [InternshipController::class, 'directeurSoutenancePublish']);
    Route::post('/directeur-stage/internships/{id}/soutenance/unpublish', [InternshipController::class, 'directeurSoutenanceUnpublish']);
    Route::get('/directeur-stage/classes/{classId}/internships-soutenance-pdf', [InternshipController::class, 'directeurSoutenanceClassPdf']);
    Route::get('/directeur-stage/internships/encadrement-board', [InternshipController::class, 'directeurEncadrementBoard']);
    Route::patch('/directeur-stage/internships/{id}/encadrement', [InternshipController::class, 'directeurEncadrementUpdate']);
    Route::get('/directeur-stage/classes/{classId}/internships-encadrement-pdf', [InternshipController::class, 'directeurEncadrementClassPdf']);
    Route::post('/directeur-stage/internships/{id}/decision', [InternshipController::class, 'directeurDecision']);
    Route::patch('/directeur-stage/internships/{id}/approved-meta', [InternshipController::class, 'directeurUpdateApprovedMeta']);
    Route::post('/directeur-stage/internships/{id}/document-decision', [InternshipController::class, 'directeurDocumentDecision']);
    Route::delete('/directeur-stage/internships/{id}', [InternshipController::class, 'directeurDestroy']);
    Route::get('/directeur-stage/internships/{id}/files/{kind}/view', [InternshipController::class, 'directeurViewFile']);
    Route::get('/directeur-stage/internships/{id}/files/{kind}', [InternshipController::class, 'directeurDownloadFile']);
});
