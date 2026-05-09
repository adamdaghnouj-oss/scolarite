<?php

namespace App\Services;

use App\Models\Module;
use App\Models\ModuleCourseSession;
use App\Models\ModuleSessionAttendance;
use App\Models\StudentModuleEliminationState;
use App\Models\StudentPanierEliminationState;

class ModuleAbsenceService
{
    /** Sessions counted for a panier (whole subject): panier_id match or legacy rows tied to modules in that panier. */
    public static function sessionQueryForPanier(int $panierId, int $classId, string $anneeScolaire)
    {
        $moduleIds = Module::query()->where('panier_id', $panierId)->pluck('id')->all();

        return ModuleCourseSession::query()
            ->where('class_id', $classId)
            ->where('annee_scolaire', $anneeScolaire)
            ->where(function ($q) use ($panierId, $moduleIds) {
                $q->where('panier_id', $panierId);
                if (count($moduleIds) > 0) {
                    $q->orWhere(function ($q2) use ($moduleIds) {
                        $q2->whereNull('panier_id')->whereIn('module_id', $moduleIds);
                    });
                }
            });
    }

    public static function absenceCountForPanier(int $studentId, int $panierId, int $classId, string $anneeScolaire): int
    {
        return ModuleSessionAttendance::query()
            ->where('student_id', $studentId)
            ->where('status', 'absent')
            ->whereHas('session', function ($q) use ($panierId, $classId, $anneeScolaire) {
                $q->where('class_id', $classId)
                    ->where('annee_scolaire', $anneeScolaire)
                    ->where(function ($q2) use ($panierId) {
                        $moduleIds = Module::query()->where('panier_id', $panierId)->pluck('id')->all();
                        $q2->where('panier_id', $panierId);
                        if (count($moduleIds) > 0) {
                            $q2->orWhere(function ($q3) use ($moduleIds) {
                                $q3->whereNull('panier_id')->whereIn('module_id', $moduleIds);
                            });
                        }
                    });
            })
            ->count();
    }

    public static function syncEliminationStateAfterPanierCountChange(
        int $studentId,
        int $panierId,
        int $classId,
        string $anneeScolaire,
        int $threshold = 3,
    ): void {
        $count = self::absenceCountForPanier($studentId, $panierId, $classId, $anneeScolaire);

        $state = StudentPanierEliminationState::query()->firstOrNew([
            'student_id' => $studentId,
            'panier_id' => $panierId,
            'class_id' => $classId,
            'annee_scolaire' => $anneeScolaire,
        ]);

        if ($count < $threshold) {
            $state->dismissed_by_prof = false;
            if ($state->exists) {
                $state->save();
            }

            return;
        }

        if (! $state->exists) {
            $state->dismissed_by_prof = false;
            $state->save();
        }
    }

    public static function isEliminatedForPanier(int $studentId, int $panierId, int $classId, string $anneeScolaire, int $threshold = 3): bool
    {
        $count = self::absenceCountForPanier($studentId, $panierId, $classId, $anneeScolaire);
        if ($count < $threshold) {
            return false;
        }

        $dismissed = (bool) StudentPanierEliminationState::query()
            ->where('student_id', $studentId)
            ->where('panier_id', $panierId)
            ->where('class_id', $classId)
            ->where('annee_scolaire', $anneeScolaire)
            ->value('dismissed_by_prof');

        return ! $dismissed;
    }

    public static function absenceCount(int $studentId, int $moduleId, int $classId, string $anneeScolaire): int
    {
        return ModuleSessionAttendance::query()
            ->where('student_id', $studentId)
            ->where('status', 'absent')
            ->whereHas('session', function ($q) use ($moduleId, $classId, $anneeScolaire) {
                $q->where('module_id', $moduleId)
                    ->where('class_id', $classId)
                    ->where('annee_scolaire', $anneeScolaire);
            })
            ->count();
    }

    /**
     * When count drops below threshold, clear professor dismissal flag.
     */
    public static function syncEliminationStateAfterCountChange(
        int $studentId,
        int $moduleId,
        int $classId,
        string $anneeScolaire,
        int $threshold = 3,
    ): void {
        $count = self::absenceCount($studentId, $moduleId, $classId, $anneeScolaire);

        $state = StudentModuleEliminationState::query()->firstOrNew([
            'student_id' => $studentId,
            'module_id' => $moduleId,
            'class_id' => $classId,
            'annee_scolaire' => $anneeScolaire,
        ]);

        if ($count < $threshold) {
            $state->dismissed_by_prof = false;
            if ($state->exists) {
                $state->save();
            }

            return;
        }

        if (! $state->exists) {
            $state->dismissed_by_prof = false;
            $state->save();
        }
    }

    public static function isEliminated(int $studentId, int $moduleId, int $classId, string $anneeScolaire, int $threshold = 3): bool
    {
        $count = self::absenceCount($studentId, $moduleId, $classId, $anneeScolaire);
        if ($count < $threshold) {
            return false;
        }

        $dismissed = (bool) StudentModuleEliminationState::query()
            ->where('student_id', $studentId)
            ->where('module_id', $moduleId)
            ->where('class_id', $classId)
            ->where('annee_scolaire', $anneeScolaire)
            ->value('dismissed_by_prof');

        return ! $dismissed;
    }
}
