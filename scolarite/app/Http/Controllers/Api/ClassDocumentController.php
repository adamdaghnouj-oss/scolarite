<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Classe;
use App\Models\ClassDocument;
use App\Models\Semestre;
use App\Models\Student;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ClassDocumentController extends Controller
{
    private function publicStorageUrl(Request $request, ?string $pathOrUrl): ?string
    {
        if (! $pathOrUrl || ! is_string($pathOrUrl)) {
            return null;
        }
        $normalized = trim(str_replace('\\', '/', $pathOrUrl));
        if ($normalized === '') {
            return null;
        }
        if (preg_match('/^https?:\/\//i', $normalized)) {
            return $normalized;
        }
        if (str_starts_with($normalized, '/storage/')) {
            return $request->getSchemeAndHttpHost() . $request->getBasePath() . $normalized;
        }
        if (str_starts_with($normalized, 'storage/')) {
            return $request->getSchemeAndHttpHost() . $request->getBasePath() . '/' . $normalized;
        }
        return $request->getSchemeAndHttpHost() . $request->getBasePath() . '/storage/' . ltrim($normalized, '/');
    }

    private function normalizeType(string $type): string
    {
        $t = strtolower(trim($type));
        return $t === 'exam' ? 'exam_calendar' : $t;
    }

    private function mapDoc(ClassDocument $doc, Request $request): array
    {
        $doc->loadMissing(['classe', 'semestre']);
        return [
            'id' => $doc->id,
            'type' => $doc->type,
            'class_id' => $doc->class_id,
            'class_name' => $doc->classe?->name,
            'annee_scolaire' => $doc->annee_scolaire ?? $doc->classe?->annee_scolaire,
            'semestre_id' => $doc->semestre_id,
            'semestre_label' => $doc->semestre?->label ?? ($doc->semestre?->number ? ('S'.$doc->semestre->number) : null),
            'title' => $doc->title,
            'file_url' => $this->publicStorageUrl($request, $doc->file_path),
            'file_mime' => $doc->file_mime,
            'file_size' => $doc->file_size,
            'starts_at' => optional($doc->starts_at)->toISOString(),
            'ends_at' => optional($doc->ends_at)->toISOString(),
            'created_at' => optional($doc->created_at)->toISOString(),
        ];
    }

    // --------------------
    // Student
    // --------------------
    public function studentIndex(Request $request, string $type)
    {
        $type = $this->normalizeType($type);
        if (! in_array($type, ['timetable', 'exam_calendar'], true)) {
            return response()->json(['message' => 'Invalid type.'], 422);
        }

        /** @var User $user */
        $user = $request->user();
        $student = Student::where('user_id', $user->id)->first();
        if (! $student || ! $student->class_id) {
            return response()->json([]);
        }

        $now = now();
        $rows = ClassDocument::query()
            ->where('type', $type)
            ->where('class_id', $student->class_id)
            ->where(function ($q) use ($now) {
                $q->whereNull('starts_at')->orWhere('starts_at', '<=', $now);
            })
            ->where(function ($q) use ($now) {
                $q->whereNull('ends_at')->orWhere('ends_at', '>=', $now);
            })
            ->with(['classe', 'semestre'])
            ->orderByDesc('id')
            ->get()
            ->map(fn (ClassDocument $d) => $this->mapDoc($d, $request))
            ->values();

        return response()->json($rows);
    }

    // --------------------
    // Admin
    // --------------------
    public function adminIndex(Request $request, string $type)
    {
        $type = $this->normalizeType($type);
        if (! in_array($type, ['timetable', 'exam_calendar'], true)) {
            return response()->json(['message' => 'Invalid type.'], 422);
        }

        $rows = ClassDocument::query()
            ->where('type', $type)
            ->with(['classe', 'semestre'])
            ->orderByDesc('id')
            ->limit(800)
            ->get()
            ->map(fn (ClassDocument $d) => $this->mapDoc($d, $request))
            ->values();

        return response()->json($rows);
    }

    public function adminStore(Request $request, string $type)
    {
        $type = $this->normalizeType($type);
        if (! in_array($type, ['timetable', 'exam_calendar'], true)) {
            return response()->json(['message' => 'Invalid type.'], 422);
        }

        $data = $request->validate([
            'class_id' => 'required|integer|exists:classes,id',
            'semestre_id' => 'nullable|integer|exists:semestres,id',
            'title' => 'nullable|string|max:160',
            'starts_at' => 'nullable|date',
            'ends_at' => 'nullable|date|after_or_equal:starts_at',
            'file' => 'required|file|max:10240|mimes:pdf,jpg,jpeg,png,gif,webp',
        ]);

        $classe = Classe::find($data['class_id']);
        $sem = !empty($data['semestre_id']) ? Semestre::find($data['semestre_id']) : null;

        $file = $request->file('file');
        $path = $file->store("class_docs/{$type}/{$data['class_id']}", 'public');

        $doc = ClassDocument::create([
            'type' => $type,
            'class_id' => (int) $data['class_id'],
            'semestre_id' => !empty($data['semestre_id']) ? (int) $data['semestre_id'] : null,
            'annee_scolaire' => $classe?->annee_scolaire,
            'title' => isset($data['title']) ? trim((string) $data['title']) : null,
            'file_path' => $path,
            'file_mime' => $file->getMimeType(),
            'file_size' => $file->getSize(),
            'starts_at' => $data['starts_at'] ?? null,
            'ends_at' => $data['ends_at'] ?? null,
        ]);

        $doc->setRelation('classe', $classe);
        if ($sem) $doc->setRelation('semestre', $sem);

        return response()->json($this->mapDoc($doc, $request), 201);
    }

    public function adminDestroy(Request $request, int $id)
    {
        $doc = ClassDocument::find($id);
        if (! $doc) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        if ($doc->file_path) {
            Storage::disk('public')->delete($doc->file_path);
        }
        $doc->delete();

        return response()->json(['message' => 'Deleted.']);
    }
}

