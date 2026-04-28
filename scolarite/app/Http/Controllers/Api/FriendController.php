<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ClassMessage;
use App\Models\FriendMessage;
use App\Models\Professeur;
use App\Models\Student;
use App\Models\StudentPost;
use App\Models\StudentPostComment;
use App\Models\StudentPostCommentLike;
use App\Models\StudentPostLike;
use App\Models\User;
use App\Models\UserInvitation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FriendController extends Controller
{
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

    private function mapStudentCard(Student $student, Request $request): array
    {
        return [
            'id' => $student->id,
            'user_id' => $student->user_id,
            'role' => 'student',
            'name' => $student->user->name ?? '',
            'email' => $student->user->email ?? '',
            'matricule' => $student->matricule,
            'class_id' => $student->class_id,
            'class_name' => $student->classeObj->name ?? $student->classe,
            'departement' => $student->classeObj->departement ?? null,
            'profile_picture' => $student->profile_picture,
            'profile_picture_url' => $this->publicStorageUrl($request, $student->profile_picture),
            'cover_photo' => $student->cover_photo,
            'cover_photo_url' => $this->publicStorageUrl($request, $student->cover_photo),
        ];
    }

    private function mapProfCard(Professeur $prof, Request $request): array
    {
        $prof->loadMissing('user');

        return [
            'id' => null,
            'user_id' => $prof->user_id,
            'role' => 'professeur',
            'name' => $prof->user->name ?? '',
            'email' => $prof->user->email ?? '',
            'matricule' => $prof->matricule,
            'class_id' => null,
            'class_name' => null,
            'departement' => $prof->departement,
            'profile_picture' => $prof->profile_picture,
            'profile_picture_url' => $this->publicStorageUrl($request, $prof->profile_picture),
            'cover_photo' => $prof->cover_photo,
            'cover_photo_url' => $this->publicStorageUrl($request, $prof->cover_photo),
        ];
    }

    private function mapUserPerson(User $u, Request $request): array
    {
        if ($u->role === 'student') {
            $s = Student::with(['user', 'classeObj'])->where('user_id', $u->id)->first();
            if ($s) {
                return $this->mapStudentCard($s, $request);
            }
        }
        if ($u->role === 'professeur') {
            $p = Professeur::with('user')->where('user_id', $u->id)->first();
            if ($p) {
                return $this->mapProfCard($p, $request);
            }
        }

        return [
            'id' => null,
            'user_id' => $u->id,
            'role' => $u->role ?? 'user',
            'name' => $u->name ?? '',
            'email' => $u->email ?? '',
            'matricule' => null,
            'class_id' => null,
            'class_name' => null,
            'departement' => null,
            'profile_picture' => null,
            'profile_picture_url' => null,
            'cover_photo' => null,
            'cover_photo_url' => null,
        ];
    }

    private function userInvitationRelation(User $me, User $other): array
    {
        $inv = UserInvitation::where(function ($query) use ($me, $other) {
            $query->where('from_user_id', $me->id)->where('to_user_id', $other->id);
        })->orWhere(function ($query) use ($me, $other) {
            $query->where('from_user_id', $other->id)->where('to_user_id', $me->id);
        })->first();

        if (! $inv) {
            return ['status' => 'none', 'invitation_id' => null];
        }
        if ($inv->status === 'accepted') {
            return ['status' => 'friends', 'invitation_id' => $inv->id];
        }
        if ($inv->status === 'pending') {
            if ($inv->from_user_id === $me->id) {
                return ['status' => 'outgoing_pending', 'invitation_id' => $inv->id];
            }

            return ['status' => 'incoming_pending', 'invitation_id' => $inv->id];
        }

        return ['status' => 'none', 'invitation_id' => null];
    }

    /** @return null|array{user: User, student: ?Student} */
    private function socialActor(Request $request): ?array
    {
        $u = $request->user();
        if (! $u || ! in_array($u->role, ['student', 'professeur'], true)) {
            return null;
        }
        $student = $u->role === 'student' ? Student::where('user_id', $u->id)->first() : null;

        return ['user' => $u, 'student' => $student];
    }

    public function suggestions(Request $request)
    {
        $actor = $this->socialActor($request);
        if (! $actor) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $q = trim((string) $request->query('q', ''));
        $limit = (int) $request->query('limit', 60);
        $limit = max(1, min($limit, 120));

        $users = User::query()
            ->whereIn('role', ['student', 'professeur'])
            ->where('id', '!=', $actor['user']->id)
            ->when($q !== '', function ($query) use ($q) {
                $query->where(function ($q2) use ($q) {
                    $q2->where('name', 'like', "%{$q}%")
                        ->orWhere('email', 'like', "%{$q}%")
                        ->orWhereHas('student', function ($sq) use ($q) {
                            $sq->where('matricule', 'like', "%{$q}%")
                                ->orWhere('classe', 'like', "%{$q}%");
                        })
                        ->orWhereHas('professeur', function ($sq) use ($q) {
                            $sq->where('matricule', 'like', "%{$q}%")
                                ->orWhere('departement', 'like', "%{$q}%");
                        });
                });
            })
            ->latest('id')
            ->limit($limit)
            ->get();

        $list = $users->map(function (User $u) use ($actor, $request) {
            $rel = $this->userInvitationRelation($actor['user'], $u);

            return array_merge($this->mapUserPerson($u, $request), [
                'relation_status' => $rel['status'] === 'friends' ? 'friends' : ($rel['status'] === 'incoming_pending' ? 'incoming_pending' : ($rel['status'] === 'outgoing_pending' ? 'outgoing_pending' : 'none')),
            ]);
        })->values();

        return response()->json($list);
    }

    public function showStudentProfile(Request $request, int $id)
    {
        $actor = $this->socialActor($request);
        if (! $actor) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $student = Student::with(['user', 'classeObj'])->find($id);
        if (! $student || ! $student->user) {
            return response()->json(['message' => 'Student not found.'], 404);
        }

        $relation = $this->userInvitationRelation($actor['user'], $student->user);
        $friendsCount = UserInvitation::where('status', 'accepted')
            ->where(function ($query) use ($student) {
                $query->where('from_user_id', $student->user_id)->orWhere('to_user_id', $student->user_id);
            })
            ->count();

        $posts = StudentPost::with(['student.user', 'student.classeObj', 'authorUser'])
            ->where(function ($query) use ($student) {
                $query->where('author_user_id', $student->user_id)->orWhere('student_id', $student->id);
            })
            ->latest('id')
            ->limit(100)
            ->get()
            ->map(function (StudentPost $post) use ($request, $actor) {
                $myUid = $actor['user']->id;
                $comments = StudentPostComment::query()
                    ->where('post_id', $post->id)
                    ->oldest('id')
                    ->limit(30)
                    ->get()
                    ->map(function (StudentPostComment $comment) use ($request, $myUid) {
                        $comment->loadMissing('authorUser');
                        $cu = $comment->authorUser;
                        $commentAuthor = $cu ? Student::with('user')->where('user_id', $cu->id)->first() : null;

                        return [
                            'id' => $comment->id,
                            'body' => $comment->body,
                            'created_at' => optional($comment->created_at)->toISOString(),
                            'likes_count' => StudentPostCommentLike::where('comment_id', $comment->id)->count(),
                            'liked_by_me' => StudentPostCommentLike::where('comment_id', $comment->id)->where('user_id', $myUid)->exists(),
                            'author' => [
                                'id' => $commentAuthor?->id,
                                'name' => $cu?->name ?? 'Member',
                                'profile_picture_url' => $this->publicStorageUrl($request, $commentAuthor?->profile_picture),
                            ],
                        ];
                    })
                    ->values();

                $post->loadMissing(['authorUser', 'student.user', 'student.classeObj']);
                $au = $post->authorUser;
                $ps = $post->student;

                return [
                    'id' => $post->id,
                    'body' => $post->body,
                    'image_url' => $this->publicStorageUrl($request, $post->image_path),
                    'created_at' => optional($post->created_at)->toISOString(),
                    'likes_count' => StudentPostLike::where('post_id', $post->id)->count(),
                    'liked_by_me' => StudentPostLike::where('post_id', $post->id)->where('user_id', $myUid)->exists(),
                    'comments_count' => StudentPostComment::where('post_id', $post->id)->count(),
                    'comments' => $comments,
                    'author' => [
                        'id' => $ps?->id ?? $au?->id,
                        'user_id' => $au?->id,
                        'student_id' => $ps?->id,
                        'name' => $au?->name ?? $ps?->user?->name ?? '',
                        'email' => $au?->email ?? $ps?->user?->email ?? '',
                        'profile_picture_url' => $this->publicStorageUrl($request, $ps?->profile_picture),
                        'class_name' => $ps?->classeObj?->name ?? $ps?->classe,
                    ],
                ];
            })
            ->values();

        return response()->json([
            'student' => $this->mapStudentCard($student, $request),
            'relation_status' => $relation['status'],
            'invitation_id' => $relation['invitation_id'],
            'friends_count' => $friendsCount,
            'posts' => $posts,
        ]);
    }

    public function showUserProfile(Request $request, int $userId)
    {
        $actor = $this->socialActor($request);
        if (! $actor) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $other = User::find($userId);
        if (! $other || ! in_array($other->role, ['student', 'professeur'], true)) {
            return response()->json(['message' => 'User not found.'], 404);
        }

        if ($other->id === $actor['user']->id) {
            return response()->json(['message' => 'Use your account page.'], 422);
        }

        if ($other->role === 'student') {
            $student = Student::where('user_id', $other->id)->first();
            if ($student) {
                return $this->showStudentProfile($request, $student->id);
            }
        }

        $relation = $this->userInvitationRelation($actor['user'], $other);
        $friendsCount = UserInvitation::where('status', 'accepted')
            ->where(function ($query) use ($other) {
                $query->where('from_user_id', $other->id)->orWhere('to_user_id', $other->id);
            })
            ->count();

        $posts = StudentPost::with(['student.user', 'student.classeObj', 'authorUser'])
            ->where('author_user_id', $other->id)
            ->latest('id')
            ->limit(100)
            ->get()
            ->map(function (StudentPost $post) use ($request, $actor) {
                $myUid = $actor['user']->id;

                return [
                    'id' => $post->id,
                    'body' => $post->body,
                    'image_url' => $this->publicStorageUrl($request, $post->image_path),
                    'created_at' => optional($post->created_at)->toISOString(),
                    'likes_count' => StudentPostLike::where('post_id', $post->id)->count(),
                    'liked_by_me' => StudentPostLike::where('post_id', $post->id)->where('user_id', $myUid)->exists(),
                    'comments_count' => StudentPostComment::where('post_id', $post->id)->count(),
                    'comments' => [],
                    'author' => [
                        'id' => $post->student?->id ?? $post->authorUser?->id,
                        'user_id' => $post->authorUser?->id,
                        'name' => $post->authorUser?->name ?? '',
                        'email' => $post->authorUser?->email ?? '',
                        'profile_picture_url' => $this->publicStorageUrl($request, $post->student?->profile_picture),
                        'class_name' => $post->student?->classeObj?->name ?? $post->student?->classe,
                    ],
                ];
            })
            ->values();

        return response()->json([
            'person' => $this->mapUserPerson($other, $request),
            'relation_status' => $relation['status'],
            'invitation_id' => $relation['invitation_id'],
            'friends_count' => $friendsCount,
            'posts' => $posts,
        ]);
    }

    public function myFriends(Request $request)
    {
        $actor = $this->socialActor($request);
        if (! $actor) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $accepted = UserInvitation::where('status', 'accepted')
            ->where(function ($query) use ($actor) {
                $query->where('from_user_id', $actor['user']->id)
                    ->orWhere('to_user_id', $actor['user']->id);
            })
            ->latest('accepted_at')
            ->get();

        $friends = $accepted->map(function (UserInvitation $inv) use ($actor, $request) {
            $otherId = $inv->from_user_id === $actor['user']->id ? $inv->to_user_id : $inv->from_user_id;
            $other = User::find($otherId);
            if (! $other) {
                return null;
            }

            return array_merge($this->mapUserPerson($other, $request), [
                'friend_since' => optional($inv->accepted_at)->toISOString(),
            ]);
        })->filter()->values();

        return response()->json($friends);
    }

    public function incomingInvitations(Request $request)
    {
        $actor = $this->socialActor($request);
        if (! $actor) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $incoming = UserInvitation::with(['fromUser'])
            ->where('to_user_id', $actor['user']->id)
            ->where('status', 'pending')
            ->latest('id')
            ->get()
            ->map(function (UserInvitation $inv) use ($request) {
                return [
                    'invitation_id' => $inv->id,
                    'sent_at' => optional($inv->created_at)->toISOString(),
                    'from' => $inv->fromUser ? $this->mapUserPerson($inv->fromUser, $request) : [],
                ];
            })->values();

        return response()->json($incoming);
    }

    public function sendInvitation(Request $request)
    {
        $actor = $this->socialActor($request);
        if (! $actor) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'student_id' => 'nullable|integer|exists:students,id',
            'receiver_user_id' => 'nullable|integer|exists:users,id',
        ]);

        $toUserId = null;
        if (! empty($data['receiver_user_id'])) {
            $toUserId = (int) $data['receiver_user_id'];
        } elseif (! empty($data['student_id'])) {
            $targetStudent = Student::find((int) $data['student_id']);
            $toUserId = $targetStudent?->user_id;
        }

        if (! $toUserId) {
            return response()->json(['message' => 'Provide receiver_user_id or student_id.'], 422);
        }

        if ($toUserId === $actor['user']->id) {
            return response()->json(['message' => 'You cannot invite yourself.'], 422);
        }

        $targetUser = User::find($toUserId);
        if (! $targetUser || ! in_array($targetUser->role, ['student', 'professeur'], true)) {
            return response()->json(['message' => 'Invalid recipient.'], 422);
        }

        $existing = UserInvitation::where(function ($query) use ($actor, $toUserId) {
            $query->where('from_user_id', $actor['user']->id)->where('to_user_id', $toUserId);
        })->orWhere(function ($query) use ($actor, $toUserId) {
            $query->where('from_user_id', $toUserId)->where('to_user_id', $actor['user']->id);
        })->first();

        if ($existing) {
            if ($existing->status === 'accepted') {
                return response()->json(['message' => 'Already connected.'], 200);
            }
            if ($existing->status === 'pending') {
                return response()->json(['message' => 'Invitation already pending.'], 200);
            }
            $existing->update([
                'from_user_id' => $actor['user']->id,
                'to_user_id' => $toUserId,
                'status' => 'pending',
                'accepted_at' => null,
                'sender_seen_at' => null,
            ]);

            return response()->json(['message' => 'Invitation sent.']);
        }

        UserInvitation::create([
            'from_user_id' => $actor['user']->id,
            'to_user_id' => $toUserId,
            'status' => 'pending',
        ]);

        return response()->json(['message' => 'Invitation sent.'], 201);
    }

    public function acceptInvitation(Request $request, int $id)
    {
        $actor = $this->socialActor($request);
        if (! $actor) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $inv = UserInvitation::where('id', $id)
            ->where('to_user_id', $actor['user']->id)
            ->where('status', 'pending')
            ->first();

        if (! $inv) {
            return response()->json(['message' => 'Invitation not found.'], 404);
        }

        $inv->update([
            'status' => 'accepted',
            'accepted_at' => now(),
            'sender_seen_at' => null,
        ]);

        return response()->json(['message' => 'Invitation accepted.']);
    }

    public function rejectInvitation(Request $request, int $id)
    {
        $actor = $this->socialActor($request);
        if (! $actor) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $inv = UserInvitation::where('id', $id)
            ->where('to_user_id', $actor['user']->id)
            ->where('status', 'pending')
            ->first();

        if (! $inv) {
            return response()->json(['message' => 'Invitation not found.'], 404);
        }

        $inv->update([
            'status' => 'rejected',
        ]);

        return response()->json(['message' => 'Invitation rejected.']);
    }

    public function notificationsSummary(Request $request)
    {
        $actor = $this->socialActor($request);
        if (! $actor) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $incomingInvitations = UserInvitation::where('to_user_id', $actor['user']->id)
            ->where('status', 'pending')
            ->count();

        $acceptedUnseen = UserInvitation::where('from_user_id', $actor['user']->id)
            ->where('status', 'accepted')
            ->whereNull('sender_seen_at')
            ->count();

        $messagesUnread = 0;
        $classMessagesUnread = 0;
        if ($actor['student']) {
            $me = $actor['student'];
            $messagesUnread = FriendMessage::where('receiver_student_id', $me->id)
                ->whereNull('read_at')
                ->count();
            if ($me->class_id) {
                $classMessagesUnread = ClassMessage::where('class_id', $me->class_id)
                    ->where('sender_student_id', '!=', $me->id)
                    ->whereNotExists(function ($q) use ($me) {
                        $q->select(DB::raw(1))
                            ->from('class_message_reads')
                            ->whereColumn('class_message_reads.class_message_id', 'class_messages.id')
                            ->where('class_message_reads.student_id', $me->id);
                    })
                    ->count();
            }
        }

        return response()->json([
            'incoming_invitations' => $incomingInvitations,
            'accepted_unseen' => $acceptedUnseen,
            'friends_total_notifications' => $incomingInvitations + $acceptedUnseen,
            'messages_unread_private' => $messagesUnread,
            'messages_unread_class' => $classMessagesUnread,
            'messages_unread' => $messagesUnread + $classMessagesUnread,
        ]);
    }

    public function markAcceptedSeen(Request $request)
    {
        $actor = $this->socialActor($request);
        if (! $actor) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        UserInvitation::where('from_user_id', $actor['user']->id)
            ->where('status', 'accepted')
            ->whereNull('sender_seen_at')
            ->update(['sender_seen_at' => now()]);

        return response()->json(['message' => 'Accepted invitation notifications marked as seen.']);
    }
}
