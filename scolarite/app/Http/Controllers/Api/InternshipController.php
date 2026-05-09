<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Classe;
use App\Models\DirecteurStage;
use App\Models\InternshipRequest;
use App\Models\Student;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class InternshipController extends Controller
{
    private function currentStudentOrFail(Request $request): Student
    {
        /** @var User $user */
        $user = $request->user();
        $student = Student::where('user_id', $user->id)->first();
        abort_if(!$student, 404, 'Student not found.');
        return $student;
    }

    private function currentDirecteurStageOrFail(Request $request): DirecteurStage
    {
        /** @var User $user */
        $user = $request->user();
        $ds = DirecteurStage::where('user_id', $user->id)->first();
        abort_if(!$ds, 404, 'Directeur de stage not found.');
        return $ds;
    }

    private function inferInternshipType(?Classe $classe): string
    {
        return match ($classe?->niveau) {
            'first' => 'observation',
            'second' => 'professionnel',
            default => 'pfe',
        };
    }

    private function resource(InternshipRequest $row): array
    {
        return [
            'id' => $row->id,
            'student_id' => $row->student_id,
            'student_name' => $row->student?->user?->name,
            'class_id' => $row->class_id,
            'class_name' => $row->classe?->name,
            'departement' => $row->classe?->departement,
            'teammate_student_id' => $row->teammate_student_id,
            'teammate_student_name' => $row->teammateStudent?->user?->name,
            'internship_type' => $row->internship_type,
            'company_name' => $row->company_name,
            'project_name' => $row->project_name,
            'project_description' => $row->project_description,
            'start_date' => optional($row->start_date)->toDateString(),
            'end_date' => optional($row->end_date)->toDateString(),
            'status' => $row->status,
            'director_comment' => $row->director_comment,
            'deadline_rapport' => optional($row->deadline_rapport)->toDateString(),
            'deadline_attestation' => optional($row->deadline_attestation)->toDateString(),
            'signed_demande_url' => $row->signed_demande_path ? Storage::disk('public')->url($row->signed_demande_path) : null,
            'rapport_url' => $row->rapport_path ? Storage::disk('public')->url($row->rapport_path) : null,
            'attestation_url' => $row->attestation_path ? Storage::disk('public')->url($row->attestation_path) : null,
            'signed_demande_name' => $row->signed_demande_path ? basename($row->signed_demande_path) : null,
            'rapport_name' => $row->rapport_path ? basename($row->rapport_path) : null,
            'attestation_name' => $row->attestation_path ? basename($row->attestation_path) : null,
            'rapport_status' => $row->rapport_status ?? 'not_uploaded',
            'attestation_status' => $row->attestation_status ?? 'not_uploaded',
            'rapport_review_comment' => $row->rapport_review_comment,
            'attestation_review_comment' => $row->attestation_review_comment,
            'rapport_reviewed_at' => $row->rapport_reviewed_at,
            'attestation_reviewed_at' => $row->attestation_reviewed_at,
            'signed_demande_uploaded_at' => $row->signed_demande_uploaded_at,
            'approved_at' => $row->approved_at,
            'rejected_at' => $row->rejected_at,
            'created_at' => $row->created_at,
            'updated_at' => $row->updated_at,
        ];
    }

    private function kindToPath(InternshipRequest $row, string $kind): ?string
    {
        return match ($kind) {
            'signed_demande' => $row->signed_demande_path,
            'rapport' => $row->rapport_path,
            'attestation' => $row->attestation_path,
            default => null,
        };
    }

    public function studentContext(Request $request)
    {
        $student = $this->currentStudentOrFail($request);
        $myClass = $student->class_id ? Classe::find($student->class_id) : null;

        $departements = Classe::query()
            ->whereNotNull('departement')
            ->where('departement', '!=', '')
            ->where('departement', '!=', '__YEAR__')
            ->distinct()
            ->orderBy('departement')
            ->pluck('departement')
            ->values();

        $classes = Classe::query()
            ->whereNotNull('departement')
            ->where('departement', '!=', '')
            ->where('departement', '!=', '__YEAR__')
            ->orderBy('departement')
            ->orderBy('name')
            ->get(['id', 'name', 'departement', 'annee_scolaire', 'niveau']);

        $students = Student::query()
            ->with('user')
            ->whereNotNull('class_id')
            ->orderBy('class_id')
            ->get()
            ->map(fn (Student $s) => [
                'id' => $s->id,
                'name' => $s->user?->name,
                'class_id' => $s->class_id,
            ]);

        return response()->json([
            'my_student_id' => $student->id,
            'my_class_id' => $student->class_id,
            'my_class_niveau' => $myClass?->niveau,
            'recommended_type' => $this->inferInternshipType($myClass),
            'departements' => $departements,
            'classes' => $classes,
            'students' => $students,
        ]);
    }

    public function studentIndex(Request $request)
    {
        $student = $this->currentStudentOrFail($request);
        $rows = InternshipRequest::query()
            ->with(['student.user', 'classe', 'teammateStudent.user', 'approvedByDirecteurStage.user'])
            ->where('student_id', $student->id)
            ->orWhere('teammate_student_id', $student->id)
            ->orderByDesc('id')
            ->get()
            ->map(fn (InternshipRequest $r) => $this->resource($r));

        return response()->json($rows);
    }

    public function studentStore(Request $request)
    {
        $student = $this->currentStudentOrFail($request);
        $data = $request->validate([
            'company_name' => 'required|string|max:180',
            'project_name' => 'nullable|string|max:180',
            'project_description' => 'nullable|string|max:2000',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'teammate_student_id' => 'nullable|integer|exists:students,id|different:student_id',
            'internship_type' => 'nullable|string|in:observation,professionnel,pfe',
        ]);

        $classe = $student->class_id ? Classe::find($student->class_id) : null;
        $internshipType = $data['internship_type'] ?? $this->inferInternshipType($classe);

        $row = InternshipRequest::create([
            'student_id' => $student->id,
            'class_id' => $student->class_id,
            'teammate_student_id' => $data['teammate_student_id'] ?? null,
            'internship_type' => $internshipType,
            'company_name' => $data['company_name'],
            'project_name' => $data['project_name'] ?? null,
            'project_description' => $data['project_description'] ?? null,
            'start_date' => $data['start_date'],
            'end_date' => $data['end_date'],
            'status' => 'draft',
        ]);

        $row->load(['student.user', 'classe', 'teammateStudent.user', 'approvedByDirecteurStage.user']);
        return response()->json($this->resource($row), 201);
    }

    public function studentUpdate(Request $request, int $id)
    {
        $student = $this->currentStudentOrFail($request);
        $row = InternshipRequest::where('id', $id)->where('student_id', $student->id)->firstOrFail();
        abort_if(in_array($row->status, ['approved'], true), 422, 'Approved requests cannot be modified.');

        $data = $request->validate([
            'company_name' => 'required|string|max:180',
            'project_name' => 'nullable|string|max:180',
            'project_description' => 'nullable|string|max:2000',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'teammate_student_id' => 'nullable|integer|exists:students,id',
            'internship_type' => 'nullable|string|in:observation,professionnel,pfe',
        ]);

        $row->update([
            'company_name' => $data['company_name'],
            'project_name' => $data['project_name'] ?? null,
            'project_description' => $data['project_description'] ?? null,
            'start_date' => $data['start_date'],
            'end_date' => $data['end_date'],
            'teammate_student_id' => $data['teammate_student_id'] ?? null,
            'internship_type' => $data['internship_type'] ?? $row->internship_type,
        ]);

        $row->load(['student.user', 'classe', 'teammateStudent.user', 'approvedByDirecteurStage.user']);
        return response()->json($this->resource($row));
    }

    public function studentDemandePdfPreview(Request $request)
    {
        $student = $this->currentStudentOrFail($request);
        $data = $request->validate([
            'company_name' => 'required|string|max:180',
            'project_name' => 'nullable|string|max:180',
            'project_description' => 'nullable|string|max:2000',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'teammate_student_id' => 'nullable|integer|exists:students,id',
            'internship_type' => 'nullable|string|in:observation,professionnel,pfe',
        ]);

        $classe = $student->class_id ? Classe::find($student->class_id) : null;
        $internshipType = $data['internship_type'] ?? $this->inferInternshipType($classe);
        $teammate = isset($data['teammate_student_id'])
            ? Student::with('user')->find($data['teammate_student_id'])
            : null;

        $pdf = Pdf::loadView('pdf.internship_demande_unsigned_preview', [
            'today' => now()->toDateString(),
            'studentName' => $student->user?->name,
            'className' => $classe?->name,
            'classDept' => $classe?->departement,
            'internshipType' => $internshipType,
            'companyName' => $data['company_name'],
            'projectName' => $data['project_name'] ?? null,
            'projectDescription' => $data['project_description'] ?? null,
            'startDate' => (string) $data['start_date'],
            'endDate' => (string) $data['end_date'],
            'teammateName' => $teammate?->user?->name,
        ])->setPaper('a4');

        return $pdf->download("demande_stage_preview.pdf");
    }

    public function studentSubmitSigned(Request $request)
    {
        $student = $this->currentStudentOrFail($request);
        $data = $request->validate([
            'company_name' => 'required|string|max:180',
            'project_name' => 'nullable|string|max:180',
            'project_description' => 'nullable|string|max:2000',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'teammate_student_id' => 'nullable|integer|exists:students,id',
            'internship_type' => 'nullable|string|in:observation,professionnel,pfe',
            'file' => 'required|file|mimes:pdf,jpg,jpeg,png,webp|max:8192',
        ]);

        $classe = $student->class_id ? Classe::find($student->class_id) : null;
        $internshipType = $data['internship_type'] ?? $this->inferInternshipType($classe);

        $row = InternshipRequest::create([
            'student_id' => $student->id,
            'class_id' => $student->class_id,
            'teammate_student_id' => $data['teammate_student_id'] ?? null,
            'internship_type' => $internshipType,
            'company_name' => $data['company_name'],
            'project_name' => $data['project_name'] ?? null,
            'project_description' => $data['project_description'] ?? null,
            'start_date' => $data['start_date'],
            'end_date' => $data['end_date'],
            'status' => 'draft',
        ]);

        $path = $request->file('file')->store("internships/{$row->id}/signed", 'public');
        $row->update([
            'signed_demande_path' => $path,
            'signed_demande_uploaded_at' => now(),
            'status' => 'signed_submitted',
            'rejected_at' => null,
        ]);

        $row->load(['student.user', 'classe', 'teammateStudent.user', 'approvedByDirecteurStage.user']);
        return response()->json($this->resource($row), 201);
    }

    public function studentUploadSignedDemande(Request $request, int $id)
    {
        $student = $this->currentStudentOrFail($request);
        $row = InternshipRequest::where('id', $id)->where('student_id', $student->id)->firstOrFail();

        $request->validate([
            'file' => 'required|file|mimes:pdf,jpg,jpeg,png,webp|max:8192',
        ]);
        $path = $request->file('file')->store("internships/{$row->id}/signed", 'public');

        $row->update([
            'signed_demande_path' => $path,
            'signed_demande_uploaded_at' => now(),
            'status' => 'signed_submitted',
            'rejected_at' => null,
        ]);
        $row->load(['student.user', 'classe', 'teammateStudent.user', 'approvedByDirecteurStage.user']);
        return response()->json($this->resource($row));
    }

    public function studentUploadRapport(Request $request, int $id)
    {
        $student = $this->currentStudentOrFail($request);
        $row = InternshipRequest::where('id', $id)->where('student_id', $student->id)->firstOrFail();
        abort_if($row->status !== 'approved', 422, 'Rapport upload allowed after approval.');

        $request->validate(['file' => 'required|file|mimes:pdf,jpg,jpeg,png,webp|max:10240']);
        $path = $request->file('file')->store("internships/{$row->id}/rapport", 'public');
        $row->update([
            'rapport_path' => $path,
            'rapport_status' => 'pending_review',
            'rapport_review_comment' => null,
            'rapport_reviewed_at' => null,
        ]);
        $row->load(['student.user', 'classe', 'teammateStudent.user', 'approvedByDirecteurStage.user']);
        return response()->json($this->resource($row));
    }

    public function studentUploadAttestation(Request $request, int $id)
    {
        $student = $this->currentStudentOrFail($request);
        $row = InternshipRequest::where('id', $id)->where('student_id', $student->id)->firstOrFail();
        abort_if($row->status !== 'approved', 422, 'Attestation upload allowed after approval.');

        $request->validate(['file' => 'required|file|mimes:pdf,jpg,jpeg,png,webp|max:10240']);
        $path = $request->file('file')->store("internships/{$row->id}/attestation", 'public');
        $row->update([
            'attestation_path' => $path,
            'attestation_status' => 'pending_review',
            'attestation_review_comment' => null,
            'attestation_reviewed_at' => null,
        ]);
        $row->load(['student.user', 'classe', 'teammateStudent.user', 'approvedByDirecteurStage.user']);
        return response()->json($this->resource($row));
    }

    public function studentDemandePdf(Request $request, int $id)
    {
        $student = $this->currentStudentOrFail($request);
        $row = InternshipRequest::with(['student.user', 'teammateStudent.user', 'classe'])
            ->where('id', $id)
            ->where('student_id', $student->id)
            ->firstOrFail();

        $pdf = Pdf::loadView('pdf.internship_demande_unsigned', [
            'row' => $row,
            'today' => now()->toDateString(),
        ])->setPaper('a4');

        return $pdf->download("demande_stage_{$row->id}.pdf");
    }

    public function studentAffectationPdf(Request $request, int $id)
    {
        $student = $this->currentStudentOrFail($request);
        $row = InternshipRequest::with(['student.user', 'teammateStudent.user', 'classe'])
            ->where('id', $id)
            ->where('student_id', $student->id)
            ->firstOrFail();
        abort_if($row->status !== 'approved', 422, 'Affectation letter available after approval.');

        $pdf = Pdf::loadView('pdf.internship_affectation_letter', [
            'row' => $row,
            'today' => now()->toDateString(),
        ])->setPaper('a4');

        return $pdf->download("lettre_affectation_stage_{$row->id}.pdf");
    }

    public function studentDownloadFile(Request $request, int $id, string $kind)
    {
        $student = $this->currentStudentOrFail($request);
        $row = InternshipRequest::query()
            ->where('id', $id)
            ->where(function ($q) use ($student) {
                $q->where('student_id', $student->id)
                  ->orWhere('teammate_student_id', $student->id);
            })
            ->firstOrFail();

        $path = $this->kindToPath($row, $kind);
        abort_if(!$path, 404, 'File not found.');
        abort_if(!Storage::disk('public')->exists($path), 404, 'File not found.');

        return Storage::disk('public')->download($path);
    }

    public function studentViewFile(Request $request, int $id, string $kind)
    {
        $student = $this->currentStudentOrFail($request);
        $row = InternshipRequest::query()
            ->where('id', $id)
            ->where(function ($q) use ($student) {
                $q->where('student_id', $student->id)
                  ->orWhere('teammate_student_id', $student->id);
            })
            ->firstOrFail();

        $path = $this->kindToPath($row, $kind);
        abort_if(!$path, 404, 'File not found.');
        abort_if(!Storage::disk('public')->exists($path), 404, 'File not found.');

        $absolutePath = Storage::disk('public')->path($path);
        $mime = Storage::disk('public')->mimeType($path) ?: 'application/octet-stream';

        return response()->file($absolutePath, [
            'Content-Type' => $mime,
            'Content-Disposition' => 'inline; filename="' . basename($path) . '"',
        ]);
    }

    public function directeurIndex(Request $request)
    {
        $this->currentDirecteurStageOrFail($request);
        $rows = InternshipRequest::query()
            ->with(['student.user', 'classe', 'teammateStudent.user', 'approvedByDirecteurStage.user'])
            ->orderByDesc('id')
            ->get()
            ->map(fn (InternshipRequest $r) => $this->resource($r));

        return response()->json($rows);
    }

    public function directeurDecision(Request $request, int $id)
    {
        $ds = $this->currentDirecteurStageOrFail($request);
        $data = $request->validate([
            'decision' => 'required|string|in:approved,rejected',
            'director_comment' => 'nullable|string|max:1500',
            'deadline_rapport' => 'nullable|date',
            'deadline_attestation' => 'nullable|date',
        ]);

        $row = InternshipRequest::with(['student.user', 'classe', 'teammateStudent.user', 'approvedByDirecteurStage.user'])->findOrFail($id);
        if ($data['decision'] === 'approved') {
            abort_if(!$row->signed_demande_path, 422, 'Signed internship request is required before approval.');
            abort_if($row->status !== 'signed_submitted' && $row->status !== 'approved', 422, 'Request must be submitted (signed) before approval.');
            $row->update([
                'status' => 'approved',
                'approved_by_directeur_stage_id' => $ds->id,
                'approved_at' => now(),
                'rejected_at' => null,
                'director_comment' => $data['director_comment'] ?? null,
                'deadline_rapport' => $data['deadline_rapport'] ?? null,
                'deadline_attestation' => $data['deadline_attestation'] ?? null,
            ]);
        } else {
            $row->update([
                'status' => 'rejected',
                'approved_by_directeur_stage_id' => null,
                'approved_at' => null,
                'rejected_at' => now(),
                'director_comment' => $data['director_comment'] ?? null,
            ]);
        }

        $row->refresh()->load(['student.user', 'classe', 'teammateStudent.user', 'approvedByDirecteurStage.user']);
        return response()->json($this->resource($row));
    }

    public function directeurDestroy(Request $request, int $id)
    {
        $this->currentDirecteurStageOrFail($request);
        $row = InternshipRequest::findOrFail($id);

        // Delete stored files for this internship (if any)
        Storage::disk('public')->deleteDirectory("internships/{$row->id}");

        $row->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    public function directeurDocumentDecision(Request $request, int $id)
    {
        $this->currentDirecteurStageOrFail($request);
        $data = $request->validate([
            'kind' => 'required|string|in:rapport,attestation',
            'decision' => 'required|string|in:accepted,rejected',
            'comment' => 'nullable|string|max:1500',
        ]);

        $row = InternshipRequest::findOrFail($id);
        abort_if($row->status !== 'approved', 422, 'Internship must be approved first.');

        if ($data['kind'] === 'rapport') {
            abort_if(!$row->rapport_path, 422, 'Report file is required.');
            $row->update([
                'rapport_status' => $data['decision'],
                'rapport_review_comment' => $data['comment'] ?? null,
                'rapport_reviewed_at' => now(),
            ]);
        } else {
            abort_if(!$row->attestation_path, 422, 'Attestation file is required.');
            $row->update([
                'attestation_status' => $data['decision'],
                'attestation_review_comment' => $data['comment'] ?? null,
                'attestation_reviewed_at' => now(),
            ]);
        }

        $row->refresh()->load(['student.user', 'classe', 'teammateStudent.user', 'approvedByDirecteurStage.user']);
        return response()->json($this->resource($row));
    }

    public function directeurDownloadFile(Request $request, int $id, string $kind)
    {
        $this->currentDirecteurStageOrFail($request);
        $row = InternshipRequest::findOrFail($id);

        $path = $this->kindToPath($row, $kind);
        abort_if(!$path, 404, 'File not found.');
        abort_if(!Storage::disk('public')->exists($path), 404, 'File not found.');

        return Storage::disk('public')->download($path);
    }

    public function directeurViewFile(Request $request, int $id, string $kind)
    {
        $this->currentDirecteurStageOrFail($request);
        $row = InternshipRequest::findOrFail($id);

        $path = $this->kindToPath($row, $kind);
        abort_if(!$path, 404, 'File not found.');
        abort_if(!Storage::disk('public')->exists($path), 404, 'File not found.');

        $absolutePath = Storage::disk('public')->path($path);
        $mime = Storage::disk('public')->mimeType($path) ?: 'application/octet-stream';

        return response()->file($absolutePath, [
            'Content-Type' => $mime,
            'Content-Disposition' => 'inline; filename="' . basename($path) . '"',
        ]);
    }
}
