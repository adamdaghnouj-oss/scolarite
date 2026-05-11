<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Administrateur;
use App\Models\Classe;
use App\Models\DirecteurEtudes;
use App\Models\Professeur;
use App\Models\Student;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class UserManagementController extends Controller
{
    public function indexStudents()
    {
        $students = Student::with('user')->get()->map(function ($s) {
            return [
                'id' => $s->id,
                'user_id' => $s->user_id,
                'name' => $s->user->name ?? '',
                'email' => $s->user->email ?? '',
                'matricule' => $s->matricule,
                'classe' => $s->classe,
                'profile_picture' => $s->profile_picture,
                'created_at' => $s->created_at,
            ];
        });
        return response()->json($students);
    }

    public function storeStudent(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'matricule' => 'required|string|max:50|unique:students,matricule',
            'classe' => 'nullable|string|max:100',
        ]);

        DB::beginTransaction();
        try {
            $user = User::create([
                'name' => $request->name,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'role' => 'student',
            ]);
            $student = Student::create([
                'user_id' => $user->id,
                'matricule' => $request->matricule,
                'classe' => $request->classe,
            ]);
            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }

        return response()->json([
            'id' => $student->id,
            'user_id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'matricule' => $student->matricule,
            'classe' => $student->classe,
            'created_at' => $student->created_at,
        ], 201);
    }

    public function indexProfesseurs()
    {
        $profs = Professeur::with('user')->get()->map(function ($p) {
            return [
                'id' => $p->id,
                'user_id' => $p->user_id,
                'name' => $p->user->name ?? '',
                'email' => $p->user->email ?? '',
                'matricule' => $p->matricule,
                'departement' => $p->departement,
                'created_at' => $p->created_at,
            ];
        });
        return response()->json($profs);
    }

    public function storeProfesseur(Request $request)
    {
        $allowedDepts = Classe::distinctDepartementNames()->all();
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'matricule' => 'nullable|string|max:50|unique:professeurs,matricule',
            'departement' => [
                'nullable',
                'string',
                'max:100',
                function (string $attribute, mixed $value, \Closure $fail) use ($allowedDepts) {
                    if ($value === null || $value === '') {
                        return;
                    }
                    if (! in_array($value, $allowedDepts, true)) {
                        $fail(__('validation.in', ['attribute' => $attribute]));
                    }
                },
            ],
        ]);

        DB::beginTransaction();
        try {
            $user = User::create([
                'name' => $request->name,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'role' => 'professeur',
            ]);
            $prof = Professeur::create([
                'user_id' => $user->id,
                'matricule' => $request->matricule,
                'departement' => $request->departement,
            ]);
            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }

        return response()->json([
            'id' => $prof->id,
            'user_id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'matricule' => $prof->matricule,
            'departement' => $prof->departement,
            'created_at' => $prof->created_at,
        ], 201);
    }

    public function indexAdministrateurs()
    {
        $admins = Administrateur::with('user')->get()->map(function ($a) {
            return [
                'id' => $a->id,
                'user_id' => $a->user_id,
                'name' => $a->user->name ?? '',
                'email' => $a->user->email ?? '',
                'departement' => $a->departement,
                'created_at' => $a->created_at,
            ];
        });
        return response()->json($admins);
    }

    public function storeAdministrateur(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'departement' => 'nullable|string|max:100',
        ]);

        DB::beginTransaction();
        try {
            $user = User::create([
                'name' => $request->name,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'role' => 'administrateur',
            ]);
            $admin = Administrateur::create([
                'user_id' => $user->id,
                'departement' => $request->departement,
            ]);
            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }

        return response()->json([
            'id' => $admin->id,
            'user_id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'departement' => $admin->departement,
            'created_at' => $admin->created_at,
        ], 201);
    }

    public function indexDirecteursEtudes()
    {
        $directeurs = DirecteurEtudes::with('user')->get()->map(function ($d) {
            return [
                'id' => $d->id,
                'user_id' => $d->user_id,
                'name' => $d->user->name ?? '',
                'email' => $d->user->email ?? '',
                'matricule' => $d->matricule,
                'departement' => $d->departement,
                'created_at' => $d->created_at,
            ];
        });
        return response()->json($directeurs);
    }

    public function storeDirecteurEtudes(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'matricule' => 'nullable|string|max:50|unique:directeur_etudes,matricule',
            'departement' => 'nullable|string|max:100',
        ]);

        DB::beginTransaction();
        try {
            $user = User::create([
                'name' => $request->name,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'role' => 'directeur_etudes',
            ]);
            $directeur = DirecteurEtudes::create([
                'user_id' => $user->id,
                'matricule' => $request->matricule,
                'departement' => $request->departement,
            ]);
            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }

        return response()->json([
            'id' => $directeur->id,
            'user_id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'matricule' => $directeur->matricule,
            'departement' => $directeur->departement,
            'created_at' => $directeur->created_at,
        ], 201);
    }

    /**
     * Get all student accounts with their status information
     */
    public function indexStudentAccounts()
    {
        $students = Student::with('user', 'classeObj')->get()->map(function ($s) {
            return [
                'id' => $s->id,
                'user_id' => $s->user_id,
                'name' => $s->user->name ?? '',
                'email' => $s->user->email ?? '',
                'matricule' => $s->matricule,
                'classe' => $s->classe,
                'class_id' => $s->class_id,
                'class_name' => $s->classeObj->name ?? null,
                'profile_picture' => $s->profile_picture,
                'overall_status' => $s->overall_status ?? 'pending',
                'last_updated_at' => $s->last_updated_at,
                // Status for each category
                'statuses' => [
                    'personnel_info' => [
                        'status' => $s->personnel_info_status ?? 'pending',
                        'comment' => $s->personnel_info_comment ?? '',
                    ],
                    'personal_info' => [
                        'status' => $s->personal_info_status ?? 'pending',
                        'comment' => $s->personal_info_comment ?? '',
                    ],
                    'academic_info' => [
                        'status' => $s->academic_info_status ?? 'pending',
                        'comment' => $s->academic_info_comment ?? '',
                    ],
                    'payment_proof' => [
                        'status' => $s->payment_proof_status ?? 'pending',
                        'comment' => $s->payment_proof_comment ?? '',
                    ],
                    'certificate_achievement' => [
                        'status' => $s->certificate_status ?? 'pending',
                        'comment' => $s->certificate_comment ?? '',
                    ],
                    'academic_transcript' => [
                        'status' => $s->transcript_status ?? 'pending',
                        'comment' => $s->transcript_comment ?? '',
                    ],
                    'father_info' => [
                        'status' => $s->father_info_status ?? 'pending',
                        'comment' => $s->father_info_comment ?? '',
                    ],
                    'mother_info' => [
                        'status' => $s->mother_info_status ?? 'pending',
                        'comment' => $s->mother_info_comment ?? '',
                    ],
                    'parents_relationship' => [
                        'status' => $s->parents_relationship_status ?? 'pending',
                        'comment' => $s->parents_relationship_comment ?? '',
                    ],
                ],
                'created_at' => $s->created_at,
            ];
        });
        return response()->json($students);
    }

    /**
     * Get detailed student account information
     */
    public function showStudentAccount($id)
    {
        $student = Student::with('user', 'classeObj')->find($id);
        
        if (!$student) {
            return response()->json(['message' => 'Student not found.'], 404);
        }

        return response()->json([
            'id' => $student->id,
            'user_id' => $student->user_id,
            'name' => $student->user->name ?? '',
            'email' => $student->user->email ?? '',
            'matricule' => $student->matricule,
            'classe' => $student->classe,
            'class_id' => $student->class_id,
            'class_name' => $student->classeObj->name ?? null,
            'profile_picture' => $student->profile_picture,
            'overall_status' => $student->overall_status ?? 'pending',
            'status' => $student->status ?? 'pending',
            'status_comment' => $student->status_comment ?? '',
            'approved_at' => $student->approved_at,
            'last_updated_at' => $student->last_updated_at,
            // Personnel Information
            'personnel_info' => [
                'phone' => $student->phone,
                'address' => $student->address,
                'postal_code' => $student->postal_code,
                'city' => $student->city,
                'country' => $student->country,
                'date_of_birth' => $student->date_of_birth,
                'place_of_birth' => $student->place_of_birth,
                'gender' => $student->gender,
                'status' => $student->personnel_info_status ?? 'pending',
                'comment' => $student->personnel_info_comment ?? '',
            ],
            // Academic Information
            'academic_info' => [
                'admission_status' => $student->admission_status,
                'class_id' => $student->class_id,
                'class_name' => $student->classeObj->name ?? null,
                'status' => $student->academic_info_status ?? 'pending',
                'comment' => $student->academic_info_comment ?? '',
            ],
            // Payment Proof
            'payment_proof' => [
                'file' => $student->payment_proof,
                'status' => $student->payment_proof_status ?? 'pending',
                'comment' => $student->payment_proof_comment ?? '',
            ],
            // Certificate of Achievement
            'certificate_achievement' => [
                'file' => $student->certificate_achievement,
                'status' => $student->certificate_status ?? 'pending',
                'comment' => $student->certificate_comment ?? '',
            ],
            // Academic Transcript
            'academic_transcript' => [
                'file' => $student->academic_transcript,
                'status' => $student->transcript_status ?? 'pending',
                'comment' => $student->transcript_comment ?? '',
            ],
            // Father Information
            'father_info' => [
                'first_name' => $student->father_first_name,
                'last_name' => $student->father_last_name,
                'phone' => $student->father_phone,
                'email' => $student->father_email,
                'address' => $student->father_address,
                'postal_code' => $student->father_postal_code,
                'city' => $student->father_city,
                'country' => $student->father_country,
                'date_of_birth' => $student->father_date_of_birth,
                'job' => $student->father_job,
                'place_of_job' => $student->father_place_of_job,
                'condition' => $student->father_condition,
                'date_of_death' => $student->father_date_of_death,
                'status' => $student->father_info_status ?? 'pending',
                'comment' => $student->father_info_comment ?? '',
            ],
            // Mother Information
            'mother_info' => [
                'first_name' => $student->mother_first_name,
                'last_name' => $student->mother_last_name,
                'phone' => $student->mother_phone,
                'email' => $student->mother_email,
                'address' => $student->mother_address,
                'postal_code' => $student->mother_postal_code,
                'city' => $student->mother_city,
                'country' => $student->mother_country,
                'date_of_birth' => $student->mother_date_of_birth,
                'job' => $student->mother_job,
                'place_of_job' => $student->mother_place_of_job,
                'condition' => $student->mother_condition,
                'date_of_death' => $student->mother_date_of_death,
                'status' => $student->mother_info_status ?? 'pending',
                'comment' => $student->mother_info_comment ?? '',
            ],
            // Parents Relationship
            'parents_relationship' => [
                'relationship' => $student->parents_relationship,
                'status' => $student->parents_relationship_status ?? 'pending',
                'comment' => $student->parents_relationship_comment ?? '',
            ],
            'created_at' => $student->created_at,
        ]);
    }

    /**
     * Update student information status (accept/reject)
     */
    public function updateStudentInfoStatus(Request $request, $id)
    {
        $student = Student::find($id);
        
        if (!$student) {
            return response()->json(['message' => 'Student not found.'], 404);
        }

        $request->validate([
            'category' => 'required|string|in:personnel_info,academic_info,payment_proof,certificate_achievement,academic_transcript,father_info,mother_info,parents_relationship,overall',
            'status' => 'required|string|in:pending,accepted,rejected,in_progress',
            'comment' => 'nullable|string|max:1000',
        ]);

        $category = $request->category;
        $status = $request->status;
        $comment = $request->comment;

        // Map category to status and comment fields
        $statusField = '';
        $commentField = '';

        switch ($category) {
            case 'personnel_info':
                $statusField = 'personnel_info_status';
                $commentField = 'personnel_info_comment';
                break;
            case 'academic_info':
                $statusField = 'academic_info_status';
                $commentField = 'academic_info_comment';
                break;
            case 'payment_proof':
                $statusField = 'payment_proof_status';
                $commentField = 'payment_proof_comment';
                break;
            case 'certificate_achievement':
                $statusField = 'certificate_achievement_status';
                $commentField = 'certificate_achievement_comment';
                break;
            case 'academic_transcript':
                $statusField = 'academic_transcript_status';
                $commentField = 'academic_transcript_comment';
                break;
            case 'father_info':
                $statusField = 'father_info_status';
                $commentField = 'father_info_comment';
                break;
            case 'mother_info':
                $statusField = 'mother_info_status';
                $commentField = 'mother_info_comment';
                break;
            case 'parents_relationship':
                $statusField = 'parents_relationship_status';
                $commentField = 'parents_relationship_comment';
                break;
            case 'overall':
                $statusField = 'overall_status';
                break;
        }

        $updateData = [
            $statusField => $status,
        ];

        // Always update the comment field if it exists
        if ($commentField) {
            $updateData[$commentField] = $comment ?? '';
        }

        if ($category === 'certificate_achievement') {
            $updateData['certificate_status'] = $status;
            $updateData['certificate_comment'] = $comment ?? '';
        } elseif ($category === 'academic_transcript') {
            $updateData['transcript_status'] = $status;
            $updateData['transcript_comment'] = $comment ?? '';
        }

        // If overall status is being updated to accepted, update all category statuses
        if ($category === 'overall' && $status === 'accepted') {
            $updateData = array_merge($updateData, [
                'personnel_info_status' => 'accepted',
                'academic_info_status' => 'accepted',
                'payment_proof_status' => 'accepted',
                'certificate_achievement_status' => 'accepted',
                'academic_transcript_status' => 'accepted',
                'certificate_status' => 'accepted',
                'transcript_status' => 'accepted',
                'father_info_status' => 'accepted',
                'mother_info_status' => 'accepted',
                'parents_relationship_status' => 'accepted',
            ]);
        }

        $student->update($updateData);

        return response()->json([
            'message' => 'Status updated successfully.',
            'student' => [
                'id' => $student->id,
                'overall_status' => $student->overall_status,
                'statuses' => [
                    'personnel_info' => ['status' => $student->personnel_info_status],
                    'academic_info' => ['status' => $student->academic_info_status],
                    'payment_proof' => ['status' => $student->payment_proof_status],
                    'certificate_achievement' => ['status' => $student->certificate_achievement_status],
                    'academic_transcript' => ['status' => $student->academic_transcript_status],
                    'father_info' => ['status' => $student->father_info_status],
                    'mother_info' => ['status' => $student->mother_info_status],
                    'parents_relationship' => ['status' => $student->parents_relationship_status],
                ],
            ],
        ]);
    }

    /**
     * Approve a student profile (sets status to approved).
     */
    public function approveStudentProfile(Request $request, int $id)
    {
        $student = Student::find($id);

        if (!$student) {
            return response()->json(['message' => 'Student not found.'], 404);
        }

        $student->update([
            'status' => 'approved',
            'overall_status' => 'accepted',
            'approved_at' => now(),
            'status_comment' => $request->comment ?? 'Profile approved by admin',
        ]);

        return response()->json([
            'message' => 'Profile approved successfully.',
            'status' => 'approved',
            'overall_status' => 'accepted',
            'student' => [
                'id' => $student->id,
                'status' => $student->status,
                'overall_status' => $student->overall_status,
                'approved_at' => $student->approved_at,
            ],
        ]);
    }

    /**
     * Get all pending student profiles for admin review.
     */
    public function getPendingProfiles()
    {
        $pendingStudents = Student::with('user', 'classeObj')
            ->where('status', 'pending')
            ->get()
            ->map(function ($s) {
                return [
                    'id' => $s->id,
                    'user_id' => $s->user_id,
                    'name' => $s->user->name ?? '',
                    'email' => $s->user->email ?? '',
                    'matricule' => $s->matricule,
                    'classe' => $s->classe,
                    'class_name' => $s->classeObj->name ?? null,
                    'profile_picture' => $s->profile_picture,
                    'status' => $s->status ?? 'pending',
                    'last_updated_at' => $s->last_updated_at,
                    'created_at' => $s->created_at,
                ];
            });
        
        return response()->json($pendingStudents);
    }

    /**
     * Reject a student profile (sets status to rejected).
     */
    public function rejectStudentProfile(Request $request, int $id)
    {
        $student = Student::find($id);

        if (!$student) {
            return response()->json(['message' => 'Student not found.'], 404);
        }

        $student->update([
            'status' => 'rejected',
            'overall_status' => 'rejected',
            'status_comment' => $request->comment ?? 'Profile rejected by admin',
        ]);

        return response()->json([
            'message' => 'Profile rejected.',
            'status' => 'rejected',
            'overall_status' => 'rejected',
            'student' => [
                'id' => $student->id,
                'status' => $student->status,
                'overall_status' => $student->overall_status,
            ],
        ]);
    }
}
