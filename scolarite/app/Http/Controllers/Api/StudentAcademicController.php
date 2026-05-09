<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Classe;
use App\Models\ClasseModuleProfAssignment;
use App\Models\ClassePlanAffectation;
use App\Models\ClassGradePublication;
use App\Models\Module;
use App\Models\Panier;
use App\Models\PanierStudentEvaluationGrade;
use App\Services\ModuleAbsenceService;
use App\Services\PanierGradesService;
use Illuminate\Http\Request;

class StudentAcademicController extends Controller
{
    public function absencesByPanier(Request $request)
    {
        $student = $request->user()->student;
        if (! $student || ! $student->class_id) {
            return response()->json(['message' => 'No class assigned to this student account.'], 422);
        }

        $classe = Classe::find($student->class_id);
        if (! $classe) {
            return response()->json(['message' => 'Class not found.'], 422);
        }

        $year = (string) $classe->annee_scolaire;
        $classId = (int) $classe->id;

        $moduleIds = ClasseModuleProfAssignment::query()
            ->where('class_id', $classId)
            ->where('annee_scolaire', $year)
            ->distinct()
            ->pluck('module_id')
            ->all();

        $panierIds = Module::query()
            ->whereIn('id', $moduleIds)
            ->distinct()
            ->orderBy('panier_id')
            ->pluck('panier_id')
            ->filter()
            ->unique()
            ->values()
            ->all();

        $paniers = Panier::query()->whereIn('id', $panierIds)->orderBy('ordre')->orderBy('id')->get();

        $rows = $paniers->map(function (Panier $p) use ($student, $classId, $year) {
            $count = ModuleAbsenceService::absenceCountForPanier($student->id, $p->id, $classId, $year);
            $eliminated = ModuleAbsenceService::isEliminatedForPanier($student->id, $p->id, $classId, $year);

            return [
                'panier_id' => $p->id,
                'name' => $p->name,
                'class_id' => $classId,
                'annee_scolaire' => $year,
                'absence_count' => $count,
                'eliminated' => $eliminated,
            ];
        })->values();

        return response()->json([
            'classe' => [
                'id' => $classe->id,
                'name' => $classe->name,
                'annee_scolaire' => $classe->annee_scolaire,
            ],
            'paniers' => $rows,
        ]);
    }

    public function myGrades(Request $request)
    {
        $student = $request->user()->student;
        if (! $student || ! $student->class_id) {
            return response()->json(['message' => 'No class assigned to this student account.'], 422);
        }

        $classe = Classe::find($student->class_id);
        if (! $classe) {
            return response()->json(['message' => 'Class not found.'], 422);
        }

        $year = (string) $classe->annee_scolaire;
        $classId = (int) $classe->id;

        $pub = ClassGradePublication::query()
            ->where('class_id', $classId)
            ->where('annee_scolaire', $year)
            ->first();

        if (! $pub || $pub->published_at === null) {
            return response()->json([
                'published' => false,
                'message' => 'Grades have not been published by the administration yet.',
            ]);
        }

        $affect = ClassePlanAffectation::query()
            ->where('class_id', $classId)
            ->where('annee_scolaire', $year)
            ->first();

        if (! $affect) {
            return response()->json([
                'published' => true,
                'published_at' => $pub->published_at?->toIso8601String(),
                'classe' => ['id' => $classe->id, 'name' => $classe->name, 'annee_scolaire' => $year],
                'moyenne_semestrielle' => null,
                'paniers' => [],
                'lmd' => [
                    'scale' => '/20',
                    'hint' => 'Semester average = Σ(subject average × UE coefficient) / Σ(coefficients) from the class study plan.',
                ],
            ]);
        }

        $paniers = Panier::query()
            ->where('plan_etude_id', $affect->plan_etude_id)
            ->orderBy('ordre')
            ->orderBy('id')
            ->get();

        $gradesRows = PanierStudentEvaluationGrade::query()
            ->where('student_id', $student->id)
            ->where('class_id', $classId)
            ->where('annee_scolaire', $year)
            ->whereIn('panier_id', $paniers->pluck('id'))
            ->get();

        $byPanier = [];
        foreach ($gradesRows as $g) {
            $pk = (string) $g->panier_id;
            if (! isset($byPanier[$pk])) {
                $byPanier[$pk] = [];
            }
            $byPanier[$pk][$g->evaluation_type] = $g->note !== null ? (float) $g->note : null;
        }

        $num = 0.0;
        $den = 0.0;
        $panierPayload = [];

        foreach ($paniers as $p) {
            if (count(PanierGradesService::moduleIdsInPanier($p->id)) === 0) {
                continue;
            }
            $slots = PanierGradesService::evaluationSlotsForPanier($p->id);
            $coef = PanierGradesService::panierUeCoefficient($p->id);
            $gmap = $byPanier[(string) $p->id] ?? [];
            $byType = [];
            foreach ($slots as $slot) {
                $byType[$slot['key']] = $gmap[$slot['key']] ?? null;
            }
            $avg = PanierGradesService::subjectAverage($slots, $byType);
            $m = $avg['value'];
            if ($m !== null && $coef > 0) {
                $num += $m * $coef;
                $den += $coef;
            }
            $panierPayload[] = [
                'panier' => ['id' => $p->id, 'name' => $p->name],
                'coefficient_ue' => $coef,
                'slots' => $slots,
                'grades' => $gmap,
                'moyenne_matiere' => $m,
                'moyenne_method' => $avg['method'],
                'moyenne_detail' => $avg['detail'],
            ];
        }

        return response()->json([
            'published' => true,
            'published_at' => $pub->published_at?->toIso8601String(),
            'classe' => ['id' => $classe->id, 'name' => $classe->name, 'annee_scolaire' => $year],
            'moyenne_semestrielle' => $den > 0 ? round($num / $den, 2) : null,
            'paniers' => $panierPayload,
            'lmd' => [
                'scale' => '/20',
                'hint' => 'Evaluations (continuous assessment, final exam, lab…) are weighted from the study plan. Common pattern: subject = CC×0.3 + EF×0.7 when those weights are set on the plan.',
            ],
        ]);
    }
}
