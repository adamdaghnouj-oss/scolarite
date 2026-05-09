<?php

namespace App\Services;

use App\Models\Evaluation;
use App\Models\Module;

class PanierGradesService
{
    /** @return array<int, int> */
    public static function moduleIdsInPanier(int $panierId): array
    {
        return Module::query()->where('panier_id', $panierId)->pluck('id')->all();
    }

    /**
     * Evaluation types for the panier (director defines them on the panier; legacy rows on modules are merged).
     *
     * @return list<array{key: string, label: string, weight: ?float, scope: string}>
     */
    public static function evaluationSlotsForPanier(int $panierId): array
    {
        $moduleIds = self::moduleIdsInPanier($panierId);
        $evals = Evaluation::query()
            ->where(function ($q) use ($panierId, $moduleIds) {
                $q->where('panier_id', $panierId);
                if (count($moduleIds) > 0) {
                    $q->orWhereIn('module_id', $moduleIds);
                }
            })
            ->orderBy('ordre')
            ->orderBy('id')
            ->get(['type', 'weight']);

        $byKey = [];
        foreach ($evals as $e) {
            $key = strtolower(trim((string) $e->type));
            if ($key === '') {
                continue;
            }
            $scope = $key === 'tp' ? 'tp' : 'cours';
            $w = $e->weight !== null ? (float) $e->weight : null;
            if (! isset($byKey[$key])) {
                $byKey[$key] = [
                    'key' => $key,
                    'label' => (string) $e->type,
                    'weight' => $w,
                    'scope' => $scope,
                ];
            } else {
                if ($byKey[$key]['weight'] !== null && $w !== null) {
                    $byKey[$key]['weight'] = max($byKey[$key]['weight'], $w);
                } elseif ($w !== null) {
                    $byKey[$key]['weight'] = $w;
                }
            }
        }

        return array_values($byKey);
    }

    /**
     * @param  list<array{key: string, label: string, weight: ?float, scope: string}>  $slots
     * @param  array<string, float|null>  $gradesByType  evaluation_type => note /20
     * @return array{value: ?float, method: string, detail: string}
     */
    public static function subjectAverage(array $slots, array $gradesByType): array
    {
        if (count($slots) === 0) {
            return ['value' => null, 'method' => 'none', 'detail' => ''];
        }

        $weightedNum = 0.0;
        $weightedDen = 0.0;
        $simpleSum = 0.0;
        $simpleCount = 0;

        foreach ($slots as $slot) {
            $k = $slot['key'];
            if (! array_key_exists($k, $gradesByType)) {
                continue;
            }
            $n = $gradesByType[$k];
            if ($n === null) {
                continue;
            }
            $note = (float) $n;
            $simpleSum += $note;
            $simpleCount++;
            $w = $slot['weight'] ?? null;
            if ($w !== null && $w > 0) {
                $weightedNum += $note * $w;
                $weightedDen += $w;
            }
        }

        if ($simpleCount === 0) {
            return ['value' => null, 'method' => 'none', 'detail' => ''];
        }

        if ($weightedDen > 0) {
            $m = $weightedNum / $weightedDen;

            return [
                'value' => round($m, 2),
                'method' => 'weighted',
                'detail' => 'Weighted average Σ(grade × weight) / Σ(weights) over entered components (/20, LMD-style).',
            ];
        }

        $m = $simpleSum / $simpleCount;

        return [
            'value' => round($m, 2),
            'method' => 'mean',
            'detail' => 'Arithmetic mean of entered grades (no weights configured on the study plan for these evaluations).',
        ];
    }

    public static function panierUeCoefficient(int $panierId): float
    {
        return (float) Module::query()->where('panier_id', $panierId)->sum('coefficient');
    }
}
