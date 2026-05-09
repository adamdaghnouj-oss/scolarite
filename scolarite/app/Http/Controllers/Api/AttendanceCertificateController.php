<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceCertificateApproval;
use App\Models\AttendanceCertificateRequest;
use App\Models\Professeur;
use App\Models\Student;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Barryvdh\DomPDF\Facade\Pdf;

class AttendanceCertificateController extends Controller
{
    private function currentStudentOrFail(Request $request): Student
    {
        /** @var User $user */
        $user = $request->user();
        $student = Student::where('user_id', $user->id)->first();
        abort_if(!$student, 404, 'Student not found.');
        return $student;
    }

    private function currentProfesseurOrCreate(Request $request): Professeur
    {
        /** @var User $user */
        $user = $request->user();
        return Professeur::firstOrCreate(
            ['user_id' => $user->id],
            ['matricule' => null, 'departement' => null]
        );
    }

    private function requestResource(AttendanceCertificateRequest $r): array
    {
        $approvals = $r->approvals->map(function (AttendanceCertificateApproval $a) {
            return [
                'id' => $a->id,
                'professeur_id' => $a->professeur_id,
                'professeur_name' => $a->professeur?->user?->name,
                'decision' => $a->decision,
                'decided_at' => $a->decided_at,
                'note' => $a->note,
            ];
        })->values();

        return [
            'id' => $r->id,
            'student_id' => $r->student_id,
            'student_name' => $r->student?->user?->name,
            'professeur1_id' => $r->professeur1_id,
            'professeur1_name' => $r->professeur1?->user?->name,
            'professeur2_id' => $r->professeur2_id,
            'professeur2_name' => $r->professeur2?->user?->name,
            'language' => $r->language,
            'copies' => (int) $r->copies,
            'status' => $r->status,
            'accepted_by_professeur_id' => $r->accepted_by_professeur_id,
            'accepted_by_professeur_name' => $r->acceptedByProfesseur?->user?->name,
            'accepted_at' => $r->accepted_at,
            'rejected_at' => $r->rejected_at,
            'created_at' => $r->created_at,
            'updated_at' => $r->updated_at,
            'approvals' => $approvals,
        ];
    }

    // -----------------------
    // Student
    // -----------------------
    public function studentIndex(Request $request)
    {
        $student = $this->currentStudentOrFail($request);

        $rows = AttendanceCertificateRequest::query()
            ->where('student_id', $student->id)
            ->with([
                'student.user',
                'professeur1.user',
                'professeur2.user',
                'acceptedByProfesseur.user',
                'approvals.professeur.user',
            ])
            ->orderByDesc('id')
            ->get()
            ->map(fn ($r) => $this->requestResource($r));

        return response()->json($rows);
    }

    public function studentStore(Request $request)
    {
        $student = $this->currentStudentOrFail($request);

        $data = $request->validate([
            'professeur1_id' => 'required|integer|exists:professeurs,id',
            'professeur2_id' => 'required|integer|exists:professeurs,id|different:professeur1_id',
            'language' => 'nullable|string|in:fr,en,ar',
            'copies' => 'nullable|integer|min:1|max:20',
        ]);

        $language = $data['language'] ?? 'fr';
        $copies = (int) ($data['copies'] ?? 1);

        return DB::transaction(function () use ($student, $data, $language, $copies) {
            $req = AttendanceCertificateRequest::create([
                'student_id' => $student->id,
                'professeur1_id' => (int) $data['professeur1_id'],
                'professeur2_id' => (int) $data['professeur2_id'],
                'language' => $language,
                'copies' => $copies,
                'status' => 'pending',
            ]);

            AttendanceCertificateApproval::create([
                'attendance_certificate_request_id' => $req->id,
                'professeur_id' => (int) $data['professeur1_id'],
                'decision' => 'pending',
            ]);
            AttendanceCertificateApproval::create([
                'attendance_certificate_request_id' => $req->id,
                'professeur_id' => (int) $data['professeur2_id'],
                'decision' => 'pending',
            ]);

            $req->load([
                'student.user',
                'professeur1.user',
                'professeur2.user',
                'acceptedByProfesseur.user',
                'approvals.professeur.user',
            ]);

            return response()->json($this->requestResource($req), 201);
        });
    }

    // -----------------------
    // Professor
    // -----------------------
    public function professeurInbox(Request $request)
    {
        $prof = $this->currentProfesseurOrCreate($request);

        $rows = AttendanceCertificateRequest::query()
            ->whereHas('approvals', function ($q) use ($prof) {
                $q->where('professeur_id', $prof->id);
            })
            ->with([
                'student.user',
                'professeur1.user',
                'professeur2.user',
                'acceptedByProfesseur.user',
                'approvals.professeur.user',
            ])
            ->orderByDesc('id')
            ->get()
            ->map(fn ($r) => $this->requestResource($r));

        return response()->json($rows);
    }

    public function professeurDecide(Request $request, int $id)
    {
        $prof = $this->currentProfesseurOrCreate($request);

        $payload = $request->validate([
            'decision' => 'required|string|in:accepted,rejected',
            'note' => 'nullable|string|max:500',
        ]);

        return DB::transaction(function () use ($prof, $id, $payload) {
            $req = AttendanceCertificateRequest::lockForUpdate()
                ->with(['approvals'])
                ->findOrFail($id);

            $approval = $req->approvals->firstWhere('professeur_id', $prof->id);
            abort_if(!$approval, 403, 'Forbidden.');

            if ($req->status !== 'pending') {
                $req->load([
                    'student.user',
                    'professeur1.user',
                    'professeur2.user',
                    'acceptedByProfesseur.user',
                    'approvals.professeur.user',
                ]);
                return response()->json($this->requestResource($req));
            }

            $approval->update([
                'decision' => $payload['decision'],
                'note' => $payload['note'] ?? null,
                'decided_at' => now(),
            ]);

            if ($payload['decision'] === 'accepted') {
                $req->update([
                    'status' => 'accepted',
                    'accepted_by_professeur_id' => $prof->id,
                    'accepted_at' => now(),
                    'rejected_at' => null,
                ]);
            } else {
                $decisions = $req->approvals()->pluck('decision')->all();
                $rejectedCount = count(array_filter($decisions, fn ($d) => $d === 'rejected'));
                if ($rejectedCount >= 2) {
                    $req->update([
                        'status' => 'rejected',
                        'rejected_at' => now(),
                        'accepted_by_professeur_id' => null,
                        'accepted_at' => null,
                    ]);
                }
            }

            $req->load([
                'student.user',
                'professeur1.user',
                'professeur2.user',
                'acceptedByProfesseur.user',
                'approvals.professeur.user',
            ]);

            return response()->json($this->requestResource($req));
        });
    }

    // -----------------------
    // Admin
    // -----------------------
    public function adminIndex()
    {
        $rows = AttendanceCertificateRequest::query()
            ->with([
                'student.user',
                'professeur1.user',
                'professeur2.user',
                'acceptedByProfesseur.user',
                'approvals.professeur.user',
            ])
            ->orderByDesc('id')
            ->get()
            ->map(fn ($r) => $this->requestResource($r));

        return response()->json($rows);
    }

    public function adminPdf(Request $request, int $id)
    {
        $req = AttendanceCertificateRequest::with(['student.user'])->findOrFail($id);
        abort_if($req->status !== 'accepted', 422, 'Request must be accepted.');

        $lang = $request->query('lang');
        if (!in_array($lang, ['fr', 'en', 'ar'], true)) {
            $lang = $req->language ?: 'fr';
        }

        $studentName = $req->student?->user?->name ?? 'Student';
        $today = now()->toDateString();

        $pdf = Pdf::loadView('pdf.attendance_certificate', [
            'lang' => $lang,
            'studentName' => $studentName,
            'today' => $today,
            'requestId' => $req->id,
        ])->setPaper('a4');

        $filename = "attendance_certificate_{$req->id}_{$lang}.pdf";
        return $pdf->download($filename);
    }
}

