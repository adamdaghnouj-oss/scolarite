<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Classe;
use App\Models\ClassePlanAffectation;
use App\Models\ClassGradePublication;
use App\Models\Panier;
use App\Models\PanierStudentEvaluationGrade;
use App\Models\Student;
use App\Services\PanierGradesService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminGradesController extends Controller
{
    private function buildSemesterSummaryData(int $classId, string $year): array
    {
        $classe = Classe::findOrFail($classId);

        $affect = ClassePlanAffectation::query()
            ->where('class_id', $classId)
            ->where('annee_scolaire', $year)
            ->first();

        if (! $affect) {
            return [
                'classe' => ['id' => $classe->id, 'name' => $classe->name, 'annee_scolaire' => $classe->annee_scolaire],
                'students' => [],
                'panier_meta' => [],
            ];
        }

        $paniers = Panier::query()
            ->where('plan_etude_id', $affect->plan_etude_id)
            ->orderBy('ordre')
            ->orderBy('id')
            ->get();

        $allGrades = PanierStudentEvaluationGrade::query()
            ->where('class_id', $classId)
            ->where('annee_scolaire', $year)
            ->whereIn('panier_id', $paniers->pluck('id'))
            ->get();

        $gradesByPanierStudent = [];
        foreach ($allGrades as $g) {
            $pk = (string) $g->panier_id;
            $sk = (string) $g->student_id;
            if (! isset($gradesByPanierStudent[$pk])) {
                $gradesByPanierStudent[$pk] = [];
            }
            if (! isset($gradesByPanierStudent[$pk][$sk])) {
                $gradesByPanierStudent[$pk][$sk] = [];
            }
            $gradesByPanierStudent[$pk][$sk][$g->evaluation_type] = $g->note !== null ? (float) $g->note : null;
        }

        $panierMeta = [];
        foreach ($paniers as $p) {
            if (count(PanierGradesService::moduleIdsInPanier($p->id)) === 0) {
                continue;
            }
            $panierMeta[] = [
                'id' => $p->id,
                'name' => $p->name,
                'coefficient_ue' => PanierGradesService::panierUeCoefficient($p->id),
                'slots' => PanierGradesService::evaluationSlotsForPanier($p->id),
            ];
        }

        $students = Student::query()
            ->where('students.class_id', $classId)
            ->join('users', 'users.id', '=', 'students.user_id')
            ->select('students.*')
            ->with('user')
            ->orderBy('users.name')
            ->get();

        $studentRows = $students->map(function (Student $s) use ($panierMeta, $gradesByPanierStudent) {
            $num = 0.0;
            $den = 0.0;
            $byPanier = [];

            foreach ($panierMeta as $meta) {
                $pid = (string) $meta['id'];
                $slots = $meta['slots'];
                $coef = (float) $meta['coefficient_ue'];
                $gmap = $gradesByPanierStudent[$pid][(string) $s->id] ?? [];
                $byType = [];
                foreach ($slots as $slot) {
                    $byType[$slot['key']] = $gmap[$slot['key']] ?? null;
                }
                $avg = PanierGradesService::subjectAverage($slots, $byType);
                $m = $avg['value'];
                $byPanier[] = [
                    'panier_id' => $meta['id'],
                    'moyenne_matiere' => $m,
                    'coefficient_ue' => $coef,
                ];
                if ($m !== null && $coef > 0) {
                    $num += $m * $coef;
                    $den += $coef;
                }
            }

            return [
                'student_id' => $s->id,
                'name' => $s->user->name ?? '',
                'matricule' => $s->matricule,
                'moyenne_semestrielle' => $den > 0 ? round($num / $den, 2) : null,
                'paniers' => $byPanier,
            ];
        })->values();

        return [
            'classe' => ['id' => $classe->id, 'name' => $classe->name, 'annee_scolaire' => $classe->annee_scolaire],
            'students' => $studentRows,
            'panier_meta' => $panierMeta,
        ];
    }

    private function assertPanierInClassPlan(int $classId, string $anneeScolaire, int $panierId): void
    {
        $affect = ClassePlanAffectation::query()
            ->where('class_id', $classId)
            ->where('annee_scolaire', $anneeScolaire)
            ->first();

        if (! $affect) {
            throw new HttpResponseException(response()->json(['message' => 'No study plan is linked to this class for this school year.'], 422));
        }

        $ok = Panier::query()
            ->where('id', $panierId)
            ->where('plan_etude_id', $affect->plan_etude_id)
            ->exists();

        if (! $ok) {
            throw new HttpResponseException(response()->json(['message' => 'This subject is not part of the class study plan.'], 422));
        }
    }

    public function gradesOverview(Request $request, int $classId)
    {
        $data = $request->validate([
            'annee_scolaire' => 'required|string|max:20',
        ]);

        $classe = Classe::findOrFail($classId);
        $year = $data['annee_scolaire'];

        $affect = ClassePlanAffectation::query()
            ->where('class_id', $classId)
            ->where('annee_scolaire', $year)
            ->first();

        if (! $affect) {
            return response()->json([
                'classe' => ['id' => $classe->id, 'name' => $classe->name, 'annee_scolaire' => $classe->annee_scolaire],
                'plan_etude_id' => null,
                'paniers' => [],
                'grades_published' => false,
                'published_at' => null,
            ]);
        }

        $paniers = Panier::query()
            ->where('plan_etude_id', $affect->plan_etude_id)
            ->orderBy('ordre')
            ->orderBy('id')
            ->get(['id', 'name', 'ordre']);

        $rows = $paniers->map(function (Panier $p) {
            return [
                'id' => $p->id,
                'name' => $p->name,
                'ordre' => $p->ordre,
                'coefficient_ue' => PanierGradesService::panierUeCoefficient($p->id),
            ];
        })->values();

        $pub = ClassGradePublication::query()
            ->where('class_id', $classId)
            ->where('annee_scolaire', $year)
            ->first();

        return response()->json([
            'classe' => ['id' => $classe->id, 'name' => $classe->name, 'annee_scolaire' => $classe->annee_scolaire],
            'plan_etude_id' => $affect->plan_etude_id,
            'paniers' => $rows,
            'grades_published' => $pub && $pub->published_at !== null,
            'published_at' => $pub?->published_at?->toIso8601String(),
        ]);
    }

    public function panierGradesContext(Request $request, int $panierId)
    {
        $data = $request->validate([
            'class_id' => 'required|integer|exists:classes,id',
            'annee_scolaire' => 'required|string|max:20',
        ]);

        $classId = (int) $data['class_id'];
        $year = $data['annee_scolaire'];
        $this->assertPanierInClassPlan($classId, $year, $panierId);

        if (count(PanierGradesService::moduleIdsInPanier($panierId)) === 0) {
            throw new HttpResponseException(response()->json(['message' => 'This subject has no modules.'], 404));
        }

        $slots = PanierGradesService::evaluationSlotsForPanier($panierId);
        foreach ($slots as &$slot) {
            $slot['editable'] = true;
        }
        unset($slot);

        $stored = PanierStudentEvaluationGrade::query()
            ->where('panier_id', $panierId)
            ->where('class_id', $classId)
            ->where('annee_scolaire', $year)
            ->get();

        $grades = [];
        foreach ($stored as $g) {
            $sid = (string) $g->student_id;
            if (! isset($grades[$sid])) {
                $grades[$sid] = [];
            }
            $grades[$sid][$g->evaluation_type] = $g->note !== null ? (float) $g->note : null;
        }

        $students = Student::query()
            ->where('students.class_id', $classId)
            ->join('users', 'users.id', '=', 'students.user_id')
            ->select('students.*')
            ->with('user')
            ->orderBy('users.name')
            ->get();

        $studentMoyennes = [];
        foreach ($students as $s) {
            $byType = [];
            foreach ($slots as $slot) {
                $byType[$slot['key']] = $grades[(string) $s->id][$slot['key']] ?? null;
            }
            $avg = PanierGradesService::subjectAverage($slots, $byType);
            $studentMoyennes[(string) $s->id] = [
                'moyenne_matiere' => $avg['value'],
                'moyenne_method' => $avg['method'],
                'moyenne_detail' => $avg['detail'],
            ];
        }

        $panier = Panier::findOrFail($panierId);
        $pub = ClassGradePublication::query()
            ->where('class_id', $classId)
            ->where('annee_scolaire', $year)
            ->first();

        return response()->json([
            'panier' => ['id' => $panier->id, 'name' => $panier->name],
            'coefficient_ue' => PanierGradesService::panierUeCoefficient($panierId),
            'slots' => $slots,
            'grades' => $grades,
            'student_moyennes' => $studentMoyennes,
            'grades_published' => $pub && $pub->published_at !== null,
            'published_at' => $pub?->published_at?->toIso8601String(),
            'lmd' => [
                'scale' => '/20',
                'hint' => 'Continuous assessment (DS, TP, etc.) and final exam are weighted from the study plan (e.g. CC×0.3 + EF×0.7). The subject average uses plan weights when they are set.',
            ],
        ]);
    }

    public function upsertPanierGrades(Request $request, int $panierId)
    {
        $data = $request->validate([
            'class_id' => 'required|integer|exists:classes,id',
            'annee_scolaire' => 'required|string|max:20',
            'cells' => 'required|array|min:1',
            'cells.*.student_id' => 'required|integer|exists:students,id',
            'cells.*.evaluation_type' => 'required|string|max:40',
            'cells.*.note' => 'nullable|numeric|min:0|max:20',
        ]);

        $classId = (int) $data['class_id'];
        $year = $data['annee_scolaire'];
        $this->assertPanierInClassPlan($classId, $year, $panierId);

        if (count(PanierGradesService::moduleIdsInPanier($panierId)) === 0) {
            throw new HttpResponseException(response()->json(['message' => 'This subject has no modules.'], 404));
        }

        $slots = PanierGradesService::evaluationSlotsForPanier($panierId);
        $slotByKey = [];
        foreach ($slots as $s) {
            $slotByKey[$s['key']] = $s;
        }

        $class = Classe::findOrFail($classId);
        $allowedStudentIds = $class->students()->pluck('id')->all();

        DB::transaction(function () use ($data, $panierId, $classId, $year, $allowedStudentIds, $slotByKey) {
            foreach ($data['cells'] as $row) {
                $sid = (int) $row['student_id'];
                if (! in_array($sid, $allowedStudentIds, true)) {
                    throw new HttpResponseException(response()->json(['message' => 'Student is not in this class.'], 422));
                }

                $typeKey = strtolower(trim((string) $row['evaluation_type']));
                if (! isset($slotByKey[$typeKey])) {
                    throw new HttpResponseException(response()->json(['message' => 'Unknown evaluation type: '.$typeKey], 422));
                }

                $note = $row['note'] ?? null;
                if ($note === '' || $note === null) {
                    PanierStudentEvaluationGrade::query()
                        ->where('panier_id', $panierId)
                        ->where('class_id', $classId)
                        ->where('annee_scolaire', $year)
                        ->where('student_id', $sid)
                        ->where('evaluation_type', $typeKey)
                        ->delete();
                } else {
                    PanierStudentEvaluationGrade::query()->updateOrCreate(
                        [
                            'panier_id' => $panierId,
                            'class_id' => $classId,
                            'annee_scolaire' => $year,
                            'student_id' => $sid,
                            'evaluation_type' => $typeKey,
                        ],
                        [
                            'professeur_id' => null,
                            'note' => $note,
                        ]
                    );
                }
            }
        });

        return response()->json(['message' => 'Grades saved.']);
    }

    public function publishGrades(Request $request, int $classId)
    {
        $data = $request->validate([
            'annee_scolaire' => 'required|string|max:20',
        ]);

        Classe::findOrFail($classId);
        $userId = $request->user()->id;

        ClassGradePublication::query()->updateOrCreate(
            [
                'class_id' => $classId,
                'annee_scolaire' => $data['annee_scolaire'],
            ],
            [
                'published_at' => now(),
                'published_by' => $userId,
            ]
        );

        return response()->json(['message' => 'Grades are now visible to students.', 'grades_published' => true]);
    }

    public function unpublishGrades(Request $request, int $classId)
    {
        $data = $request->validate([
            'annee_scolaire' => 'required|string|max:20',
        ]);

        ClassGradePublication::query()
            ->where('class_id', $classId)
            ->where('annee_scolaire', $data['annee_scolaire'])
            ->update(['published_at' => null, 'published_by' => null]);

        return response()->json(['message' => 'Grades are hidden from students.', 'grades_published' => false]);
    }

    public function semesterSummary(Request $request, int $classId)
    {
        $data = $request->validate([
            'annee_scolaire' => 'required|string|max:20',
        ]);

        return response()->json($this->buildSemesterSummaryData($classId, $data['annee_scolaire']));
    }

    public function exportClassGradesPdf(Request $request, int $classId)
    {
        $data = $request->validate([
            'annee_scolaire' => 'required|string|max:20',
        ]);

        $payload = $this->buildSemesterSummaryData($classId, $data['annee_scolaire']);
        $pdf = Pdf::loadView('pdf.admin_class_grades', [
            'classe' => $payload['classe'],
            'students' => $payload['students'],
            'panierMeta' => $payload['panier_meta'],
        ])->setPaper('a4', 'landscape');

        $safeClass = preg_replace('/[^A-Za-z0-9_-]+/', '_', $payload['classe']['name'] ?? 'class');
        $safeYear = preg_replace('/[^A-Za-z0-9_-]+/', '_', $data['annee_scolaire']);
        $filename = "grades_{$safeClass}_{$safeYear}.pdf";

        return $pdf->download($filename);
    }
}
