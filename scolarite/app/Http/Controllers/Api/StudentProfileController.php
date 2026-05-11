<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Professeur;
use App\Models\Student;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class StudentProfileController extends Controller
{
    private function publicStorageUrl(Request $request, ?string $pathOrUrl): ?string
    {
        if (!$pathOrUrl || !is_string($pathOrUrl)) {
            return null;
        }

        $normalized = trim(str_replace('\\', '/', $pathOrUrl));
        if ($normalized === '') {
            return null;
        }

        if (preg_match('/^https?:\/\//i', $normalized)) {
            return $normalized;
        }

        if (str_starts_with($normalized, '/storage/')) {
            return $request->getSchemeAndHttpHost() . $request->getBasePath() . $normalized;
        }

        if (str_starts_with($normalized, 'storage/')) {
            return $request->getSchemeAndHttpHost() . $request->getBasePath() . '/' . $normalized;
        }

        return $request->getSchemeAndHttpHost() . $request->getBasePath() . '/storage/' . ltrim($normalized, '/');
    }

    /**
     * Get the profile for the authenticated student or professor.
     */
    public function show(Request $request)
    {
        /** @var User $user */
        $user = $request->user();
        if ($user->role === 'professeur') {
            return $this->showForProfesseur($request, $user);
        }

        $student = Student::where('user_id', $user->id)->with('classeObj')->first();

        if (!$student) {
            return response()->json(['message' => 'Student not found.'], 404);
        }

        $profile = $student->toArray();
        $profile['profile_picture_url'] = $this->publicStorageUrl($request, $student->profile_picture);
        $profile['cover_photo_url'] = $this->publicStorageUrl($request, $student->cover_photo);

        return response()->json([
            'student' => [
                'id' => $student->id,
                'name' => $user->name,
                'email' => $user->email,
                'matricule' => $student->matricule,
            ],
            'profile' => $profile,
            'status' => $student->status ?? 'pending',
            'role' => 'student',
        ]);
    }

    private function showForProfesseur(Request $request, User $user)
    {
        $prof = Professeur::firstOrCreate(
            ['user_id' => $user->id],
            ['matricule' => null, 'departement' => null]
        );

        $profile = $prof->toArray();
        $profile['profile_picture_url'] = $this->publicStorageUrl($request, $prof->profile_picture);
        $profile['cover_photo_url'] = $this->publicStorageUrl($request, $prof->cover_photo);

        return response()->json([
            'role' => 'professeur',
            'student' => [
                'id' => $prof->id,
                'name' => $user->name,
                'email' => $user->email,
                'matricule' => $prof->matricule,
                'departement' => $prof->departement,
            ],
            'profile' => $profile,
            'status' => 'approved',
        ]);
    }

    /**
     * Create or update the student profile (text fields).
     */
    public function update(Request $request)
    {
        /** @var User $user */
        $user = $request->user();
        if ($user->role === 'professeur') {
            return $this->updateForProfesseur($request, $user);
        }

        $student = Student::where('user_id', $user->id)->first();

        if (!$student) {
            return response()->json(['message' => 'Student not found.'], 404);
        }

        $data = $request->only([
            'phone', 'address', 'postal_code', 'city', 'country',
            'date_of_birth', 'place_of_birth', 'gender',
            'class_id', 'admission_status',
            'father_first_name', 'father_last_name', 'father_phone', 'father_email',
            'father_address', 'father_postal_code', 'father_city', 'father_country',
            'father_date_of_birth', 'father_job', 'father_place_of_job',
            'father_condition', 'father_date_of_death',
            'mother_first_name', 'mother_last_name', 'mother_phone', 'mother_email',
            'mother_address', 'mother_postal_code', 'mother_city', 'mother_country',
            'mother_date_of_birth', 'mother_job', 'mother_place_of_job',
            'mother_condition', 'mother_date_of_death',
            'parents_relationship',
        ]);

        // Also update user name/email if provided
        if ($request->has('name') || $request->has('email')) {
            $user->update(array_filter([
                'name' => $request->name,
                'email' => $request->email,
            ]));
        }

        // Check which fields are being updated and set their status to pending
        $statusFields = [];
        
        // Personnel Information (personal details)
        if ($request->hasAny(['phone', 'address', 'postal_code', 'city', 'country', 'date_of_birth', 'place_of_birth', 'gender'])) {
            $statusFields['personnel_info_status'] = 'pending';
        }

        // Academic Information
        if ($request->hasAny(['class_id', 'admission_status'])) {
            $statusFields['academic_info_status'] = 'pending';
        }

        // Father Information
        if ($request->hasAny(['father_first_name', 'father_last_name', 'father_phone', 'father_email',
            'father_address', 'father_postal_code', 'father_city', 'father_country',
            'father_date_of_birth', 'father_job', 'father_place_of_job',
            'father_condition', 'father_date_of_death'])) {
            $statusFields['father_info_status'] = 'pending';
        }

        // Mother Information
        if ($request->hasAny(['mother_first_name', 'mother_last_name', 'mother_phone', 'mother_email',
            'mother_address', 'mother_postal_code', 'mother_city', 'mother_country',
            'mother_date_of_birth', 'mother_job', 'mother_place_of_job',
            'mother_condition', 'mother_date_of_death'])) {
            $statusFields['mother_info_status'] = 'pending';
        }

        // Parents Relationship
        if ($request->has('parents_relationship')) {
            $statusFields['parents_relationship_status'] = 'pending';
        }

        // Update overall status and profile status to pending if any info is updated
        if (!empty($statusFields)) {
            $statusFields['overall_status'] = 'pending';
            $statusFields['status'] = 'pending'; // Set profile approval status to pending
            $statusFields['last_updated_at'] = now();
        }

        $student->update(array_merge($data, $statusFields));

        return response()->json([
            'profile' => $student->load('classeObj'),
            'message' => 'Profile saved successfully. Pending admin approval.'
        ]);
    }

    private function updateForProfesseur(Request $request, User $user)
    {
        $prof = Professeur::firstOrCreate(
            ['user_id' => $user->id],
            ['matricule' => null, 'departement' => null]
        );

        $data = $request->only([
            'phone', 'address', 'postal_code', 'city', 'country',
            'date_of_birth', 'place_of_birth', 'gender',
        ]);
        if (array_key_exists('date_of_birth', $data) && $data['date_of_birth'] === '') {
            $data['date_of_birth'] = null;
        }

        if ($request->has('name') || $request->has('email')) {
            $user->update(array_filter([
                'name' => $request->input('name'),
                'email' => $request->input('email'),
            ], fn ($v) => $v !== null && $v !== ''));
        }

        $prof->update($data);

        return response()->json([
            'profile' => $prof->fresh(),
            'message' => 'Profile saved successfully.',
        ]);
    }

    /**
     * Upload a file.
     * - profile_picture, cover_photo: personal customization (no admin approval)
     * - payment_proof, certificate_achievement, academic_transcript: require admin approval
     */
    public function uploadFile(Request $request, string $field)
    {
        $allowed = ['profile_picture', 'cover_photo', 'payment_proof', 'certificate_achievement', 'academic_transcript'];
        if (!in_array($field, $allowed)) {
            return response()->json(['message' => 'Invalid field.'], 422);
        }

        /** @var User $user */
        $user = $request->user();
        if ($user->role === 'professeur') {
            if (! in_array($field, ['profile_picture', 'cover_photo'], true)) {
                return response()->json(['message' => 'Invalid field for professor accounts.'], 422);
            }

            $prof = Professeur::firstOrCreate(
                ['user_id' => $user->id],
                ['matricule' => null, 'departement' => null]
            );

            $request->validate(['file' => 'required|image|mimes:jpg,jpeg,png,webp|max:5120']);

            if ($prof->$field) {
                Storage::disk('public')->delete($prof->$field);
            }

            $path = $request->file('file')->store("professeur_docs/{$prof->id}", 'public');
            $prof->update([$field => $path]);

            return response()->json([
                'path' => $path,
                'url' => $this->publicStorageUrl($request, $path),
                'status' => 'approved',
                'message' => 'Image updated successfully.',
            ]);
        }

        $student = Student::where('user_id', $user->id)->first();
        if (!$student) {
            return response()->json(['message' => 'Student not found.'], 404);
        }

        $fileRule = in_array($field, ['profile_picture', 'cover_photo'], true)
            ? 'required|image|mimes:jpg,jpeg,png,webp|max:5120'
            : 'required|file|mimes:pdf,jpg,jpeg,png,webp|max:10240';
        $request->validate(['file' => $fileRule]);

        // Delete old file
        if ($student->$field) {
            Storage::disk('public')->delete($student->$field);
        }

        $path = $request->file('file')->store("student_docs/{$student->id}", 'public');

        // Profile/cover customization should be instant and not affect approval workflow.
        if (in_array($field, ['profile_picture', 'cover_photo'], true)) {
            $student->update([$field => $path]);

            return response()->json([
                'path' => $path,
                'url' => $this->publicStorageUrl($request, $path),
                'status' => $student->status ?? 'approved',
                'message' => 'Image updated successfully.',
            ]);
        }

        // Uploaded documents still require admin review.
        $statusUpdate = [];
        switch ($field) {
            case 'payment_proof':
                $statusUpdate['payment_proof_status'] = 'pending';
                break;
            case 'certificate_achievement':
                $statusUpdate['certificate_achievement_status'] = 'pending';
                $statusUpdate['certificate_status'] = 'pending';
                break;
            case 'academic_transcript':
                $statusUpdate['academic_transcript_status'] = 'pending';
                $statusUpdate['transcript_status'] = 'pending';
                break;
        }

        $statusUpdate['overall_status'] = 'pending';
        $statusUpdate['status'] = 'pending';
        $statusUpdate['last_updated_at'] = now();

        $student->update(array_merge([$field => $path], $statusUpdate));

        return response()->json([
            'path' => $path,
            'url' => $this->publicStorageUrl($request, $path),
            'status' => 'pending',
            'message' => 'File uploaded successfully. Pending admin approval.'
        ]);
    }

    /**
     * Approve the student profile (called by admin or automatically).
     */
    public function approve(Request $request)
    {
        $user = $request->user();
        $student = Student::where('user_id', $user->id)->first();

        if (!$student) {
            return response()->json(['message' => 'Student not found.'], 404);
        }

        $student->update([
            'status' => 'approved',
            'approved_at' => now(),
            'status_comment' => $request->comment ?? 'Profile approved',
        ]);

        return response()->json([
            'message' => 'Profile approved successfully.',
            'status' => 'approved',
        ]);
    }

    /**
     * Reject the student profile.
     */
    public function reject(Request $request)
    {
        $user = $request->user();
        $student = Student::where('user_id', $user->id)->first();

        if (!$student) {
            return response()->json(['message' => 'Student not found.'], 404);
        }

        $student->update([
            'status' => 'rejected',
            'status_comment' => $request->comment ?? 'Profile rejected',
        ]);

        return response()->json([
            'message' => 'Profile rejected.',
            'status' => 'rejected',
        ]);
    }
}
