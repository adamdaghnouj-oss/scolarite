<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Classe;
use App\Models\DirecteurStage;
use App\Models\InternshipRequest;
use App\Models\InternshipSoutenanceJuryMember;
use App\Models\Professeur;
use App\Models\Student;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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

    /** Number of jury professors required for the defense (soutenance). */
    private function requiredJurySlots(string $internshipType): int
    {
        return match ($internshipType) {
            'observation' => 1,
            'professionnel' => 2,
            default => 4,
        };
    }

    private function internshipApiRelations(): array
    {
        return ['student.user', 'classe', 'teammateStudent.user', 'approvedByDirecteurStage.user', 'soutenanceJuryMembers.professeur.user', 'encadrantProfesseur.user'];
    }

    private function internshipPostDirectorApprovalStatuses(): array
    {
        return ['approved', 'documents_pending_review', 'documents_accepted'];
    }

    private function internshipAllowsStudentDocumentUpload(InternshipRequest $row): bool
    {
        return in_array($row->status, ['approved', 'documents_pending_review'], true);
    }

    /** Sets status to documents_accepted or documents_pending_review from rapport/attestation outcomes. */
    private function syncInternshipMainStatusFromDocuments(InternshipRequest $row): void
    {
        $r = $row->rapport_status ?? 'not_uploaded';
        $a = $row->attestation_status ?? 'not_uploaded';

        if ($r === 'accepted' && $a === 'accepted') {
            if ($row->status !== 'documents_accepted') {
                $row->update(['status' => 'documents_accepted']);
            }

            return;
        }

        if (! in_array($row->status, $this->internshipPostDirectorApprovalStatuses(), true)) {
            return;
        }

        $row->update(['status' => 'documents_pending_review']);
    }

    private function internshipIsSoutenanceEligible(InternshipRequest $row): bool
    {
        if (in_array($row->status, ['draft', 'signed_submitted', 'rejected'], true)) {
            return false;
        }

        return $row->rapport_status === 'accepted'
            && $row->attestation_status === 'accepted';
    }

    /** PFE only: rapport accepted; director assigns encadrant + dates. */
    private function internshipIsEncadrementEligible(InternshipRequest $row): bool
    {
        if (in_array($row->status, ['draft', 'signed_submitted', 'rejected'], true)) {
            return false;
        }

        return $row->internship_type === 'pfe'
            && $row->rapport_status === 'accepted';
    }

    /** @return list<array{professeur_id:int,name:?string,position:int}> */
    private function juryRowsArray(InternshipRequest $row): array
    {
        $members = $row->relationLoaded('soutenanceJuryMembers')
            ? $row->soutenanceJuryMembers
            : $row->soutenanceJuryMembers()->with('professeur.user')->orderBy('position')->get();

        return $members->sortBy('position')->values()->map(fn (InternshipSoutenanceJuryMember $m) => [
            'professeur_id' => (int) $m->professeur_id,
            'name' => $m->professeur?->user?->name,
            'position' => (int) $m->position,
        ])->all();
    }

    private function resource(InternshipRequest $row, bool $forStudent = false): array
    {
        $jury = $this->juryRowsArray($row);
        $expected = $this->requiredJurySlots((string) $row->internship_type);

        $base = [
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
            'soutenance_published_at' => $row->soutenance_published_at,
        ];

        if ($forStudent) {
            $published = $row->soutenance_published_at !== null;
            if ($published) {
                $base['soutenance_date'] = optional($row->soutenance_date)->toDateString();
                $base['soutenance_jury'] = array_map(fn (array $j) => [
                    'name' => $j['name'],
                    'position' => $j['position'],
                ], $jury);
            } else {
                $base['soutenance_date'] = null;
                $base['soutenance_jury'] = null;
            }

            $encComplete = $row->internship_type === 'pfe'
                && $row->encadrant_professeur_id
                && $row->encadrement_start_date
                && $row->encadrement_end_date;
            if ($encComplete) {
                $base['encadrant_professeur_id'] = $row->encadrant_professeur_id;
                $base['encadrant_name'] = $row->encadrantProfesseur?->user?->name;
                $base['encadrement_start_date'] = optional($row->encadrement_start_date)->toDateString();
                $base['encadrement_end_date'] = optional($row->encadrement_end_date)->toDateString();
            } else {
                $base['encadrant_professeur_id'] = null;
                $base['encadrant_name'] = null;
                $base['encadrement_start_date'] = null;
                $base['encadrement_end_date'] = null;
            }

            return $base;
        }

        $base['encadrant_professeur_id'] = $row->encadrant_professeur_id;
        $base['encadrant_name'] = $row->encadrantProfesseur?->user?->name;
        $base['encadrement_start_date'] = optional($row->encadrement_start_date)->toDateString();
        $base['encadrement_end_date'] = optional($row->encadrement_end_date)->toDateString();

        $base['soutenance_date'] = optional($row->soutenance_date)->toDateString();
        $base['soutenance_jury'] = $jury;
        $base['soutenance_jury_expected'] = $expected;

        return $base;
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
        $rels = $this->internshipApiRelations();
        $rows = InternshipRequest::query()
            ->with($rels)
            ->where('student_id', $student->id)
            ->orWhere('teammate_student_id', $student->id)
            ->orderByDesc('id')
            ->get()
            ->map(fn (InternshipRequest $r) => $this->resource($r, true));

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

        $row->load($this->internshipApiRelations());
        return response()->json($this->resource($row, true), 201);
    }

    public function studentUpdate(Request $request, int $id)
    {
        $student = $this->currentStudentOrFail($request);
        $row = InternshipRequest::where('id', $id)->where('student_id', $student->id)->firstOrFail();
        abort_if(in_array($row->status, ['approved', 'documents_pending_review', 'documents_accepted'], true), 422, 'Approved requests cannot be modified.');

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

        $row->load($this->internshipApiRelations());
        return response()->json($this->resource($row, true));
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

        $row->load($this->internshipApiRelations());
        return response()->json($this->resource($row, true), 201);
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
        $row->load($this->internshipApiRelations());
        return response()->json($this->resource($row, true));
    }

    public function studentUploadRapport(Request $request, int $id)
    {
        $student = $this->currentStudentOrFail($request);
        $row = InternshipRequest::where('id', $id)->where('student_id', $student->id)->firstOrFail();
        abort_if(! $this->internshipAllowsStudentDocumentUpload($row), 422, 'Rapport upload allowed after approval until documents are fully accepted.');

        $request->validate(['file' => 'required|file|mimes:pdf,jpg,jpeg,png,webp|max:10240']);
        $path = $request->file('file')->store("internships/{$row->id}/rapport", 'public');
        $nextStatus = $row->status === 'approved' ? 'documents_pending_review' : $row->status;
        $row->update([
            'rapport_path' => $path,
            'rapport_status' => 'pending_review',
            'rapport_review_comment' => null,
            'rapport_reviewed_at' => null,
            'status' => $nextStatus,
        ]);
        $row->load($this->internshipApiRelations());
        return response()->json($this->resource($row, true));
    }

    public function studentUploadAttestation(Request $request, int $id)
    {
        $student = $this->currentStudentOrFail($request);
        $row = InternshipRequest::where('id', $id)->where('student_id', $student->id)->firstOrFail();
        abort_if(! $this->internshipAllowsStudentDocumentUpload($row), 422, 'Attestation upload allowed after approval until documents are fully accepted.');

        $request->validate(['file' => 'required|file|mimes:pdf,jpg,jpeg,png,webp|max:10240']);
        $path = $request->file('file')->store("internships/{$row->id}/attestation", 'public');
        $nextStatus = $row->status === 'approved' ? 'documents_pending_review' : $row->status;
        $row->update([
            'attestation_path' => $path,
            'attestation_status' => 'pending_review',
            'attestation_review_comment' => null,
            'attestation_reviewed_at' => null,
            'status' => $nextStatus,
        ]);
        $row->load($this->internshipApiRelations());
        return response()->json($this->resource($row, true));
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
        abort_if(! in_array($row->status, $this->internshipPostDirectorApprovalStatuses(), true), 422, 'Affectation letter available after approval.');

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
            ->with($this->internshipApiRelations())
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

        $row = InternshipRequest::with($this->internshipApiRelations())->findOrFail($id);
        if ($data['decision'] === 'approved') {
            abort_if(!$row->signed_demande_path, 422, 'Signed internship request is required before approval.');
            abort_if(! in_array($row->status, ['signed_submitted', 'approved'], true), 422, 'Request must be submitted (signed) before approval.');
            $row->update([
                'status' => 'approved',
                'approved_by_directeur_stage_id' => $ds->id,
                'approved_at' => $row->approved_at ?? now(),
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

        $row->refresh()->load($this->internshipApiRelations());
        return response()->json($this->resource($row));
    }

    /** Update comment and deadlines after initial approval (without changing status). Soutenance date/jury: use soutenance board. */
    public function directeurUpdateApprovedMeta(Request $request, int $id)
    {
        $this->currentDirecteurStageOrFail($request);
        $row = InternshipRequest::findOrFail($id);
        abort_if(! in_array($row->status, $this->internshipPostDirectorApprovalStatuses(), true), 422, 'Only internships after director approval can be updated here.');

        $data = $request->validate([
            'director_comment' => 'nullable|string|max:1500',
            'deadline_rapport' => 'nullable|date',
            'deadline_attestation' => 'nullable|date',
        ]);

        $row->update([
            'director_comment' => $data['director_comment'] ?? null,
            'deadline_rapport' => $data['deadline_rapport'] ?? null,
            'deadline_attestation' => $data['deadline_attestation'] ?? null,
        ]);

        $row->refresh()->load($this->internshipApiRelations());
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
        abort_if(! in_array($row->status, $this->internshipPostDirectorApprovalStatuses(), true), 422, 'Internship must be approved first.');

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

        $row->refresh();
        $this->syncInternshipMainStatusFromDocuments($row);
        $row->refresh()->load($this->internshipApiRelations());

        return response()->json($this->resource($row));
    }

    public function directeurSoutenanceBoard(Request $request)
    {
        $this->currentDirecteurStageOrFail($request);
        $classId = $request->query('class_id');

        $q = InternshipRequest::query()
            ->with($this->internshipApiRelations())
            ->whereIn('status', $this->internshipPostDirectorApprovalStatuses())
            ->where('rapport_status', 'accepted')
            ->where('attestation_status', 'accepted');

        if ($classId !== null && $classId !== '') {
            $q->where('class_id', (int) $classId);
        }

        $rows = $q->orderByDesc('id')->get()->map(fn (InternshipRequest $r) => $this->resource($r));

        return response()->json($rows);
    }

    public function directeurSoutenanceUpdate(Request $request, int $id)
    {
        $this->currentDirecteurStageOrFail($request);
        $data = $request->validate([
            'soutenance_date' => 'nullable|date',
            'jury_professeur_ids' => 'required|array',
            'jury_professeur_ids.*' => 'integer|exists:professeurs,id',
        ]);

        $row = InternshipRequest::with('soutenanceJuryMembers')->findOrFail($id);
        abort_unless($this->internshipIsSoutenanceEligible($row), 422, 'Internship is not ready for jury assignment (documents must be accepted).');

        $expected = $this->requiredJurySlots((string) $row->internship_type);
        $ids = array_values($data['jury_professeur_ids']);
        abort_if(count($ids) !== $expected, 422, "Exactly {$expected} jury professor(s) required for this internship type.");
        abort_if(count(array_unique($ids)) !== count($ids), 422, 'Duplicate professors in jury.');

        DB::transaction(function () use ($row, $ids, $data) {
            $row->soutenanceJuryMembers()->delete();
            foreach ($ids as $i => $pid) {
                InternshipSoutenanceJuryMember::create([
                    'internship_request_id' => $row->id,
                    'professeur_id' => $pid,
                    'position' => $i + 1,
                ]);
            }
            $row->update([
                'soutenance_date' => $data['soutenance_date'] ?? null,
                'soutenance_published_at' => null,
            ]);
        });

        $row->refresh()->load($this->internshipApiRelations());

        return response()->json($this->resource($row));
    }

    private function assertSoutenanceReadyToPublish(InternshipRequest $row): void
    {
        abort_unless($this->internshipIsSoutenanceEligible($row), 422, 'Internship is not ready.');
        abort_if(! $row->soutenance_date, 422, 'Set a soutenance date first.');
        $needed = $this->requiredJurySlots((string) $row->internship_type);
        abort_if($row->soutenanceJuryMembers()->count() !== $needed, 422, 'Jury is incomplete.');
    }

    public function directeurSoutenancePublish(Request $request, int $id)
    {
        $this->currentDirecteurStageOrFail($request);
        $row = InternshipRequest::with('soutenanceJuryMembers')->findOrFail($id);
        abort_if($row->soutenance_published_at, 422, 'Already published.');
        $this->assertSoutenanceReadyToPublish($row);
        $row->update(['soutenance_published_at' => now()]);
        $row->refresh()->load($this->internshipApiRelations());

        return response()->json($this->resource($row));
    }

    public function directeurSoutenanceUnpublish(Request $request, int $id)
    {
        $this->currentDirecteurStageOrFail($request);
        $row = InternshipRequest::findOrFail($id);
        $row->update(['soutenance_published_at' => null]);
        $row->refresh()->load($this->internshipApiRelations());

        return response()->json($this->resource($row));
    }

    public function directeurSoutenanceClassPdf(Request $request, int $classId)
    {
        $this->currentDirecteurStageOrFail($request);
        $classe = Classe::findOrFail($classId);

        $rows = InternshipRequest::query()
            ->with(['student.user', 'soutenanceJuryMembers.professeur.user'])
            ->where('class_id', $classId)
            ->whereIn('status', $this->internshipPostDirectorApprovalStatuses())
            ->where('rapport_status', 'accepted')
            ->where('attestation_status', 'accepted')
            ->orderBy('student_id')
            ->get();

        $tableRows = $rows->map(function (InternshipRequest $r) {
            $juryNames = $r->soutenanceJuryMembers->sortBy('position')->map(fn ($m) => $m->professeur?->user?->name)->filter()->implode(', ');

            return [
                'student_name' => $r->student?->user?->name ?? '—',
                'internship_type' => $r->internship_type,
                'company_name' => $r->company_name,
                'soutenance_date' => optional($r->soutenance_date)->toDateString() ?? '—',
                'jury' => $juryNames !== '' ? $juryNames : '—',
                'published_label' => $r->soutenance_published_at ? 'Oui' : 'Non',
            ];
        });

        $pdf = Pdf::loadView('pdf.internship_class_soutenance', [
            'classe' => ['name' => $classe->name, 'annee_scolaire' => $classe->annee_scolaire],
            'rows' => $tableRows,
            'today' => now()->toDateString(),
        ])->setPaper('a4', 'landscape');

        return $pdf->download("soutenance_classe_{$classId}.pdf");
    }

    public function professeurSoutenancePending(Request $request)
    {
        $prof = Professeur::where('user_id', $request->user()->id)->firstOrFail();

        $rows = InternshipRequest::query()
            ->with($this->internshipApiRelations())
            ->whereIn('status', $this->internshipPostDirectorApprovalStatuses())
            ->where('rapport_status', 'accepted')
            ->where('attestation_status', 'accepted')
            ->whereNotNull('soutenance_date')
            ->whereNull('soutenance_published_at')
            ->whereHas('soutenanceJuryMembers', fn ($q) => $q->where('professeur_id', $prof->id))
            ->orderByDesc('id')
            ->get()
            ->filter(function (InternshipRequest $r) {
                return $r->soutenanceJuryMembers->count() === $this->requiredJurySlots((string) $r->internship_type);
            })
            ->values()
            ->map(fn (InternshipRequest $r) => $this->resource($r));

        return response()->json($rows);
    }

    public function professeurSoutenancePublish(Request $request, int $id)
    {
        $prof = Professeur::where('user_id', $request->user()->id)->firstOrFail();
        $row = InternshipRequest::with('soutenanceJuryMembers')->findOrFail($id);

        $onJury = $row->soutenanceJuryMembers->contains(fn ($m) => (int) $m->professeur_id === (int) $prof->id);
        abort_if(! $onJury, 403, 'You are not on this jury.');

        abort_if($row->soutenance_published_at, 422, 'Already published.');
        $this->assertSoutenanceReadyToPublish($row);

        $row->update(['soutenance_published_at' => now()]);
        $row->refresh()->load($this->internshipApiRelations());

        return response()->json($this->resource($row));
    }

    public function directeurEncadrementBoard(Request $request)
    {
        $this->currentDirecteurStageOrFail($request);
        $classId = $request->query('class_id');

        $q = InternshipRequest::query()
            ->with($this->internshipApiRelations())
            ->whereIn('status', $this->internshipPostDirectorApprovalStatuses())
            ->where('internship_type', 'pfe')
            ->where('rapport_status', 'accepted');

        if ($classId !== null && $classId !== '') {
            $q->where('class_id', (int) $classId);
        }

        $rows = $q->orderByDesc('id')->get()->map(fn (InternshipRequest $r) => $this->resource($r));

        return response()->json($rows);
    }

    public function directeurEncadrementUpdate(Request $request, int $id)
    {
        $this->currentDirecteurStageOrFail($request);
        $data = $request->validate([
            'encadrant_professeur_id' => 'required|integer|exists:professeurs,id',
            'encadrement_start_date' => 'required|date',
            'encadrement_end_date' => 'required|date|after_or_equal:encadrement_start_date',
        ]);

        $row = InternshipRequest::findOrFail($id);
        abort_unless($this->internshipIsEncadrementEligible($row), 422, 'Only approved PFE internships with accepted report can be assigned an encadrant.');

        $row->update([
            'encadrant_professeur_id' => $data['encadrant_professeur_id'],
            'encadrement_start_date' => $data['encadrement_start_date'],
            'encadrement_end_date' => $data['encadrement_end_date'],
        ]);

        $row->refresh()->load($this->internshipApiRelations());

        return response()->json($this->resource($row));
    }

    public function directeurEncadrementClassPdf(Request $request, int $classId)
    {
        $this->currentDirecteurStageOrFail($request);
        $classe = Classe::findOrFail($classId);

        $rows = InternshipRequest::query()
            ->with(['student.user', 'encadrantProfesseur.user'])
            ->where('class_id', $classId)
            ->whereIn('status', $this->internshipPostDirectorApprovalStatuses())
            ->where('internship_type', 'pfe')
            ->where('rapport_status', 'accepted')
            ->orderBy('student_id')
            ->get();

        $tableRows = $rows->map(function (InternshipRequest $r) {
            return [
                'student_name' => $r->student?->user?->name ?? '—',
                'project_name' => $r->project_name ?: '—',
                'company_name' => $r->company_name ?? '—',
                'encadrant_name' => $r->encadrantProfesseur?->user?->name ?? '—',
                'encadrement_start' => optional($r->encadrement_start_date)->toDateString() ?? '—',
                'encadrement_end' => optional($r->encadrement_end_date)->toDateString() ?? '—',
            ];
        });

        $pdf = Pdf::loadView('pdf.internship_class_encadrement', [
            'classe' => ['name' => $classe->name, 'annee_scolaire' => $classe->annee_scolaire],
            'rows' => $tableRows,
            'today' => now()->toDateString(),
        ])->setPaper('a4', 'landscape');

        return $pdf->download("encadrement_pfe_classe_{$classId}.pdf");
    }

    public function professeurEncadrementIndex(Request $request)
    {
        $prof = Professeur::where('user_id', $request->user()->id)->firstOrFail();

        $rows = InternshipRequest::query()
            ->with($this->internshipApiRelations())
            ->where('encadrant_professeur_id', $prof->id)
            ->where('internship_type', 'pfe')
            ->whereIn('status', $this->internshipPostDirectorApprovalStatuses())
            ->where('rapport_status', 'accepted')
            ->orderByDesc('id')
            ->get()
            ->map(fn (InternshipRequest $r) => $this->resource($r));

        return response()->json($rows);
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
