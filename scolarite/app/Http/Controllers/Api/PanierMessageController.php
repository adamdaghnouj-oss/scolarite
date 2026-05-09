<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ClasseModuleProfAssignment;
use App\Models\PanierClassMessage;
use App\Models\PanierClassMessageRead;
use App\Models\PanierClassMessageThread;
use App\Models\Professeur;
use App\Models\Student;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PanierMessageController extends Controller
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
            return $request->getSchemeAndHttpHost().$request->getBasePath().$normalized;
        }
        if (str_starts_with($normalized, 'storage/')) {
            return $request->getSchemeAndHttpHost().$request->getBasePath().'/'.$normalized;
        }

        return $request->getSchemeAndHttpHost().$request->getBasePath().'/storage/'.ltrim($normalized, '/');
    }

    /** @return array{0: ?Student, 1: ?Professeur, 2: User} */
    private function resolveActor(Request $request): array
    {
        $user = $request->user();
        if (! $user) {
            return [null, null, $user];
        }
        $student = $user->role === 'student' ? Student::where('user_id', $user->id)->first() : null;
        $prof = $user->role === 'professeur' ? Professeur::where('user_id', $user->id)->first() : null;

        return [$student, $prof, $user];
    }

    private function accessibleThreadKeys(Request $request): array
    {
        [$student, $prof, $user] = $this->resolveActor($request);
        $keys = [];

        if ($student && $student->class_id) {
            $student->loadMissing('classeObj');
            $classe = $student->classeObj;
            $year = $classe?->annee_scolaire ?? '';
            if ($year !== '') {
                $paniers = ClasseModuleProfAssignment::query()
                    ->where('class_id', $student->class_id)
                    ->where('annee_scolaire', $year)
                    ->with('module')
                    ->get()
                    ->pluck('module.panier_id')
                    ->filter()
                    ->unique()
                    ->values();
                foreach ($paniers as $pid) {
                    $keys[] = ['class_id' => (int) $student->class_id, 'panier_id' => (int) $pid, 'annee_scolaire' => $year];
                }
            }
        }

        if ($prof) {
            $assignments = ClasseModuleProfAssignment::query()
                ->where(function ($q) use ($prof) {
                    $q->where('professeur_cours_id', $prof->id)->orWhere('professeur_tp_id', $prof->id);
                })
                ->with('module')
                ->get();
            foreach ($assignments as $a) {
                if (! $a->module?->panier_id) {
                    continue;
                }
                $keys[] = [
                    'class_id' => (int) $a->class_id,
                    'panier_id' => (int) $a->module->panier_id,
                    'annee_scolaire' => (string) $a->annee_scolaire,
                ];
            }
        }

        $uniq = [];
        foreach ($keys as $k) {
            $s = $k['class_id'].'|'.$k['panier_id'].'|'.$k['annee_scolaire'];
            $uniq[$s] = $k;
        }

        return array_values($uniq);
    }

    private function userCanAccessThread(Request $request, PanierClassMessageThread $t): bool
    {
        [$student, $prof, $user] = $this->resolveActor($request);
        if (! $user) {
            return false;
        }
        if ($student && (int) $student->class_id === (int) $t->class_id) {
            $classe = $student->classeObj;
            $year = $classe?->annee_scolaire ?? '';

            return $year !== '' && $year === $t->annee_scolaire;
        }
        if ($prof) {
            return ClasseModuleProfAssignment::query()
                ->where('class_id', $t->class_id)
                ->where('annee_scolaire', $t->annee_scolaire)
                ->where(function ($q) use ($prof) {
                    $q->where('professeur_cours_id', $prof->id)->orWhere('professeur_tp_id', $prof->id);
                })
                ->whereHas('module', fn ($q) => $q->where('panier_id', $t->panier_id))
                ->exists();
        }

        return false;
    }

    public function conversations(Request $request)
    {
        [$student, $prof, $user] = $this->resolveActor($request);
        if (! $student && ! $prof) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $items = [];
        foreach ($this->accessibleThreadKeys($request) as $key) {
            $thread = PanierClassMessageThread::firstOrCreate(
                [
                    'class_id' => $key['class_id'],
                    'panier_id' => $key['panier_id'],
                    'annee_scolaire' => $key['annee_scolaire'],
                ],
                []
            );
            $thread->load(['classe', 'panier']);
            $last = PanierClassMessage::where('thread_id', $thread->id)->latest('id')->first();
            $unread = PanierClassMessage::where('thread_id', $thread->id)
                ->where('sender_user_id', '!=', $user->id)
                ->whereNotExists(function ($q) use ($user) {
                    $q->select(DB::raw(1))
                        ->from('panier_class_message_reads')
                        ->whereColumn('panier_class_message_reads.panier_class_message_id', 'panier_class_messages.id')
                        ->where('panier_class_message_reads.user_id', $user->id);
                })
                ->count();

            $items[] = [
                'thread_id' => $thread->id,
                'title' => $thread->panier?->name ?? 'Panier',
                'class_name' => $thread->classe?->name ?? '',
                'annee_scolaire' => $thread->annee_scolaire,
                'unread_count' => $unread,
                'last_message' => $last ? [
                    'id' => $last->id,
                    'body' => $last->body,
                    'image_url' => $this->publicStorageUrl($request, $last->image_path),
                    'audio_url' => $this->publicStorageUrl($request, $last->audio_path),
                    'pdf_url' => $this->publicStorageUrl($request, $last->pdf_path),
                    'sender_user_id' => $last->sender_user_id,
                    'created_at' => optional($last->created_at)->toISOString(),
                ] : null,
            ];
        }

        usort($items, fn ($a, $b) => strcmp((string) ($b['last_message']['created_at'] ?? ''), (string) ($a['last_message']['created_at'] ?? '')));

        return response()->json($items);
    }

    public function thread(Request $request, int $threadId)
    {
        [$student, $prof, $user] = $this->resolveActor($request);
        if (! $student && ! $prof) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $thread = PanierClassMessageThread::with(['classe', 'panier'])->findOrFail($threadId);
        if (! $this->userCanAccessThread($request, $thread)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $unreadIds = PanierClassMessage::where('thread_id', $thread->id)
            ->where('sender_user_id', '!=', $user->id)
            ->whereNotExists(function ($q) use ($user) {
                $q->select(DB::raw(1))
                    ->from('panier_class_message_reads')
                    ->whereColumn('panier_class_message_reads.panier_class_message_id', 'panier_class_messages.id')
                    ->where('panier_class_message_reads.user_id', $user->id);
            })
            ->pluck('id');

        if ($unreadIds->isNotEmpty()) {
            $now = now();
            $payload = $unreadIds->map(fn ($id) => [
                'panier_class_message_id' => $id,
                'user_id' => $user->id,
                'read_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ])->all();
            PanierClassMessageRead::insertOrIgnore($payload);
        }

        $messages = PanierClassMessage::with(['sender'])
            ->where('thread_id', $thread->id)
            ->oldest('id')
            ->limit(500)
            ->get()
            ->map(function (PanierClassMessage $m) use ($request) {
                $studentAuthor = Student::where('user_id', $m->sender_user_id)->first();

                return [
                    'id' => $m->id,
                    'sender_user_id' => $m->sender_user_id,
                    'sender_name' => $m->sender?->name ?? 'User',
                    'sender_profile_picture_url' => $this->publicStorageUrl($request, $studentAuthor?->profile_picture),
                    'body' => $m->body,
                    'image_url' => $this->publicStorageUrl($request, $m->image_path),
                    'audio_url' => $this->publicStorageUrl($request, $m->audio_path),
                    'pdf_url' => $this->publicStorageUrl($request, $m->pdf_path),
                    'created_at' => optional($m->created_at)->toISOString(),
                ];
            })
            ->values();

        return response()->json([
            'thread' => [
                'id' => $thread->id,
                'title' => $thread->panier?->name ?? 'Panier',
                'class_name' => $thread->classe?->name ?? '',
                'annee_scolaire' => $thread->annee_scolaire,
            ],
            'messages' => $messages,
        ]);
    }

    public function send(Request $request, int $threadId)
    {
        [$student, $prof, $user] = $this->resolveActor($request);
        if (! $student && ! $prof) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $thread = PanierClassMessageThread::findOrFail($threadId);
        if (! $this->userCanAccessThread($request, $thread)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        if ($user->role !== 'professeur') {
            return response()->json(['message' => 'Only professor can send course messages.'], 403);
        }

        $request->validate([
            'body' => 'nullable|string|max:4000',
            'image' => 'nullable|file|mimes:jpg,jpeg,png,gif,webp|max:10240',
            'audio' => 'nullable|file|mimes:mp3,wav,ogg,webm,m4a,aac|max:15360',
            'pdf' => 'nullable|file|mimes:pdf|max:15360',
        ]);

        $body = trim((string) $request->input('body', ''));
        $imagePath = null;
        $audioPath = null;
        $pdfPath = null;
        if ($request->hasFile('image')) {
            $imagePath = $request->file('image')->store("panier_msgs/{$user->id}", 'public');
        }
        if ($request->hasFile('audio')) {
            $audioPath = $request->file('audio')->store("panier_msgs/{$user->id}", 'public');
        }
        if ($request->hasFile('pdf')) {
            $pdfPath = $request->file('pdf')->store("panier_msgs/{$user->id}", 'public');
        }
        if ($body === '' && ! $imagePath && ! $audioPath && ! $pdfPath) {
            return response()->json(['message' => 'Message is empty.'], 422);
        }

        $msg = PanierClassMessage::create([
            'thread_id' => $thread->id,
            'sender_user_id' => $user->id,
            'body' => $body !== '' ? $body : null,
            'image_path' => $imagePath,
            'audio_path' => $audioPath,
            'pdf_path' => $pdfPath,
        ]);

        PanierClassMessageRead::updateOrCreate(
            ['panier_class_message_id' => $msg->id, 'user_id' => $user->id],
            ['read_at' => now()]
        );

        $studentAuthor = Student::where('user_id', $user->id)->first();

        return response()->json([
            'id' => $msg->id,
            'sender_user_id' => $msg->sender_user_id,
            'sender_name' => $user->name ?? 'User',
            'sender_profile_picture_url' => $this->publicStorageUrl($request, $studentAuthor?->profile_picture),
            'body' => $msg->body,
            'image_url' => $this->publicStorageUrl($request, $msg->image_path),
            'audio_url' => $this->publicStorageUrl($request, $msg->audio_path),
            'pdf_url' => $this->publicStorageUrl($request, $msg->pdf_path),
            'created_at' => optional($msg->created_at)->toISOString(),
        ], 201);
    }

    public function update(Request $request, int $id)
    {
        [, , $user] = $this->resolveActor($request);
        if (! $user) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        $msg = PanierClassMessage::findOrFail($id);
        if ((int) $msg->sender_user_id !== (int) $user->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        $data = $request->validate([
            'body' => 'required|string|max:4000',
        ]);
        $msg->update(['body' => trim((string) $data['body'])]);

        return response()->json([
            'id' => $msg->id,
            'sender_user_id' => $msg->sender_user_id,
            'sender_name' => $user->name ?? 'User',
            'body' => $msg->body,
            'image_url' => $this->publicStorageUrl($request, $msg->image_path),
            'audio_url' => $this->publicStorageUrl($request, $msg->audio_path),
            'pdf_url' => $this->publicStorageUrl($request, $msg->pdf_path),
            'created_at' => optional($msg->created_at)->toISOString(),
        ]);
    }

    public function destroy(Request $request, int $id)
    {
        [, , $user] = $this->resolveActor($request);
        if (! $user) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        $msg = PanierClassMessage::findOrFail($id);
        if ((int) $msg->sender_user_id !== (int) $user->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        $msg->delete();
        return response()->json(['message' => 'Deleted.']);
    }
}
