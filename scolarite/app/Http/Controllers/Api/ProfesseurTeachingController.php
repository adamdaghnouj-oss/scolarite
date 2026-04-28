<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Classe;
use App\Models\ClasseModuleProfAssignment;
use App\Models\ClassePlanAffectation;
use Illuminate\Http\Request;

class ProfesseurTeachingController extends Controller
{
    /**
     * Classes and plan paniers/modules the logged-in professor is assigned to (read-only overview).
     */
    public function teachingOverview(Request $request)
    {
        $prof = $request->user()->professeur;
        if (! $prof) {
            return response()->json(['message' => 'No professor profile for this account.'], 403);
        }

        $assignments = ClasseModuleProfAssignment::query()
            ->where(function ($q) use ($prof) {
                $q->where('professeur_cours_id', $prof->id)
                    ->orWhere('professeur_tp_id', $prof->id);
            })
            ->with(['classe', 'module.panier'])
            ->orderBy('class_id')
            ->orderBy('annee_scolaire')
            ->get();

        $groupMap = [];

        foreach ($assignments as $a) {
            if (! $a->module?->panier || ! $a->classe) {
                continue;
            }

            $gKey = $a->class_id.'|'.$a->annee_scolaire;

            if (! isset($groupMap[$gKey])) {
                $aff = ClassePlanAffectation::where('class_id', $a->class_id)
                    ->where('annee_scolaire', $a->annee_scolaire)
                    ->with(['planEtude.specialite', 'planEtude.semestre'])
                    ->first();

                $planPayload = null;
                if ($aff && $aff->planEtude) {
                    $pe = $aff->planEtude;
                    $planPayload = [
                        'id' => $pe->id,
                        'title' => $pe->title,
                        'specialite' => $pe->specialite,
                        'semestre' => $pe->semestre,
                    ];
                }

                $groupMap[$gKey] = [
                    'class_id' => $a->class_id,
                    'annee_scolaire' => $a->annee_scolaire,
                    'classe' => [
                        'id' => $a->classe->id,
                        'name' => $a->classe->name,
                        'departement' => $a->classe->departement,
                        'annee_scolaire' => $a->classe->annee_scolaire,
                    ],
                    'plan' => $planPayload,
                    'paniers' => [],
                ];
            }

            $panier = $a->module->panier;
            $pid = $panier->id;

            if (! isset($groupMap[$gKey]['paniers'][$pid])) {
                $groupMap[$gKey]['paniers'][$pid] = [
                    'id' => $panier->id,
                    'name' => $panier->name,
                    'ordre' => $panier->ordre,
                    '_modules' => [],
                ];
            }

            $mid = $a->module_id;

            if (! isset($groupMap[$gKey]['paniers'][$pid]['_modules'][$mid])) {
                $groupMap[$gKey]['paniers'][$pid]['_modules'][$mid] = [
                    'id' => $a->module->id,
                    'code' => $a->module->code,
                    'name' => $a->module->name,
                    'ordre' => $a->module->ordre,
                    'role_cours' => false,
                    'role_tp' => false,
                ];
            }

            if ((int) $a->professeur_cours_id === (int) $prof->id) {
                $groupMap[$gKey]['paniers'][$pid]['_modules'][$mid]['role_cours'] = true;
            }
            if ((int) $a->professeur_tp_id === (int) $prof->id) {
                $groupMap[$gKey]['paniers'][$pid]['_modules'][$mid]['role_tp'] = true;
            }
        }

        $classes = [];
        foreach ($groupMap as $g) {
            $paniers = [];
            foreach ($g['paniers'] as $p) {
                $mods = array_values($p['_modules']);
                usort($mods, function ($x, $y) {
                    $c = ($x['ordre'] ?? 0) <=> ($y['ordre'] ?? 0);

                    return $c !== 0 ? $c : ($x['id'] ?? 0) <=> ($y['id'] ?? 0);
                });
                unset($p['_modules']);
                $p['modules'] = $mods;
                $paniers[] = $p;
            }
            usort($paniers, function ($x, $y) {
                $c = ($x['ordre'] ?? 0) <=> ($y['ordre'] ?? 0);

                return $c !== 0 ? $c : ($x['id'] ?? 0) <=> ($y['id'] ?? 0);
            });
            $g['paniers'] = $paniers;
            $classes[] = $g;
        }

        usort($classes, function ($a, $b) {
            $n = strcmp((string) ($a['classe']['name'] ?? ''), (string) ($b['classe']['name'] ?? ''));

            return $n !== 0 ? $n : strcmp((string) $a['annee_scolaire'], (string) $b['annee_scolaire']);
        });

        return response()->json([
            'professeur_id' => $prof->id,
            'classes' => $classes,
        ]);
    }

    /**
     * Students enrolled in a class (read-only), only if the professor teaches that class for the given year.
     */
    public function classStudents(Request $request, int $classId)
    {
        $data = $request->validate([
            'annee_scolaire' => 'required|string|max:20',
        ]);

        $prof = $request->user()->professeur;
        if (! $prof) {
            return response()->json(['message' => 'No professor profile for this account.'], 403);
        }

        $allowed = ClasseModuleProfAssignment::where('class_id', $classId)
            ->where('annee_scolaire', $data['annee_scolaire'])
            ->where(function ($q) use ($prof) {
                $q->where('professeur_cours_id', $prof->id)
                    ->orWhere('professeur_tp_id', $prof->id);
            })
            ->exists();

        if (! $allowed) {
            return response()->json([
                'message' => 'You are not assigned to teach this class for this school year.',
            ], 403);
        }

        $classe = Classe::findOrFail($classId);
        $students = $classe->students()->with('user')->get()->map(function ($s) {
            return [
                'id' => $s->id,
                'user_id' => $s->user_id,
                'name' => $s->user->name ?? '',
                'email' => $s->user->email ?? '',
                'matricule' => $s->matricule,
                'classe' => $s->classe,
                'class_id' => $s->class_id,
                'created_at' => $s->created_at,
            ];
        });

        return response()->json($students);
    }
}
