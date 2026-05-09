<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Classe;
use App\Models\Student;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class ClasseController extends Controller
{
    private function isPlaceholderClass(Request $request): bool
    {
        $name = (string) $request->input('name', '');
        return in_array($name, ['YearPlaceholder', 'DeptPlaceholder'], true);
    }

    // List all classes (with student count)
    public function index()
    {
        $classes = Classe::withCount('students')->get();
        return response()->json($classes);
    }

    /** Public list of department names (from classes) for registration / forms. */
    public function departements()
    {
        return response()->json(Classe::distinctDepartementNames());
    }

    // Create a class
    public function store(Request $request)
    {
        $requiresNiveau = !$this->isPlaceholderClass($request);
        $request->validate([
            'name' => 'required|string|max:100',
            'departement' => 'nullable|string|max:100',
            'annee_scolaire' => 'nullable|string|max:20',
            'niveau' => [
                Rule::requiredIf($requiresNiveau),
                'nullable',
                'string',
                Rule::in(['first', 'second', 'third_pfe']),
            ],
        ]);

        $classe = Classe::create([
            'name' => $request->name,
            'departement' => $request->departement,
            'annee_scolaire' => $request->annee_scolaire,
            'niveau' => $request->niveau,
        ]);

        return response()->json($classe, 201);
    }

    // Update a class
    public function update(Request $request, $id)
    {
        $classe = Classe::findOrFail($id);
        $requiresNiveau = !$this->isPlaceholderClass($request);
        $request->validate([
            'name' => 'required|string|max:100',
            'departement' => 'nullable|string|max:100',
            'annee_scolaire' => 'nullable|string|max:20',
            'niveau' => [
                Rule::requiredIf($requiresNiveau),
                'nullable',
                'string',
                Rule::in(['first', 'second', 'third_pfe']),
            ],
        ]);
        $classe->update([
            'name' => $request->name,
            'departement' => $request->departement,
            'annee_scolaire' => $request->annee_scolaire,
            'niveau' => $request->niveau,
        ]);
        return response()->json($classe);
    }

    // Delete a class
    public function destroy($id)
    {
        $classe = Classe::findOrFail($id);
        $classe->delete();
        return response()->json(['message' => 'Class deleted.']);
    }

    // List students in a class
    public function students($id)
    {
        $classe = Classe::findOrFail($id);
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

    /**
     * Students that can be assigned to this class (not already in this class).
     * Optional query: q — search name, email, or matricule.
     */
    public function attachCandidates(Request $request, $id)
    {
        $classe = Classe::findOrFail($id);
        $q = trim((string) $request->query('q', ''));
        $query = Student::with(['user', 'classeObj'])
            ->whereHas('user', fn ($uq) => $uq->where('role', 'student'))
            ->where(function ($w) use ($classe) {
                $w->whereNull('class_id')
                    ->orWhere('class_id', '!=', $classe->id);
            });

        if ($q !== '') {
            $escaped = str_replace(['%', '_'], ['\\%', '\\_'], $q);
            $like = '%' . $escaped . '%';
            $query->where(function ($w) use ($like) {
                $w->where('matricule', 'like', $like)
                    ->orWhereHas('user', function ($uq) use ($like) {
                        $uq->where('name', 'like', $like)
                            ->orWhere('email', 'like', $like);
                    });
            });
        }

        $students = $query->orderBy('matricule')->limit(200)->get()->map(function ($s) {
            return [
                'id' => $s->id,
                'user_id' => $s->user_id,
                'name' => $s->user->name ?? '',
                'email' => $s->user->email ?? '',
                'matricule' => $s->matricule,
                'current_class_id' => $s->class_id,
                'current_class_name' => $s->classeObj?->name ?? ($s->classe ?: null),
            ];
        });

        return response()->json($students);
    }

    /** Assign an existing student record to this class (moves from another class if needed). */
    public function attachStudent(Request $request, $id)
    {
        $classe = Classe::findOrFail($id);
        $request->validate([
            'student_id' => 'required|integer|exists:students,id',
        ]);

        $student = Student::with('user')->findOrFail($request->student_id);

        if (!$student->user || $student->user->role !== 'student') {
            return response()->json(['message' => 'Invalid student account.'], 422);
        }

        if ((int) $student->class_id === (int) $classe->id) {
            return response()->json(['message' => 'This student is already in this class.'], 422);
        }

        $student->update([
            'class_id' => $classe->id,
            'classe' => $classe->name,
        ]);
        $student->refresh();
        $student->load('user');

        return response()->json([
            'id' => $student->id,
            'user_id' => $student->user_id,
            'name' => $student->user->name ?? '',
            'email' => $student->user->email ?? '',
            'matricule' => $student->matricule,
            'classe' => $student->classe,
            'class_id' => $student->class_id,
            'created_at' => $student->created_at,
        ], 201);
    }

    // Add a new student to a class
    public function addStudent(Request $request, $id)
    {
        $classe = Classe::findOrFail($id);
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'matricule' => 'required|string|max:50|unique:students,matricule',
        ]);

        DB::beginTransaction();
        try {
            $user = User::create([
                'name' => $request->name,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'role' => 'student',
            ]);
            $student = Student::create([
                'user_id' => $user->id,
                'matricule' => $request->matricule,
                'classe' => $classe->name,
                'class_id' => $classe->id,
            ]);
            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }

        return response()->json([
            'id' => $student->id,
            'user_id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'matricule' => $student->matricule,
            'classe' => $student->classe,
            'class_id' => $student->class_id,
            'created_at' => $student->created_at,
        ], 201);
    }

    // Update a student in a class
    public function updateStudent(Request $request, $classId, $studentId)
    {
        $student = Student::where('class_id', $classId)->findOrFail($studentId);
        $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|unique:users,email,' . $student->user_id,
            'matricule' => 'sometimes|string|max:50|unique:students,matricule,' . $student->id,
        ]);

        if ($request->has('name') || $request->has('email')) {
            $student->user->update(array_filter([
                'name' => $request->name,
                'email' => $request->email,
            ]));
        }
        if ($request->has('matricule')) {
            $student->update(['matricule' => $request->matricule]);
        }

        $student->refresh();
        return response()->json([
            'id' => $student->id,
            'user_id' => $student->user_id,
            'name' => $student->user->name,
            'email' => $student->user->email,
            'matricule' => $student->matricule,
            'classe' => $student->classe,
            'class_id' => $student->class_id,
            'created_at' => $student->created_at,
        ]);
    }

    // Remove a student from a class (detach only)
    public function removeStudent($classId, $studentId)
    {
        $student = Student::where('class_id', $classId)->findOrFail($studentId);
        $student->update(['class_id' => null]);
        return response()->json(['message' => 'Student removed from class.']);
    }

    // Delete a student entirely
    public function deleteStudent($classId, $studentId)
    {
        $student = Student::where('class_id', $classId)->findOrFail($studentId);
        $user = $student->user;
        $student->delete();
        if ($user) $user->delete();
        return response()->json(['message' => 'Student deleted.']);
    }
}
