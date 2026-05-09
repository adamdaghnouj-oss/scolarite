<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Classe;
use App\Models\ClasseModuleProfAssignment;
use App\Models\DoubleCorrectionRequest;
use App\Models\Panier;
use App\Services\PanierGradesService;
use Illuminate\Http\Request;

class DoubleCorrectionRequestController extends Controller
{
    private function resolveProfesseurIdForPanier(int $classId, string $anneeScolaire, int $panierId): ?int
    {
        $moduleIds = PanierGradesService::moduleIdsInPanier($panierId);
        if (count($moduleIds) === 0) return null;

        $rows = ClasseModuleProfAssignment::query()
            ->where('class_id', $classId)
            ->where('annee_scolaire', $anneeScolaire)
            ->whereIn('module_id', $moduleIds)
            ->get(['professeur_cours_id', 'professeur_tp_id']);

        foreach ($rows as $r) {
            if ($r->professeur_cours_id) return (int) $r->professeur_cours_id;
        }
        foreach ($rows as $r) {
            if ($r->professeur_tp_id) return (int) $r->professeur_tp_id;
        }
        return null;
    }

    // --------------------
    // Student
    // --------------------
    public function studentIndex(Request $request)
    {
        $student = $request->user()->student;
        if (! $student || ! $student->class_id) {
            return response()->json([]);
        }

        $classe = Classe::find($student->class_id);
        if (! $classe) {
            return response()->json([]);
        }

        $year = (string) $classe->annee_scolaire;

        $rows = DoubleCorrectionRequest::query()
            ->where('student_id', $student->id)
            ->where('class_id', $classe->id)
            ->where('annee_scolaire', $year)
            ->with(['panier:id,name'])
            ->orderByDesc('id')
            ->get()
            ->map(function (DoubleCorrectionRequest $r) {
                return [
                    'id' => $r->id,
                    'panier_id' => $r->panier_id,
                    'panier_name' => $r->panier?->name,
                    'status' => $r->status,
                    'reason' => $r->reason,
                    'decision_note' => $r->decision_note,
                    'decided_at' => optional($r->decided_at)->toIso8601String(),
                    'created_at' => optional($r->created_at)->toIso8601String(),
                ];
            })
            ->values();

        return response()->json($rows);
    }

    public function studentStore(Request $request)
    {
        $student = $request->user()->student;
        if (! $student || ! $student->class_id) {
            return response()->json(['message' => 'No class assigned to this student account.'], 422);
        }

        $classe = Classe::find($student->class_id);
        if (! $classe) {
            return response()->json(['message' => 'Class not found.'], 422);
        }

        $data = $request->validate([
            'panier_id' => 'required|integer|exists:paniers,id',
            'reason' => 'nullable|string|max:2000',
        ]);

        $year = (string) $classe->annee_scolaire;
        $panierId = (int) $data['panier_id'];
        $panier = Panier::findOrFail($panierId);

        $profId = $this->resolveProfesseurIdForPanier((int) $classe->id, $year, $panierId);
        if (! $profId) {
            return response()->json(['message' => 'No professor is assigned to this subject for your class.'], 422);
        }

        $row = DoubleCorrectionRequest::query()->updateOrCreate(
            [
                'student_id' => $student->id,
                'class_id' => (int) $classe->id,
                'annee_scolaire' => $year,
                'panier_id' => $panierId,
            ],
            [
                'professeur_id' => $profId,
                'status' => 'pending',
                'reason' => isset($data['reason']) ? trim((string) $data['reason']) : null,
                'decision_note' => null,
                'decided_at' => null,
            ]
        );

        return response()->json([
            'id' => $row->id,
            'panier_id' => $row->panier_id,
            'panier_name' => $panier->name,
            'status' => $row->status,
            'reason' => $row->reason,
            'created_at' => optional($row->created_at)->toIso8601String(),
        ], 201);
    }

    // --------------------
    // Professor
    // --------------------
    public function professeurIndex(Request $request)
    {
        $prof = $request->user()->professeur;
        if (! $prof) {
            return response()->json([]);
        }

        $rows = DoubleCorrectionRequest::query()
            ->where('professeur_id', $prof->id)
            ->with(['student.user', 'panier:id,name', 'classe:id,name,annee_scolaire'])
            ->orderByDesc('id')
            ->limit(300)
            ->get()
            ->map(function (DoubleCorrectionRequest $r) {
                return [
                    'id' => $r->id,
                    'status' => $r->status,
                    'reason' => $r->reason,
                    'decision_note' => $r->decision_note,
                    'decided_at' => optional($r->decided_at)->toIso8601String(),
                    'created_at' => optional($r->created_at)->toIso8601String(),
                    'panier' => $r->panier ? ['id' => $r->panier->id, 'name' => $r->panier->name] : null,
                    'classe' => $r->classe ? ['id' => $r->classe->id, 'name' => $r->classe->name, 'annee_scolaire' => $r->classe->annee_scolaire] : null,
                    'student' => $r->student ? [
                        'id' => $r->student->id,
                        'name' => $r->student->user?->name,
                        'matricule' => $r->student->matricule,
                    ] : null,
                ];
            })
            ->values();

        return response()->json($rows);
    }

    public function professeurDecide(Request $request, int $id)
    {
        $prof = $request->user()->professeur;
        if (! $prof) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'decision' => 'required|string|in:accepted,rejected',
            'decision_note' => 'nullable|string|max:2000',
        ]);

        $row = DoubleCorrectionRequest::findOrFail($id);
        if ((int) $row->professeur_id !== (int) $prof->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $row->status = $data['decision'];
        $row->decision_note = isset($data['decision_note']) ? trim((string) $data['decision_note']) : null;
        $row->decided_at = now();
        $row->save();

        return response()->json(['message' => 'Saved.', 'status' => $row->status]);
    }
}

