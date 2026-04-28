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
use App\Http\Controllers\Api\PanierMessageController;
use App\Http\Controllers\Api\StudentEventController;
use App\Http\Controllers\Api\StudentContactController;

Route::post('/register',[AuthController::class,'register']);
Route::post('/login',[AuthController::class,'login']);
Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
Route::post('/reset-password', [AuthController::class, 'resetPassword']);

// OTP Verification routes
Route::post('/verify-otp', [AuthController::class, 'verifyOtp']);
Route::post('/resend-otp', [AuthController::class, 'resendOtp']);

Route::get('/departements', [ClasseController::class, 'departements']);

Route::middleware('auth:sanctum')->group(function(){

    Route::post('/logout',[AuthController::class,'logout']);
    Route::post('/change-password', [AuthController::class, 'changePassword']);

    Route::middleware('role:professeur')->group(function () {
        Route::get('/professeur/teaching', [ProfesseurTeachingController::class, 'teachingOverview']);
        Route::get('/professeur/classes/{classId}/students', [ProfesseurTeachingController::class, 'classStudents']);
    });

    // Student profile
    Route::get('/student/profile', [StudentProfileController::class, 'show']);
    Route::post('/student/profile', [StudentProfileController::class, 'update']);
    Route::post('/student/profile/upload/{field}', [StudentProfileController::class, 'uploadFile']);

});

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

// User management routes (open for admin use)
Route::get('/students', [UserManagementController::class, 'indexStudents']);
Route::post('/students', [UserManagementController::class, 'storeStudent']);
Route::get('/professeurs', [UserManagementController::class, 'indexProfesseurs']);
Route::post('/professeurs', [UserManagementController::class, 'storeProfesseur']);
Route::get('/administrateurs', [UserManagementController::class, 'indexAdministrateurs']);
Route::post('/administrateurs', [UserManagementController::class, 'storeAdministrateur']);
Route::get('/directeurs-etudes', [UserManagementController::class, 'indexDirecteursEtudes']);
Route::post('/directeurs-etudes', [UserManagementController::class, 'storeDirecteurEtudes']);

// Classes list (needed by students to pick their class)
Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/classes', [ClasseController::class, 'index']);
});

// Classes + students per class (admin + directeur des etudes)
Route::middleware(['auth:sanctum', 'role:administrateur,directeur_etudes'])->group(function () {
    Route::get('/classes/{id}/students', [ClasseController::class, 'students']);

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

    // Professors per module (cours / TP), from plan paniers defined by Director of Studies
    Route::get('/plan-etudes/class-module-assignments', [PlanEtudeController::class, 'classModuleAssignmentsContext']);
    Route::put('/plan-etudes/class-module-assignments', [PlanEtudeController::class, 'saveClassModuleAssignments']);

    Route::get('/admin/student-contacts', [StudentContactController::class, 'adminIndex']);
    Route::post('/admin/student-contacts/{id}/reply', [StudentContactController::class, 'adminReply']);
});

// Student account management (for admin to review student information)
Route::get('/accounts/students', [UserManagementController::class, 'indexStudentAccounts']);
Route::get('/accounts/students/{id}', [UserManagementController::class, 'showStudentAccount']);
Route::put('/accounts/students/{id}/status', [UserManagementController::class, 'updateStudentInfoStatus']);

// Profile approval routes (admin only)
Route::get('/profiles/pending', [UserManagementController::class, 'getPendingProfiles']);
Route::post('/profiles/{id}/approve', [UserManagementController::class, 'approveStudentProfile']);
Route::post('/profiles/{id}/reject', [UserManagementController::class, 'rejectStudentProfile']);

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

    // evaluations
    Route::post('/plan-etudes/modules/{moduleId}/evaluations', [PlanEtudeController::class, 'addEvaluation']);
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
    Route::get('/messages/class/conversation', [MessageController::class, 'classConversation']);
    Route::get('/messages/class/thread', [MessageController::class, 'classThread']);
    Route::post('/messages/class/thread', [MessageController::class, 'sendClassMessage']);
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
});
