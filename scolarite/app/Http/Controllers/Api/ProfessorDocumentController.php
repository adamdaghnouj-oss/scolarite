<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProfessorDocument;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ProfessorDocumentController extends Controller
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
        if ($t === 'exam') return 'exam_surveillance';
        if ($t === 'exam_calendar') return 'exam_surveillance';
        if ($t === 'surveillance') return 'exam_surveillance';
        return $t;
    }

    private function mapDoc(ProfessorDocument $doc, Request $request): array
    {
        return [
            'id' => $doc->id,
            'type' => $doc->type,
            'title' => $doc->title,
            'file_url' => $this->publicStorageUrl($request, $doc->file_path),
            'file_mime' => $doc->file_mime,
            'file_size' => $doc->file_size,
            'starts_at' => optional($doc->starts_at)->toISOString(),
            'ends_at' => optional($doc->ends_at)->toISOString(),
            'created_at' => optional($doc->created_at)->toISOString(),
        ];
    }

    private function assertType(string $type)
    {
        if (! in_array($type, ['timetable', 'exam_surveillance'], true)) {
            abort(response()->json(['message' => 'Invalid type.'], 422));
        }
    }

    // --------------------
    // Professor (read-only)
    // --------------------
    public function professeurIndex(Request $request, string $type)
    {
        $type = $this->normalizeType($type);
        $this->assertType($type);

        $now = now();
        $rows = ProfessorDocument::query()
            ->where('type', $type)
            ->where(function ($q) use ($now) {
                $q->whereNull('starts_at')->orWhere('starts_at', '<=', $now);
            })
            ->where(function ($q) use ($now) {
                $q->whereNull('ends_at')->orWhere('ends_at', '>=', $now);
            })
            ->orderByDesc('id')
            ->get()
            ->map(fn (ProfessorDocument $d) => $this->mapDoc($d, $request))
            ->values();

        return response()->json($rows);
    }

    // --------------------
    // Directeur (manage)
    // --------------------
    public function directeurIndex(Request $request, string $type)
    {
        $type = $this->normalizeType($type);
        $this->assertType($type);

        $rows = ProfessorDocument::query()
            ->where('type', $type)
            ->orderByDesc('id')
            ->limit(800)
            ->get()
            ->map(fn (ProfessorDocument $d) => $this->mapDoc($d, $request))
            ->values();

        return response()->json($rows);
    }

    public function directeurStore(Request $request, string $type)
    {
        $type = $this->normalizeType($type);
        $this->assertType($type);

        $data = $request->validate([
            'title' => 'nullable|string|max:160',
            'starts_at' => 'nullable|date',
            'ends_at' => 'nullable|date|after_or_equal:starts_at',
            'file' => 'required|file|max:10240|mimes:pdf,jpg,jpeg,png,gif,webp',
        ]);

        $file = $request->file('file');
        $path = $file->store("prof_docs/{$type}", 'public');

        $doc = ProfessorDocument::create([
            'type' => $type,
            'title' => isset($data['title']) ? trim((string) $data['title']) : null,
            'file_path' => $path,
            'file_mime' => $file->getMimeType(),
            'file_size' => $file->getSize(),
            'starts_at' => $data['starts_at'] ?? null,
            'ends_at' => $data['ends_at'] ?? null,
        ]);

        return response()->json($this->mapDoc($doc, $request), 201);
    }

    public function directeurDestroy(Request $request, int $id)
    {
        $doc = ProfessorDocument::find($id);
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

