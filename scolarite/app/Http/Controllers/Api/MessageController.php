<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ClassMessage;
use App\Models\ClassMessageRead;
use App\Models\Classe;
use App\Models\FriendInvitation;
use App\Models\FriendMessage;
use App\Models\Student;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MessageController extends Controller
{
    private function me(Request $request): ?Student
    {
        $u = $request->user();
        if (!$u) {
            return null;
        }
        return Student::where('user_id', $u->id)->first();
    }

    private function isFriend(int $a, int $b): bool
    {
        return FriendInvitation::where('status', 'accepted')
            ->where(function ($q) use ($a, $b) {
                $q->where(function ($qq) use ($a, $b) {
                    $qq->where('sender_student_id', $a)->where('receiver_student_id', $b);
                })->orWhere(function ($qq) use ($a, $b) {
                    $qq->where('sender_student_id', $b)->where('receiver_student_id', $a);
                });
            })
            ->exists();
    }

    private function publicStorageUrl(Request $request, ?string $pathOrUrl): ?string
    {
        if (!$pathOrUrl || !is_string($pathOrUrl)) {
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

    public function conversations(Request $request)
    {
        $me = $this->me($request);
        if (!$me) {
            return response()->json(['message' => 'Student not found.'], 404);
        }

        $accepted = FriendInvitation::with(['sender.user', 'sender.classeObj', 'receiver.user', 'receiver.classeObj'])
            ->where('status', 'accepted')
            ->where(function ($q) use ($me) {
                $q->where('sender_student_id', $me->id)->orWhere('receiver_student_id', $me->id);
            })
            ->get();

        $items = $accepted->map(function (FriendInvitation $inv) use ($me, $request) {
            $other = $inv->sender_student_id === $me->id ? $inv->receiver : $inv->sender;
            if (!$other) {
                return null;
            }

            $last = FriendMessage::where(function ($q) use ($me, $other) {
                $q->where('sender_student_id', $me->id)->where('receiver_student_id', $other->id);
            })->orWhere(function ($q) use ($me, $other) {
                $q->where('sender_student_id', $other->id)->where('receiver_student_id', $me->id);
            })->latest('id')->first();

            return [
                'friend' => [
                    'id' => $other->id,
                    'name' => $other->user->name ?? '',
                    'email' => $other->user->email ?? '',
                    'class_name' => $other->classeObj->name ?? $other->classe,
                    'profile_picture' => $other->profile_picture,
                    'profile_picture_url' => $this->publicStorageUrl($request, $other->profile_picture),
                ],
                'unread_count' => FriendMessage::where('sender_student_id', $other->id)
                    ->where('receiver_student_id', $me->id)
                    ->whereNull('read_at')
                    ->count(),
                'last_message' => $last ? [
                    'id' => $last->id,
                    'body' => $last->body,
                    'image_url' => $this->publicStorageUrl($request, $last->image_path),
                    'audio_url' => $this->publicStorageUrl($request, $last->audio_path),
                    'pdf_url' => $this->publicStorageUrl($request, $last->pdf_path),
                    'sender_student_id' => $last->sender_student_id,
                    'created_at' => optional($last->created_at)->toISOString(),
                ] : null,
            ];
        })->filter()->values();

        return response()->json($items);
    }

    public function thread(Request $request, int $friendId)
    {
        $me = $this->me($request);
        if (!$me) {
            return response()->json(['message' => 'Student not found.'], 404);
        }

        $friend = Student::with('user')->find($friendId);
        if (!$friend) {
            return response()->json(['message' => 'Student not found.'], 404);
        }
        if (!$this->isFriend($me->id, $friend->id)) {
            return response()->json(['message' => 'Only friends can chat.'], 403);
        }

        // Mark incoming messages from this friend as read once thread is opened.
        FriendMessage::where('sender_student_id', $friend->id)
            ->where('receiver_student_id', $me->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        $messages = FriendMessage::where(function ($q) use ($me, $friend) {
            $q->where('sender_student_id', $me->id)->where('receiver_student_id', $friend->id);
        })->orWhere(function ($q) use ($me, $friend) {
            $q->where('sender_student_id', $friend->id)->where('receiver_student_id', $me->id);
        })->oldest('id')->limit(400)->get()->map(function (FriendMessage $m) use ($request) {
            return [
                'id' => $m->id,
                'sender_student_id' => $m->sender_student_id,
                'receiver_student_id' => $m->receiver_student_id,
                'body' => $m->body,
                'image_url' => $this->publicStorageUrl($request, $m->image_path),
                'audio_url' => $this->publicStorageUrl($request, $m->audio_path),
                'pdf_url' => $this->publicStorageUrl($request, $m->pdf_path),
                'created_at' => optional($m->created_at)->toISOString(),
            ];
        })->values();

        return response()->json([
            'friend' => [
                'id' => $friend->id,
                'name' => $friend->user->name ?? '',
                'email' => $friend->user->email ?? '',
                'profile_picture' => $friend->profile_picture,
                'profile_picture_url' => $this->publicStorageUrl($request, $friend->profile_picture),
            ],
            'messages' => $messages,
        ]);
    }

    public function send(Request $request, int $friendId)
    {
        $me = $this->me($request);
        if (!$me) {
            return response()->json(['message' => 'Student not found.'], 404);
        }
        $friend = Student::find($friendId);
        if (!$friend) {
            return response()->json(['message' => 'Student not found.'], 404);
        }
        if (!$this->isFriend($me->id, $friend->id)) {
            return response()->json(['message' => 'Only friends can chat.'], 403);
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
            $imagePath = $request->file('image')->store("student_docs/{$me->id}/messages", 'public');
        }
        if ($request->hasFile('audio')) {
            $audioPath = $request->file('audio')->store("student_docs/{$me->id}/messages", 'public');
        }
        if ($request->hasFile('pdf')) {
            $pdfPath = $request->file('pdf')->store("student_docs/{$me->id}/messages", 'public');
        }
        if ($body === '' && !$imagePath && !$audioPath && !$pdfPath) {
            return response()->json(['message' => 'Message is empty.'], 422);
        }

        $msg = FriendMessage::create([
            'sender_student_id' => $me->id,
            'receiver_student_id' => $friend->id,
            'body' => $body !== '' ? $body : null,
            'image_path' => $imagePath,
            'audio_path' => $audioPath,
            'pdf_path' => $pdfPath,
        ]);

        return response()->json([
            'id' => $msg->id,
            'sender_student_id' => $msg->sender_student_id,
            'receiver_student_id' => $msg->receiver_student_id,
            'body' => $msg->body,
            'image_url' => $this->publicStorageUrl($request, $msg->image_path),
            'audio_url' => $this->publicStorageUrl($request, $msg->audio_path),
            'pdf_url' => $this->publicStorageUrl($request, $msg->pdf_path),
            'created_at' => optional($msg->created_at)->toISOString(),
        ], 201);
    }

    public function classConversation(Request $request)
    {
        $me = $this->me($request);
        if (!$me) {
            return response()->json(['message' => 'Student not found.'], 404);
        }
        if (!$me->class_id) {
            return response()->json(['conversation' => null]);
        }

        $classe = Classe::find($me->class_id);
        if (!$classe) {
            return response()->json(['conversation' => null]);
        }

        $last = ClassMessage::where('class_id', $classe->id)->latest('id')->first();
        $unread = ClassMessage::where('class_id', $classe->id)
            ->where('sender_student_id', '!=', $me->id)
            ->whereNotExists(function ($q) use ($me) {
                $q->select(DB::raw(1))
                    ->from('class_message_reads')
                    ->whereColumn('class_message_reads.class_message_id', 'class_messages.id')
                    ->where('class_message_reads.student_id', $me->id);
            })
            ->count();

        return response()->json([
            'conversation' => [
                'id' => $classe->id,
                'name' => $classe->name,
                'departement' => $classe->departement,
                'students_count' => Student::where('class_id', $classe->id)->count(),
                'unread_count' => $unread,
                'last_message' => $last ? [
                    'id' => $last->id,
                    'body' => $last->body,
                    'image_url' => $this->publicStorageUrl($request, $last->image_path),
                    'audio_url' => $this->publicStorageUrl($request, $last->audio_path),
                    'pdf_url' => $this->publicStorageUrl($request, $last->pdf_path),
                    'sender_student_id' => $last->sender_student_id,
                    'created_at' => optional($last->created_at)->toISOString(),
                ] : null,
            ],
        ]);
    }

    public function classThread(Request $request)
    {
        $me = $this->me($request);
        if (!$me) {
            return response()->json(['message' => 'Student not found.'], 404);
        }
        if (!$me->class_id) {
            return response()->json(['message' => 'You are not assigned to a class.'], 403);
        }

        $classe = Classe::find($me->class_id);
        if (!$classe) {
            return response()->json(['message' => 'Class not found.'], 404);
        }

        $unreadIds = ClassMessage::where('class_id', $classe->id)
            ->where('sender_student_id', '!=', $me->id)
            ->whereNotExists(function ($q) use ($me) {
                $q->select(DB::raw(1))
                    ->from('class_message_reads')
                    ->whereColumn('class_message_reads.class_message_id', 'class_messages.id')
                    ->where('class_message_reads.student_id', $me->id);
            })
            ->pluck('id');

        if ($unreadIds->isNotEmpty()) {
            $now = now();
            $payload = $unreadIds->map(fn ($id) => [
                'class_message_id' => $id,
                'student_id' => $me->id,
                'read_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ])->all();
            ClassMessageRead::insertOrIgnore($payload);
        }

        $messages = ClassMessage::with(['sender.user'])
            ->where('class_id', $classe->id)
            ->oldest('id')
            ->limit(500)
            ->get()
            ->map(function (ClassMessage $m) use ($request) {
                return [
                    'id' => $m->id,
                    'sender_student_id' => $m->sender_student_id,
                    'sender_name' => $m->sender->user->name ?? 'Student',
                    'sender_profile_picture_url' => $this->publicStorageUrl($request, $m->sender->profile_picture ?? null),
                    'body' => $m->body,
                    'image_url' => $this->publicStorageUrl($request, $m->image_path),
                    'audio_url' => $this->publicStorageUrl($request, $m->audio_path),
                    'pdf_url' => $this->publicStorageUrl($request, $m->pdf_path),
                    'created_at' => optional($m->created_at)->toISOString(),
                ];
            })
            ->values();

        return response()->json([
            'class' => [
                'id' => $classe->id,
                'name' => $classe->name,
                'departement' => $classe->departement,
                'students_count' => Student::where('class_id', $classe->id)->count(),
            ],
            'messages' => $messages,
        ]);
    }

    public function sendClassMessage(Request $request)
    {
        $me = $this->me($request);
        if (!$me) {
            return response()->json(['message' => 'Student not found.'], 404);
        }
        if (!$me->class_id) {
            return response()->json(['message' => 'You are not assigned to a class.'], 403);
        }

        $classe = Classe::find($me->class_id);
        if (!$classe) {
            return response()->json(['message' => 'Class not found.'], 404);
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
            $imagePath = $request->file('image')->store("student_docs/{$me->id}/messages/class", 'public');
        }
        if ($request->hasFile('audio')) {
            $audioPath = $request->file('audio')->store("student_docs/{$me->id}/messages/class", 'public');
        }
        if ($request->hasFile('pdf')) {
            $pdfPath = $request->file('pdf')->store("student_docs/{$me->id}/messages/class", 'public');
        }
        if ($body === '' && !$imagePath && !$audioPath && !$pdfPath) {
            return response()->json(['message' => 'Message is empty.'], 422);
        }

        $msg = ClassMessage::create([
            'class_id' => $classe->id,
            'sender_student_id' => $me->id,
            'body' => $body !== '' ? $body : null,
            'image_path' => $imagePath,
            'audio_path' => $audioPath,
            'pdf_path' => $pdfPath,
        ]);

        ClassMessageRead::updateOrCreate(
            ['class_message_id' => $msg->id, 'student_id' => $me->id],
            ['read_at' => now()]
        );

        return response()->json([
            'id' => $msg->id,
            'sender_student_id' => $msg->sender_student_id,
            'sender_name' => $me->user->name ?? 'Student',
            'sender_profile_picture_url' => $this->publicStorageUrl($request, $me->profile_picture),
            'body' => $msg->body,
            'image_url' => $this->publicStorageUrl($request, $msg->image_path),
            'audio_url' => $this->publicStorageUrl($request, $msg->audio_path),
            'pdf_url' => $this->publicStorageUrl($request, $msg->pdf_path),
            'created_at' => optional($msg->created_at)->toISOString(),
        ], 201);
    }

    public function updateFriendMessage(Request $request, int $id)
    {
        $me = $this->me($request);
        if (!$me) {
            return response()->json(['message' => 'Student not found.'], 404);
        }

        $msg = FriendMessage::findOrFail($id);
        if ((int) $msg->sender_student_id !== (int) $me->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'body' => 'required|string|max:4000',
        ]);
        $msg->update(['body' => trim((string) $data['body'])]);

        return response()->json([
            'id' => $msg->id,
            'sender_student_id' => $msg->sender_student_id,
            'receiver_student_id' => $msg->receiver_student_id,
            'body' => $msg->body,
            'image_url' => $this->publicStorageUrl($request, $msg->image_path),
            'audio_url' => $this->publicStorageUrl($request, $msg->audio_path),
            'pdf_url' => $this->publicStorageUrl($request, $msg->pdf_path),
            'created_at' => optional($msg->created_at)->toISOString(),
        ]);
    }

    public function destroyFriendMessage(Request $request, int $id)
    {
        $me = $this->me($request);
        if (!$me) {
            return response()->json(['message' => 'Student not found.'], 404);
        }

        $msg = FriendMessage::findOrFail($id);
        if ((int) $msg->sender_student_id !== (int) $me->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        $msg->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    public function updateClassMessage(Request $request, int $id)
    {
        $me = $this->me($request);
        if (!$me) {
            return response()->json(['message' => 'Student not found.'], 404);
        }

        $msg = ClassMessage::findOrFail($id);
        if ((int) $msg->sender_student_id !== (int) $me->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'body' => 'required|string|max:4000',
        ]);
        $msg->update(['body' => trim((string) $data['body'])]);

        return response()->json([
            'id' => $msg->id,
            'sender_student_id' => $msg->sender_student_id,
            'body' => $msg->body,
            'image_url' => $this->publicStorageUrl($request, $msg->image_path),
            'audio_url' => $this->publicStorageUrl($request, $msg->audio_path),
            'pdf_url' => $this->publicStorageUrl($request, $msg->pdf_path),
            'created_at' => optional($msg->created_at)->toISOString(),
        ]);
    }

    public function destroyClassMessage(Request $request, int $id)
    {
        $me = $this->me($request);
        if (!$me) {
            return response()->json(['message' => 'Student not found.'], 404);
        }

        $msg = ClassMessage::findOrFail($id);
        if ((int) $msg->sender_student_id !== (int) $me->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        $msg->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    public function classMembers(Request $request)
    {
        $me = $this->me($request);
        if (!$me) {
            return response()->json(['message' => 'Student not found.'], 404);
        }
        if (!$me->class_id) {
            return response()->json(['members' => []]);
        }

        $members = Student::with(['user', 'classeObj'])
            ->where('class_id', $me->class_id)
            ->orderBy('id')
            ->get()
            ->map(function (Student $s) use ($request) {
                return [
                    'id' => $s->id,
                    'name' => $s->user->name ?? 'Student',
                    'email' => $s->user->email ?? '',
                    'matricule' => $s->matricule,
                    'class_name' => $s->classeObj->name ?? $s->classe,
                    'profile_picture_url' => $this->publicStorageUrl($request, $s->profile_picture),
                ];
            })
            ->values();

        return response()->json(['members' => $members]);
    }
}
