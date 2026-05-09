<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Classe;
use App\Models\ClasseModuleProfAssignment;
use App\Models\Module;
use App\Models\Panier;
use App\Models\PanierStudentEvaluationGrade;
use App\Models\ModuleCourseSession;
use App\Models\ModuleSessionAttendance;
use App\Models\ModuleStudentNote;
use App\Models\Student;
use App\Models\StudentModuleEliminationState;
use App\Models\StudentPanierEliminationState;
use App\Services\ModuleAbsenceService;
use App\Services\PanierGradesService;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProfesseurAcademicController extends Controller
{
    private function profOrAbort(Request $request)
    {
        $prof = $request->user()->professeur;
        if (! $prof) {
            throw new HttpResponseException(response()->json(['message' => 'No professor profile for this account.'], 403));
        }

        return $prof;
    }

    private function assertTeachesModule(Request $request, int $moduleId, int $classId, string $anneeScolaire): void
    {
        $prof = $this->profOrAbort($request);
        $ok = ClasseModuleProfAssignment::where('class_id', $classId)
            ->where('module_id', $moduleId)
            ->where('annee_scolaire', $anneeScolaire)
            ->where(function ($q) use ($prof) {
                $q->where('professeur_cours_id', $prof->id)
                    ->orWhere('professeur_tp_id', $prof->id);
            })
            ->exists();

        if (! $ok) {
            throw new HttpResponseException(response()->json(['message' => 'You are not assigned to this module for this class and year.'], 403));
        }
    }

    public function listNotes(Request $request, int $moduleId)
    {
        $data = $request->validate([
            'class_id' => 'required|integer|exists:classes,id',
            'annee_scolaire' => 'required|string|max:20',
        ]);

        $this->assertTeachesModule($request, $moduleId, (int) $data['class_id'], $data['annee_scolaire']);

        $notes = ModuleStudentNote::query()
            ->where('module_id', $moduleId)
            ->where('class_id', $data['class_id'])
            ->where('annee_scolaire', $data['annee_scolaire'])
            ->with('student.user')
            ->get()
            ->map(function (ModuleStudentNote $n) {
                return [
                    'student_id' => $n->student_id,
                    'name' => $n->student?->user?->name ?? '',
                    'note' => $n->note !== null ? (float) $n->note : null,
                    'updated_at' => $n->updated_at,
                ];
            });

        return response()->json(['notes' => $notes]);
    }

    public function upsertNotes(Request $request, int $moduleId)
    {
        $data = $request->validate([
            'class_id' => 'required|integer|exists:classes,id',
            'annee_scolaire' => 'required|string|max:20',
            'grades' => 'required|array|min:1',
            'grades.*.student_id' => 'required|integer|exists:students,id',
            'grades.*.note' => 'nullable|numeric|min:0|max:20',
        ]);

        $this->assertTeachesModule($request, $moduleId, (int) $data['class_id'], $data['annee_scolaire']);
        $prof = $this->profOrAbort($request);

        $classId = (int) $data['class_id'];
        $year = $data['annee_scolaire'];

        $class = Classe::findOrFail($classId);
        $allowedStudentIds = $class->students()->pluck('id')->all();

        DB::transaction(function () use ($data, $moduleId, $classId, $year, $prof, $allowedStudentIds) {
            foreach ($data['grades'] as $row) {
                $sid = (int) $row['student_id'];
                if (! in_array($sid, $allowedStudentIds, true)) {
                    throw new HttpResponseException(response()->json(['message' => 'Student is not in this class.'], 422));
                }

                if ($row['note'] === null || $row['note'] === '') {
                    ModuleStudentNote::query()
                        ->where('module_id', $moduleId)
                        ->where('class_id', $classId)
                        ->where('annee_scolaire', $year)
                        ->where('student_id', $sid)
                        ->delete();
                } else {
                    ModuleStudentNote::query()->updateOrCreate(
                        [
                            'module_id' => $moduleId,
                            'class_id' => $classId,
                            'annee_scolaire' => $year,
                            'student_id' => $sid,
                        ],
                        [
                            'professeur_id' => $prof->id,
                            'note' => $row['note'],
                        ]
                    );
                }
            }
        });

        return response()->json(['message' => 'Notes saved.']);
    }

    public function deleteStudentNote(Request $request, int $moduleId, int $studentId)
    {
        $data = $request->validate([
            'class_id' => 'required|integer|exists:classes,id',
            'annee_scolaire' => 'required|string|max:20',
        ]);

        $this->assertTeachesModule($request, $moduleId, (int) $data['class_id'], $data['annee_scolaire']);

        ModuleStudentNote::query()
            ->where('module_id', $moduleId)
            ->where('class_id', $data['class_id'])
            ->where('annee_scolaire', $data['annee_scolaire'])
            ->where('student_id', $studentId)
            ->delete();

        return response()->json(['message' => 'Note removed.']);
    }

    public function absenceOverview(Request $request, int $moduleId)
    {
        $data = $request->validate([
            'class_id' => 'required|integer|exists:classes,id',
            'annee_scolaire' => 'required|string|max:20',
            'name' => 'nullable|string|max:120',
            'min_absences' => 'nullable|integer|min:0|max:999',
        ]);

        $this->assertTeachesModule($request, $moduleId, (int) $data['class_id'], $data['annee_scolaire']);

        $classId = (int) $data['class_id'];
        $year = $data['annee_scolaire'];

        $module = Module::findOrFail($moduleId);

        $students = Student::query()
            ->where('students.class_id', $classId)
            ->join('users', 'users.id', '=', 'students.user_id')
            ->select('students.*')
            ->with('user')
            ->when($data['name'] ?? null, function ($q, $name) {
                $q->where('users.name', 'like', '%'.$name.'%');
            })
            ->orderBy('users.name')
            ->get();

        $rows = $students->map(function (Student $s) use ($moduleId, $classId, $year) {
            $count = ModuleAbsenceService::absenceCount($s->id, $moduleId, $classId, $year);
            $eliminated = ModuleAbsenceService::isEliminated($s->id, $moduleId, $classId, $year);

            return [
                'student_id' => $s->id,
                'name' => $s->user->name ?? '',
                'matricule' => $s->matricule,
                'absence_count' => $count,
                'eliminated' => $eliminated,
            ];
        });

        if (isset($data['min_absences'])) {
            $rows = $rows->filter(fn ($r) => $r['absence_count'] >= (int) $data['min_absences'])->values();
        }

        $sessions = ModuleCourseSession::query()
            ->where('module_id', $moduleId)
            ->where('class_id', $classId)
            ->where('annee_scolaire', $year)
            ->with(['attendance'])
            ->orderByDesc('session_date')
            ->orderByDesc('time_start')
            ->get()
            ->map(function (ModuleCourseSession $sess) {
                return [
                    'id' => $sess->id,
                    'session_date' => $sess->session_date?->format('Y-m-d'),
                    'time_start' => substr((string) $sess->time_start, 0, 5),
                    'time_end' => substr((string) $sess->time_end, 0, 5),
                    'attendance' => $sess->attendance->map(fn ($a) => [
                        'student_id' => $a->student_id,
                        'status' => $a->status,
                    ])->values(),
                ];
            });

        return response()->json([
            'module' => [
                'id' => $module->id,
                'code' => $module->code,
                'name' => $module->name,
            ],
            'students' => $rows,
            'sessions' => $sessions,
        ]);
    }

    public function storeSession(Request $request, int $moduleId)
    {
        $data = $request->validate([
            'class_id' => 'required|integer|exists:classes,id',
            'annee_scolaire' => 'required|string|max:20',
            'session_date' => 'required|date',
            'time_start' => 'required|date_format:H:i',
            'time_end' => 'required|date_format:H:i|after:time_start',
            'attendance' => 'required|array|min:1',
            'attendance.*.student_id' => 'required|integer|exists:students,id',
            'attendance.*.status' => 'required|string|in:present,absent',
        ]);

        $classId = (int) $data['class_id'];
        $year = $data['annee_scolaire'];
        $this->assertTeachesModule($request, $moduleId, $classId, $year);
        $prof = $this->profOrAbort($request);

        $class = Classe::findOrFail($classId);
        $allowed = $class->students()->pluck('id')->all();

        foreach ($data['attendance'] as $row) {
            if (! in_array((int) $row['student_id'], $allowed, true)) {
                throw new HttpResponseException(response()->json(['message' => 'Student is not in this class.'], 422));
            }
        }

        DB::transaction(function () use ($data, $moduleId, $classId, $year, $prof, $allowed) {
            $sess = ModuleCourseSession::create([
                'module_id' => $moduleId,
                'class_id' => $classId,
                'annee_scolaire' => $year,
                'professeur_id' => $prof->id,
                'session_date' => $data['session_date'],
                'time_start' => $data['time_start'],
                'time_end' => $data['time_end'],
            ]);

            foreach ($data['attendance'] as $row) {
                ModuleSessionAttendance::create([
                    'module_course_session_id' => $sess->id,
                    'student_id' => (int) $row['student_id'],
                    'status' => $row['status'],
                ]);
            }

            foreach ($allowed as $sid) {
                ModuleAbsenceService::syncEliminationStateAfterCountChange((int) $sid, $moduleId, $classId, $year);
            }
        });

        return response()->json(['message' => 'Session saved.']);
    }

    public function updateSession(Request $request, int $moduleId, int $sessionId)
    {
        $data = $request->validate([
            'class_id' => 'required|integer|exists:classes,id',
            'annee_scolaire' => 'required|string|max:20',
            'session_date' => 'sometimes|date',
            'time_start' => 'sometimes|date_format:H:i',
            'time_end' => 'sometimes|date_format:H:i',
            'attendance' => 'sometimes|array|min:1',
            'attendance.*.student_id' => 'required|integer|exists:students,id',
            'attendance.*.status' => 'required|string|in:present,absent',
        ]);

        $classId = (int) $data['class_id'];
        $year = $data['annee_scolaire'];
        $this->assertTeachesModule($request, $moduleId, $classId, $year);

        $sess = ModuleCourseSession::where('id', $sessionId)
            ->where('module_id', $moduleId)
            ->where('class_id', $classId)
            ->where('annee_scolaire', $year)
            ->firstOrFail();

        $start = (string) ($data['time_start'] ?? $sess->time_start);
        $end = (string) ($data['time_end'] ?? $sess->time_end);
        if (strlen($start) >= 5 && strlen($end) >= 5 && strcmp(substr($end, 0, 5), substr($start, 0, 5)) <= 0) {
            throw new HttpResponseException(response()->json(['message' => 'End time must be after start time.'], 422));
        }

        $class = Classe::findOrFail($classId);
        $allowed = $class->students()->pluck('id')->all();

        if (isset($data['attendance'])) {
            foreach ($data['attendance'] as $row) {
                if (! in_array((int) $row['student_id'], $allowed, true)) {
                    throw new HttpResponseException(response()->json(['message' => 'Student is not in this class.'], 422));
                }
            }
        }

        DB::transaction(function () use ($data, $sess, $allowed, $moduleId, $classId, $year) {
            if (isset($data['session_date'])) {
                $sess->session_date = $data['session_date'];
            }
            if (isset($data['time_start'])) {
                $sess->time_start = $data['time_start'];
            }
            if (isset($data['time_end'])) {
                $sess->time_end = $data['time_end'];
            }
            $sess->save();

            if (isset($data['attendance'])) {
                ModuleSessionAttendance::where('module_course_session_id', $sess->id)->delete();
                foreach ($data['attendance'] as $row) {
                    ModuleSessionAttendance::create([
                        'module_course_session_id' => $sess->id,
                        'student_id' => (int) $row['student_id'],
                        'status' => $row['status'],
                    ]);
                }
            }

            foreach ($allowed as $sid) {
                ModuleAbsenceService::syncEliminationStateAfterCountChange((int) $sid, $moduleId, $classId, $year);
            }
        });

        return response()->json(['message' => 'Session updated.']);
    }

    public function destroySession(Request $request, int $moduleId, int $sessionId)
    {
        $data = $request->validate([
            'class_id' => 'required|integer|exists:classes,id',
            'annee_scolaire' => 'required|string|max:20',
        ]);

        $classId = (int) $data['class_id'];
        $year = $data['annee_scolaire'];
        $this->assertTeachesModule($request, $moduleId, $classId, $year);

        $sess = ModuleCourseSession::where('id', $sessionId)
            ->where('module_id', $moduleId)
            ->where('class_id', $classId)
            ->where('annee_scolaire', $year)
            ->firstOrFail();

        $class = Classe::findOrFail($classId);
        $allowed = $class->students()->pluck('id')->all();

        DB::transaction(function () use ($sess, $allowed, $moduleId, $classId, $year) {
            $sess->delete();
            foreach ($allowed as $sid) {
                ModuleAbsenceService::syncEliminationStateAfterCountChange((int) $sid, $moduleId, $classId, $year);
            }
        });

        return response()->json(['message' => 'Session deleted.']);
    }

    public function dismissElimination(Request $request, int $moduleId, int $studentId)
    {
        $data = $request->validate([
            'class_id' => 'required|integer|exists:classes,id',
            'annee_scolaire' => 'required|string|max:20',
        ]);

        $classId = (int) $data['class_id'];
        $year = $data['annee_scolaire'];
        $this->assertTeachesModule($request, $moduleId, $classId, $year);

        $class = Classe::findOrFail($classId);
        if (! $class->students()->where('students.id', $studentId)->exists()) {
            return response()->json(['message' => 'Student is not in this class.'], 422);
        }

        StudentModuleEliminationState::query()->updateOrCreate(
            [
                'student_id' => $studentId,
                'module_id' => $moduleId,
                'class_id' => $classId,
                'annee_scolaire' => $year,
            ],
            ['dismissed_by_prof' => true]
        );

        return response()->json(['message' => 'Elimination dismissed for this student.']);
    }

    public function absenceOverviewPanier(Request $request, int $panierId)
    {
        $data = $request->validate([
            'class_id' => 'required|integer|exists:classes,id',
            'annee_scolaire' => 'required|string|max:20',
            'name' => 'nullable|string|max:120',
            'min_absences' => 'nullable|integer|min:0|max:999',
        ]);

        $this->assertTeachesPanier($request, $panierId, (int) $data['class_id'], $data['annee_scolaire']);

        $classId = (int) $data['class_id'];
        $year = $data['annee_scolaire'];

        $panier = Panier::findOrFail($panierId);

        $students = Student::query()
            ->where('students.class_id', $classId)
            ->join('users', 'users.id', '=', 'students.user_id')
            ->select('students.*')
            ->with('user')
            ->when($data['name'] ?? null, function ($q, $name) {
                $q->where('users.name', 'like', '%'.$name.'%');
            })
            ->orderBy('users.name')
            ->get();

        $rows = $students->map(function (Student $s) use ($panierId, $classId, $year) {
            $count = ModuleAbsenceService::absenceCountForPanier($s->id, $panierId, $classId, $year);
            $eliminated = ModuleAbsenceService::isEliminatedForPanier($s->id, $panierId, $classId, $year);

            return [
                'student_id' => $s->id,
                'name' => $s->user->name ?? '',
                'matricule' => $s->matricule,
                'absence_count' => $count,
                'eliminated' => $eliminated,
            ];
        });

        if (isset($data['min_absences'])) {
            $rows = $rows->filter(fn ($r) => $r['absence_count'] >= (int) $data['min_absences'])->values();
        }

        $sessions = ModuleAbsenceService::sessionQueryForPanier($panierId, $classId, $year)
            ->with(['attendance'])
            ->orderByDesc('session_date')
            ->orderByDesc('time_start')
            ->get()
            ->map(function (ModuleCourseSession $sess) {
                return [
                    'id' => $sess->id,
                    'session_date' => $sess->session_date?->format('Y-m-d'),
                    'time_start' => substr((string) $sess->time_start, 0, 5),
                    'time_end' => substr((string) $sess->time_end, 0, 5),
                    'attendance' => $sess->attendance->map(fn ($a) => [
                        'student_id' => $a->student_id,
                        'status' => $a->status,
                    ])->values(),
                ];
            });

        return response()->json([
            'panier' => [
                'id' => $panier->id,
                'name' => $panier->name,
            ],
            'students' => $rows,
            'sessions' => $sessions,
        ]);
    }

    public function storeSessionPanier(Request $request, int $panierId)
    {
        $data = $request->validate([
            'class_id' => 'required|integer|exists:classes,id',
            'annee_scolaire' => 'required|string|max:20',
            'session_date' => 'required|date',
            'time_start' => 'required|date_format:H:i',
            'time_end' => 'required|date_format:H:i|after:time_start',
            'attendance' => 'required|array|min:1',
            'attendance.*.student_id' => 'required|integer|exists:students,id',
            'attendance.*.status' => 'required|string|in:present,absent',
        ]);

        $classId = (int) $data['class_id'];
        $year = $data['annee_scolaire'];
        $this->assertTeachesPanier($request, $panierId, $classId, $year);
        $prof = $this->profOrAbort($request);

        $class = Classe::findOrFail($classId);
        $allowed = $class->students()->pluck('id')->all();

        foreach ($data['attendance'] as $row) {
            if (! in_array((int) $row['student_id'], $allowed, true)) {
                throw new HttpResponseException(response()->json(['message' => 'Student is not in this class.'], 422));
            }
        }

        DB::transaction(function () use ($data, $panierId, $classId, $year, $prof, $allowed) {
            $sess = ModuleCourseSession::create([
                'panier_id' => $panierId,
                'module_id' => null,
                'class_id' => $classId,
                'annee_scolaire' => $year,
                'professeur_id' => $prof->id,
                'session_date' => $data['session_date'],
                'time_start' => $data['time_start'],
                'time_end' => $data['time_end'],
            ]);

            foreach ($data['attendance'] as $row) {
                ModuleSessionAttendance::create([
                    'module_course_session_id' => $sess->id,
                    'student_id' => (int) $row['student_id'],
                    'status' => $row['status'],
                ]);
            }

            foreach ($allowed as $sid) {
                ModuleAbsenceService::syncEliminationStateAfterPanierCountChange((int) $sid, $panierId, $classId, $year);
            }
        });

        return response()->json(['message' => 'Session saved.']);
    }

    public function updateSessionPanier(Request $request, int $panierId, int $sessionId)
    {
        $data = $request->validate([
            'class_id' => 'required|integer|exists:classes,id',
            'annee_scolaire' => 'required|string|max:20',
            'session_date' => 'sometimes|date',
            'time_start' => 'sometimes|date_format:H:i',
            'time_end' => 'sometimes|date_format:H:i',
            'attendance' => 'sometimes|array|min:1',
            'attendance.*.student_id' => 'required|integer|exists:students,id',
            'attendance.*.status' => 'required|string|in:present,absent',
        ]);

        $classId = (int) $data['class_id'];
        $year = $data['annee_scolaire'];
        $this->assertTeachesPanier($request, $panierId, $classId, $year);

        $sess = $this->panierSessionOrFail($panierId, $sessionId, $classId, $year);

        $start = (string) ($data['time_start'] ?? $sess->time_start);
        $end = (string) ($data['time_end'] ?? $sess->time_end);
        if (strlen($start) >= 5 && strlen($end) >= 5 && strcmp(substr($end, 0, 5), substr($start, 0, 5)) <= 0) {
            throw new HttpResponseException(response()->json(['message' => 'End time must be after start time.'], 422));
        }

        $class = Classe::findOrFail($classId);
        $allowed = $class->students()->pluck('id')->all();

        if (isset($data['attendance'])) {
            foreach ($data['attendance'] as $row) {
                if (! in_array((int) $row['student_id'], $allowed, true)) {
                    throw new HttpResponseException(response()->json(['message' => 'Student is not in this class.'], 422));
                }
            }
        }

        DB::transaction(function () use ($data, $sess, $allowed, $panierId, $classId, $year) {
            if (isset($data['session_date'])) {
                $sess->session_date = $data['session_date'];
            }
            if (isset($data['time_start'])) {
                $sess->time_start = $data['time_start'];
            }
            if (isset($data['time_end'])) {
                $sess->time_end = $data['time_end'];
            }
            $sess->save();

            if (isset($data['attendance'])) {
                ModuleSessionAttendance::where('module_course_session_id', $sess->id)->delete();
                foreach ($data['attendance'] as $row) {
                    ModuleSessionAttendance::create([
                        'module_course_session_id' => $sess->id,
                        'student_id' => (int) $row['student_id'],
                        'status' => $row['status'],
                    ]);
                }
            }

            foreach ($allowed as $sid) {
                ModuleAbsenceService::syncEliminationStateAfterPanierCountChange((int) $sid, $panierId, $classId, $year);
            }
        });

        return response()->json(['message' => 'Session updated.']);
    }

    public function destroySessionPanier(Request $request, int $panierId, int $sessionId)
    {
        $data = $request->validate([
            'class_id' => 'required|integer|exists:classes,id',
            'annee_scolaire' => 'required|string|max:20',
        ]);

        $classId = (int) $data['class_id'];
        $year = $data['annee_scolaire'];
        $this->assertTeachesPanier($request, $panierId, $classId, $year);

        $sess = $this->panierSessionOrFail($panierId, $sessionId, $classId, $year);

        $class = Classe::findOrFail($classId);
        $allowed = $class->students()->pluck('id')->all();

        DB::transaction(function () use ($sess, $allowed, $panierId, $classId, $year) {
            $sess->delete();
            foreach ($allowed as $sid) {
                ModuleAbsenceService::syncEliminationStateAfterPanierCountChange((int) $sid, $panierId, $classId, $year);
            }
        });

        return response()->json(['message' => 'Session deleted.']);
    }

    public function dismissEliminationPanier(Request $request, int $panierId, int $studentId)
    {
        $data = $request->validate([
            'class_id' => 'required|integer|exists:classes,id',
            'annee_scolaire' => 'required|string|max:20',
        ]);

        $classId = (int) $data['class_id'];
        $year = $data['annee_scolaire'];
        $this->assertTeachesPanier($request, $panierId, $classId, $year);

        $class = Classe::findOrFail($classId);
        if (! $class->students()->where('students.id', $studentId)->exists()) {
            return response()->json(['message' => 'Student is not in this class.'], 422);
        }

        StudentPanierEliminationState::query()->updateOrCreate(
            [
                'student_id' => $studentId,
                'panier_id' => $panierId,
                'class_id' => $classId,
                'annee_scolaire' => $year,
            ],
            ['dismissed_by_prof' => true]
        );

        return response()->json(['message' => 'Elimination dismissed for this student.']);
    }

    private function panierSessionOrFail(int $panierId, int $sessionId, int $classId, string $year): ModuleCourseSession
    {
        $moduleIds = $this->moduleIdsInPanier($panierId);

        return ModuleCourseSession::query()
            ->where('id', $sessionId)
            ->where('class_id', $classId)
            ->where('annee_scolaire', $year)
            ->where(function ($q) use ($panierId, $moduleIds) {
                $q->where('panier_id', $panierId);
                if (count($moduleIds) > 0) {
                    $q->orWhere(function ($q2) use ($moduleIds) {
                        $q2->whereNull('panier_id')->whereIn('module_id', $moduleIds);
                    });
                }
            })
            ->firstOrFail();
    }

    /** @return array<int, int> */
    private function moduleIdsInPanier(int $panierId): array
    {
        return PanierGradesService::moduleIdsInPanier($panierId);
    }

    private function assertTeachesPanier(Request $request, int $panierId, int $classId, string $anneeScolaire): void
    {
        $moduleIds = $this->moduleIdsInPanier($panierId);
        if (count($moduleIds) === 0) {
            throw new HttpResponseException(response()->json(['message' => 'This subject has no modules.'], 404));
        }

        $prof = $this->profOrAbort($request);
        $ok = ClasseModuleProfAssignment::query()
            ->where('class_id', $classId)
            ->where('annee_scolaire', $anneeScolaire)
            ->whereIn('module_id', $moduleIds)
            ->where(function ($q) use ($prof) {
                $q->where('professeur_cours_id', $prof->id)
                    ->orWhere('professeur_tp_id', $prof->id);
            })
            ->exists();

        if (! $ok) {
            throw new HttpResponseException(response()->json(['message' => 'You are not assigned to teach this subject for this class and year.'], 403));
        }
    }

    /**
     * @return array{cours: bool, tp: bool}
     */
    private function profRolesInPanier($prof, int $panierId, int $classId, string $anneeScolaire): array
    {
        $moduleIds = $this->moduleIdsInPanier($panierId);
        $assigns = ClasseModuleProfAssignment::query()
            ->where('class_id', $classId)
            ->where('annee_scolaire', $anneeScolaire)
            ->whereIn('module_id', $moduleIds)
            ->get(['professeur_cours_id', 'professeur_tp_id']);

        $cours = false;
        $tp = false;
        foreach ($assigns as $a) {
            if ((int) $a->professeur_cours_id === (int) $prof->id) {
                $cours = true;
            }
            if ((int) $a->professeur_tp_id === (int) $prof->id) {
                $tp = true;
            }
        }

        return ['cours' => $cours, 'tp' => $tp];
    }

    /**
     * @return list<array{key: string, label: string, weight: ?float, scope: string}>
     */
    private function evaluationSlotsForPanier(int $panierId): array
    {
        return PanierGradesService::evaluationSlotsForPanier($panierId);
    }

    public function panierGradesContext(Request $request, int $panierId)
    {
        $data = $request->validate([
            'class_id' => 'required|integer|exists:classes,id',
            'annee_scolaire' => 'required|string|max:20',
        ]);

        $classId = (int) $data['class_id'];
        $year = $data['annee_scolaire'];
        $this->assertTeachesPanier($request, $panierId, $classId, $year);
        $prof = $this->profOrAbort($request);
        $roles = $this->profRolesInPanier($prof, $panierId, $classId, $year);

        $slots = $this->evaluationSlotsForPanier($panierId);
        foreach ($slots as &$slot) {
            $slot['editable'] = ($slot['scope'] === 'tp' && $roles['tp']) || ($slot['scope'] === 'cours' && $roles['cours']);
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

        $panier = Panier::findOrFail($panierId);

        return response()->json([
            'panier' => ['id' => $panier->id, 'name' => $panier->name],
            'slots' => $slots,
            'roles' => $roles,
            'grades' => $grades,
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
        $this->assertTeachesPanier($request, $panierId, $classId, $year);
        $prof = $this->profOrAbort($request);
        $roles = $this->profRolesInPanier($prof, $panierId, $classId, $year);

        $slots = $this->evaluationSlotsForPanier($panierId);
        $slotByKey = [];
        foreach ($slots as $s) {
            $slotByKey[$s['key']] = $s;
        }

        $class = Classe::findOrFail($classId);
        $allowedStudentIds = $class->students()->pluck('id')->all();

        DB::transaction(function () use ($data, $panierId, $classId, $year, $prof, $allowedStudentIds, $roles, $slotByKey) {
            foreach ($data['cells'] as $row) {
                $sid = (int) $row['student_id'];
                if (! in_array($sid, $allowedStudentIds, true)) {
                    throw new HttpResponseException(response()->json(['message' => 'Student is not in this class.'], 422));
                }

                $typeKey = strtolower(trim((string) $row['evaluation_type']));
                if (! isset($slotByKey[$typeKey])) {
                    throw new HttpResponseException(response()->json(['message' => 'Unknown evaluation type: '.$typeKey], 422));
                }

                $scope = $slotByKey[$typeKey]['scope'];
                if ($scope === 'tp' && ! $roles['tp']) {
                    throw new HttpResponseException(response()->json(['message' => 'You cannot edit TP grades for this subject.'], 403));
                }
                if ($scope === 'cours' && ! $roles['cours']) {
                    throw new HttpResponseException(response()->json(['message' => 'You cannot edit course grades (DS/Exam) for this subject.'], 403));
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
                            'professeur_id' => $prof->id,
                            'note' => $note,
                        ]
                    );
                }
            }
        });

        return response()->json(['message' => 'Grades saved.']);
    }
}
