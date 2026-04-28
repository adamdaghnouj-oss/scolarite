<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StudentEvent;
use Illuminate\Http\Request;

class StudentEventController extends Controller
{
    private function purgeExpiredEvents(): void
    {
        StudentEvent::query()
            ->whereNotNull('event_at')
            ->where('event_at', '<', now())
            ->delete();
    }

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

    private function mapEvent(StudentEvent $event, Request $request): array
    {
        $event->loadMissing('authorUser');

        return [
            'id' => $event->id,
            'event_type' => $event->event_type,
            'title' => $event->title,
            'description' => $event->description,
            'place' => $event->place,
            'event_at' => optional($event->event_at)->toISOString(),
            'image_url' => $this->publicStorageUrl($request, $event->image_path),
            'created_at' => optional($event->created_at)->toISOString(),
            'author' => [
                'user_id' => $event->authorUser?->id,
                'name' => $event->authorUser?->name ?? 'Student',
            ],
        ];
    }

    public function index(Request $request)
    {
        $this->purgeExpiredEvents();

        $events = StudentEvent::query()
            ->with('authorUser')
            ->latest('id')
            ->limit(500)
            ->get()
            ->map(fn (StudentEvent $event) => $this->mapEvent($event, $request))
            ->values();

        return response()->json($events);
    }

    public function store(Request $request)
    {
        $this->purgeExpiredEvents();

        $data = $request->validate([
            'event_type' => 'nullable|string|max:80',
            'title' => 'sometimes|string|max:180',
            'description' => 'sometimes|string|max:5000',
            'place' => 'nullable|string|max:160',
            'event_at' => 'nullable|date',
            'image' => 'nullable|file|mimes:jpg,jpeg,png,gif,webp|max:10240',
        ]);

        if (array_key_exists('title', $data)) {
            $title = trim((string) $data['title']);
            if ($title === '') {
                return response()->json(['message' => 'The title field is required.'], 422);
            }
        } else {
            $title = $event->title;
        }

        if (array_key_exists('description', $data)) {
            $description = trim((string) $data['description']);
            if ($description === '') {
                return response()->json(['message' => 'The description field is required.'], 422);
            }
        } else {
            $description = $event->description;
        }

        $imagePath = null;
        if ($request->hasFile('image')) {
            $imagePath = $request->file('image')->store('student_events', 'public');
        }

        $event = StudentEvent::create([
            'author_user_id' => $request->user()->id,
            'event_type' => trim((string) ($data['event_type'] ?? '')) ?: null,
            'title' => $title,
            'description' => $description,
            'place' => trim((string) ($data['place'] ?? '')) ?: null,
            'event_at' => $data['event_at'] ?? null,
            'image_path' => $imagePath,
        ]);

        return response()->json($this->mapEvent($event, $request), 201);
    }

    public function destroy(Request $request, int $id)
    {
        $this->purgeExpiredEvents();

        $event = StudentEvent::find($id);
        if (! $event) {
            return response()->json(['message' => 'Event not found.'], 404);
        }
        if ((int) $event->author_user_id !== (int) $request->user()->id) {
            return response()->json(['message' => 'You can only delete your own events.'], 403);
        }

        $event->delete();

        return response()->json(['message' => 'Event deleted.']);
    }

    public function update(Request $request, int $id)
    {
        $this->purgeExpiredEvents();

        $event = StudentEvent::find($id);
        if (! $event) {
            return response()->json(['message' => 'Event not found.'], 404);
        }
        if ((int) $event->author_user_id !== (int) $request->user()->id) {
            return response()->json(['message' => 'You can only edit your own events.'], 403);
        }

        $data = $request->validate([
            'event_type' => 'nullable|string|max:80',
            'title' => 'required|string|max:180',
            'description' => 'required|string|max:5000',
            'place' => 'nullable|string|max:160',
            'event_at' => 'nullable|date',
            'image' => 'nullable|file|mimes:jpg,jpeg,png,gif,webp|max:10240',
        ]);

        $title = trim((string) $data['title']);
        $description = trim((string) $data['description']);
        if ($title === '' || $description === '') {
            return response()->json(['message' => 'Title and description are required.'], 422);
        }

        $updateData = [
            'event_type' => trim((string) ($data['event_type'] ?? '')) ?: null,
            'title' => $title,
            'description' => $description,
            'place' => trim((string) ($data['place'] ?? '')) ?: null,
            'event_at' => $data['event_at'] ?? null,
        ];

        if ($request->hasFile('image')) {
            $updateData['image_path'] = $request->file('image')->store('student_events', 'public');
        }

        $event->update($updateData);
        $event->refresh();

        return response()->json($this->mapEvent($event, $request));
    }
}
