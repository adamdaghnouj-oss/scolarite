<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Classe;
use App\Models\ClasseModuleProfAssignment;
use App\Models\ClassePlanAffectation;
use App\Models\Evaluation;
use App\Models\Module;
use App\Models\Panier;
use App\Models\PlanEtude;
use App\Models\Semestre;
use App\Models\Specialite;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PlanEtudeController extends Controller
{
    // --------- Reference data ---------
    public function listSpecialites(Request $request)
    {
        $q = Specialite::query();
        if ($request->filled('departement')) $q->where('departement', $request->string('departement'));
        return response()->json($q->orderBy('departement')->orderBy('name')->get());
    }

    public function createSpecialite(Request $request)
    {
        $data = $request->validate([
            'departement' => 'required|string|max:100',
            'code' => 'nullable|string|max:50',
            'name' => 'required|string|max:150',
        ]);

        $s = Specialite::create($data);
        return response()->json($s, 201);
    }

    public function listSemestres()
    {
        return response()->json(Semestre::orderBy('number')->get());
    }

    public function seedDefaultSemestres()
    {
        // Safe to call multiple times
        DB::transaction(function () {
            for ($i = 1; $i <= 6; $i++) {
                Semestre::firstOrCreate(
                    ['number' => $i],
                    ['label' => 'S' . $i]
                );
            }
        });
        return response()->json(['message' => 'Semestres seeded.']);
    }

    // --------- Plans ---------
    public function listPlans(Request $request)
    {
        $q = PlanEtude::with(['specialite', 'semestre'])
            ->orderBy('specialite_id')
            ->orderBy('semestre_id')
            ->orderByDesc('version');

        if ($request->filled('specialite_id')) $q->where('specialite_id', $request->integer('specialite_id'));
        if ($request->filled('semestre_id')) $q->where('semestre_id', $request->integer('semestre_id'));
        if ($request->filled('active')) $q->where('is_active', filter_var($request->active, FILTER_VALIDATE_BOOLEAN));

        return response()->json($q->get());
    }

    public function createPlan(Request $request)
    {
        $data = $request->validate([
            'specialite_id' => 'required|exists:specialites,id',
            'semestre_id' => 'required|exists:semestres,id',
            'title' => 'nullable|string|max:200',
            'version' => 'nullable|integer|min:1',
            'is_active' => 'nullable|boolean',
        ]);

        $data['version'] = $data['version'] ?? 1;
        $data['is_active'] = $data['is_active'] ?? true;

        $plan = PlanEtude::create($data);
        return response()->json($plan->load(['specialite', 'semestre']), 201);
    }

    public function showPlanTree(int $id)
    {
        $plan = PlanEtude::with([
            'specialite',
            'semestre',
            'paniers' => function ($q) {
                $q->orderBy('ordre')->orderBy('id');
            },
            'paniers.modules' => function ($q) {
                $q->orderBy('ordre')->orderBy('id');
            },
            'paniers.evaluations' => function ($q) {
                $q->orderBy('ordre')->orderBy('id');
            },
        ])->findOrFail($id);

        return response()->json($plan);
    }

    public function updatePlan(Request $request, int $id)
    {
        $plan = PlanEtude::findOrFail($id);
        $data = $request->validate([
            'title' => 'nullable|string|max:200',
            'version' => 'nullable|integer|min:1',
            'is_active' => 'nullable|boolean',
        ]);
        $plan->update($data);
        return response()->json($plan->load(['specialite', 'semestre']));
    }

    // --------- Paniers / Modules / Evaluations ---------
    public function addPanier(Request $request, int $planId)
    {
        $plan = PlanEtude::findOrFail($planId);
        $data = $request->validate([
            'name' => 'required|string|max:150',
            'ordre' => 'nullable|integer|min:0|max:65535',
        ]);
        $data['plan_etude_id'] = $plan->id;
        $data['ordre'] = $data['ordre'] ?? 0;
        $panier = Panier::create($data);
        return response()->json($panier, 201);
    }

    public function updatePanier(Request $request, int $panierId)
    {
        $panier = Panier::findOrFail($panierId);
        $data = $request->validate([
            'name' => 'sometimes|string|max:150',
            'ordre' => 'sometimes|integer|min:0|max:65535',
        ]);
        $panier->update($data);
        return response()->json($panier);
    }

    public function deletePanier(int $panierId)
    {
        $panier = Panier::findOrFail($panierId);
        $panier->delete();
        return response()->json(['message' => 'Panier deleted.']);
    }

    public function addModule(Request $request, int $panierId)
    {
        $panier = Panier::findOrFail($panierId);
        $data = $request->validate([
            'code' => 'nullable|string|max:50',
            'name' => 'required|string|max:200',
            'coefficient' => 'required|numeric|min:0',
            'ordre' => 'nullable|integer|min:0|max:65535',
        ]);
        $data['panier_id'] = $panier->id;
        $data['ordre'] = $data['ordre'] ?? 0;
        $m = Module::create($data);
        return response()->json($m, 201);
    }

    public function updateModule(Request $request, int $moduleId)
    {
        $m = Module::findOrFail($moduleId);
        $data = $request->validate([
            'code' => 'sometimes|nullable|string|max:50',
            'name' => 'sometimes|string|max:200',
            'coefficient' => 'sometimes|numeric|min:0',
            'ordre' => 'sometimes|integer|min:0|max:65535',
        ]);
        $m->update($data);
        return response()->json($m);
    }

    public function deleteModule(int $moduleId)
    {
        $m = Module::findOrFail($moduleId);
        $m->delete();
        return response()->json(['message' => 'Module deleted.']);
    }

    public function addEvaluationToPanier(Request $request, int $panierId)
    {
        $panier = Panier::findOrFail($panierId);
        $data = $request->validate([
            'type' => 'required|string|max:30',
            'weight' => 'nullable|numeric|min:0',
            'ordre' => 'nullable|integer|min:0|max:65535',
        ]);

        $typeKey = strtolower(trim($data['type']));
        $dup = Evaluation::query()
            ->where('panier_id', $panier->id)
            ->whereRaw('LOWER(TRIM(type)) = ?', [$typeKey])
            ->exists();

        if ($dup) {
            return response()->json([
                'message' => 'An evaluation of this type already exists for this subject (panier).',
            ], 422);
        }

        $e = Evaluation::create([
            'panier_id' => $panier->id,
            'module_id' => null,
            'type' => $data['type'],
            'weight' => $data['weight'] ?? null,
            'ordre' => $data['ordre'] ?? 0,
        ]);

        return response()->json($e, 201);
    }

    public function updateEvaluation(Request $request, int $evaluationId)
    {
        $e = Evaluation::findOrFail($evaluationId);
        $data = $request->validate([
            'type' => 'sometimes|string|max:30',
            'weight' => 'sometimes|nullable|numeric|min:0',
            'ordre' => 'sometimes|integer|min:0|max:65535',
        ]);
        $e->update($data);
        return response()->json($e);
    }

    public function deleteEvaluation(int $evaluationId)
    {
        $e = Evaluation::findOrFail($evaluationId);
        $e->delete();
        return response()->json(['message' => 'Evaluation deleted.']);
    }

    // --------- Affectations (plan -> class per year) ---------
    public function listAffectations(Request $request)
    {
        $data = $request->validate([
            'class_id' => 'nullable|integer|exists:classes,id',
            'annee_scolaire' => 'nullable|string|max:20',
        ]);

        $q = ClassePlanAffectation::with(['classe', 'planEtude.specialite', 'planEtude.semestre'])
            ->orderByDesc('id');

        if (!empty($data['class_id'])) $q->where('class_id', $data['class_id']);
        if (!empty($data['annee_scolaire'])) $q->where('annee_scolaire', $data['annee_scolaire']);

        return response()->json($q->get());
    }

    public function createAffectation(Request $request)
    {
        $data = $request->validate([
            'class_id' => 'required|exists:classes,id',
            'plan_etude_id' => 'required|exists:plans_etude,id',
            'annee_scolaire' => 'required|string|max:20',
        ]);

        $data['created_by'] = $request->user()?->id;

        $aff = ClassePlanAffectation::create($data);
        return response()->json($aff->load(['classe', 'planEtude.specialite', 'planEtude.semestre']), 201);
    }

    public function deleteAffectation(int $id)
    {
        $aff = ClassePlanAffectation::findOrFail($id);
        $aff->delete();
        return response()->json(['message' => 'Affectation deleted.']);
    }

    // Utility for UI
    public function listClasses()
    {
        return response()->json(
            Classe::orderBy('annee_scolaire')->orderBy('departement')->orderBy('name')->get()
        );
    }

    /**
     * Admin: class + linked plan (paniers / modules from Director) + saved prof assignments (cours / TP).
     */
    public function classModuleAssignmentsContext(Request $request)
    {
        $data = $request->validate([
            'class_id' => 'required|integer|exists:classes,id',
            'annee_scolaire' => 'required|string|max:20',
        ]);

        $classe = Classe::findOrFail($data['class_id']);

        $affectation = ClassePlanAffectation::with(['planEtude.specialite', 'planEtude.semestre', 'classe'])
            ->where('class_id', $data['class_id'])
            ->where('annee_scolaire', $data['annee_scolaire'])
            ->first();

        if (! $affectation) {
            return response()->json([
                'message' => 'No study plan is linked to this class for this school year. The Director of Studies must create a plan affectation first.',
                'classe' => $classe,
                'affectation' => null,
                'plan' => null,
                'assignments' => [],
            ], 422);
        }

        $plan = PlanEtude::with([
            'specialite',
            'semestre',
            'paniers' => function ($q) {
                $q->orderBy('ordre')->orderBy('id');
            },
            'paniers.modules' => function ($q) {
                $q->orderBy('ordre')->orderBy('id');
            },
            'paniers.evaluations' => function ($q) {
                $q->orderBy('ordre')->orderBy('id');
            },
        ])->findOrFail($affectation->plan_etude_id);

        $rows = ClasseModuleProfAssignment::where('class_id', $data['class_id'])
            ->where('annee_scolaire', $data['annee_scolaire'])
            ->get();

        return response()->json([
            'classe' => $classe,
            'affectation' => $affectation,
            'plan' => $plan,
            'assignments' => $rows->map(fn ($r) => [
                'module_id' => $r->module_id,
                'professeur_cours_id' => $r->professeur_cours_id,
                'professeur_tp_id' => $r->professeur_tp_id,
            ]),
        ]);
    }

    /**
     * Admin: upsert professor assignments per module (cours vs TP).
     */
    public function saveClassModuleAssignments(Request $request)
    {
        $data = $request->validate([
            'class_id' => 'required|integer|exists:classes,id',
            'annee_scolaire' => 'required|string|max:20',
            'assignments' => 'required|array',
            'assignments.*.module_id' => 'required|integer|exists:modules,id',
            'assignments.*.professeur_cours_id' => 'nullable|integer|exists:professeurs,id',
            'assignments.*.professeur_tp_id' => 'nullable|integer|exists:professeurs,id',
        ]);

        $affectation = ClassePlanAffectation::where('class_id', $data['class_id'])
            ->where('annee_scolaire', $data['annee_scolaire'])
            ->first();

        if (! $affectation) {
            return response()->json([
                'message' => 'No study plan is linked to this class for this school year.',
            ], 422);
        }

        $planId = $affectation->plan_etude_id;
        $validModuleIds = Module::query()
            ->whereHas('panier', fn ($q) => $q->where('plan_etude_id', $planId))
            ->pluck('id')
            ->all();

        $validSet = array_flip($validModuleIds);

        foreach ($data['assignments'] as $row) {
            if (! isset($validSet[$row['module_id']])) {
                return response()->json([
                    'message' => 'One or more modules are not part of the study plan linked to this class.',
                ], 422);
            }
        }

        DB::transaction(function () use ($data) {
            foreach ($data['assignments'] as $row) {
                ClasseModuleProfAssignment::updateOrCreate(
                    [
                        'class_id' => $data['class_id'],
                        'module_id' => $row['module_id'],
                        'annee_scolaire' => $data['annee_scolaire'],
                    ],
                    [
                        'professeur_cours_id' => $row['professeur_cours_id'] ?? null,
                        'professeur_tp_id' => $row['professeur_tp_id'] ?? null,
                    ]
                );
            }
        });

        return response()->json(['message' => 'Assignments saved.']);
    }
}

