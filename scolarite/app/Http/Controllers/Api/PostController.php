<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StudentPostComment;
use App\Models\StudentPostCommentLike;
use App\Models\StudentPostCommentReply;
use App\Models\StudentPostLike;
use App\Models\StudentStoryLike;
use App\Models\StudentStory;
use App\Models\StudentStoryView;
use App\Models\Professeur;
use App\Models\Student;
use App\Models\StudentPost;
use App\Models\User;
use App\Models\UserInvitation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PostController extends Controller
{
    /** @return null|array{user: User, student: ?Student} */
    private function actor(Request $request): ?array
    {
        $u = $request->user();
        if (! $u || ! in_array($u->role, ['student', 'professeur'], true)) {
            return null;
        }
        $student = $u->role === 'student' ? Student::where('user_id', $u->id)->first() : null;

        return ['user' => $u, 'student' => $student];
    }

    private function connectedUserIds(int $myUserId): array
    {
        $ids = collect([$myUserId]);
        $rows = UserInvitation::where('status', 'accepted')
            ->where(function ($q) use ($myUserId) {
                $q->where('from_user_id', $myUserId)->orWhere('to_user_id', $myUserId);
            })
            ->get(['from_user_id', 'to_user_id']);
        foreach ($rows as $r) {
            $ids->push($r->from_user_id, $r->to_user_id);
        }

        return $ids->unique()->values()->all();
    }

    private function friendStudentIdsForStories(int $myUserId): array
    {
        $userIds = $this->connectedUserIds($myUserId);

        return Student::whereIn('user_id', $userIds)->pluck('id')->values()->all();
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

    private function authorProfilePictureUrl(Request $request, ?User $user, ?Student $authorStudent): ?string
    {
        if ($authorStudent?->profile_picture) {
            return $this->publicStorageUrl($request, $authorStudent->profile_picture);
        }
        if (! $user) {
            return null;
        }
        if ($user->role === 'professeur') {
            $prof = Professeur::where('user_id', $user->id)->first();
            if ($prof?->profile_picture) {
                return $this->publicStorageUrl($request, $prof->profile_picture);
            }
        }

        return null;
    }

    private function mapReply(StudentPostCommentReply $reply, Request $request): array
    {
        $reply->loadMissing('authorUser');
        $u = $reply->authorUser;
        $authorStudent = $u ? Student::with(['user', 'classeObj'])->where('user_id', $u->id)->first() : null;

        return [
            'id' => $reply->id,
            'body' => $reply->body,
            'created_at' => optional($reply->created_at)->toISOString(),
            'author' => [
                'id' => $authorStudent?->id ?? $u?->id,
                'user_id' => $u?->id,
                'student_id' => $authorStudent?->id,
                'name' => $u?->name ?? '',
                'profile_picture_url' => $this->authorProfilePictureUrl($request, $u, $authorStudent),
            ],
        ];
    }

    private function mapComment(StudentPostComment $comment, Request $request, ?int $meUserId = null): array
    {
        $comment->loadMissing('authorUser');
        $u = $comment->authorUser;
        $authorStudent = $u ? Student::with(['user', 'classeObj'])->where('user_id', $u->id)->first() : null;

        return [
            'id' => $comment->id,
            'body' => $comment->body,
            'created_at' => optional($comment->created_at)->toISOString(),
            'likes_count' => StudentPostCommentLike::where('comment_id', $comment->id)->count(),
            'liked_by_me' => $meUserId ? StudentPostCommentLike::where('comment_id', $comment->id)->where('user_id', $meUserId)->exists() : false,
            'replies' => StudentPostCommentReply::where('comment_id', $comment->id)
                ->oldest('id')
                ->limit(40)
                ->get()
                ->map(fn (StudentPostCommentReply $reply) => $this->mapReply($reply, $request))
                ->values(),
            'author' => [
                'id' => $authorStudent?->id ?? $u?->id,
                'user_id' => $u?->id,
                'student_id' => $authorStudent?->id,
                'name' => $u?->name ?? '',
                'profile_picture_url' => $this->authorProfilePictureUrl($request, $u, $authorStudent),
            ],
        ];
    }

    private function mapPost(StudentPost $post, Request $request, ?int $meUserId = null): array
    {
        $post->loadMissing(['student.user', 'student.classeObj', 'authorUser']);
        $authorUser = $post->authorUser;
        $authorStudent = $post->student;
        $likesCount = StudentPostLike::where('post_id', $post->id)->count();
        $likedByMe = $meUserId ? StudentPostLike::where('post_id', $post->id)->where('user_id', $meUserId)->exists() : false;
        $comments = StudentPostComment::where('post_id', $post->id)
            ->latest('id')
            ->limit(20)
            ->get()
            ->reverse()
            ->values()
            ->map(fn (StudentPostComment $comment) => $this->mapComment($comment, $request, $meUserId))
            ->values();

        $role = $authorStudent ? 'student' : ($authorUser && $authorUser->role === 'professeur' ? 'professeur' : 'user');

        return [
            'id' => $post->id,
            'body' => $post->body,
            'image_url' => $this->publicStorageUrl($request, $post->image_path),
            'created_at' => optional($post->created_at)->toISOString(),
            'likes_count' => $likesCount,
            'liked_by_me' => $likedByMe,
            'comments_count' => StudentPostComment::where('post_id', $post->id)->count(),
            'comments' => $comments,
            'author' => [
                'id' => $authorStudent?->id ?? $authorUser?->id,
                'user_id' => $authorUser?->id,
                'student_id' => $authorStudent?->id,
                'role' => $role,
                'name' => $authorUser?->name ?? $authorStudent?->user?->name ?? '',
                'email' => $authorUser?->email ?? $authorStudent?->user?->email ?? '',
                'profile_picture_url' => $this->authorProfilePictureUrl($request, $authorUser, $authorStudent),
                'class_name' => $authorStudent?->classeObj?->name ?? $authorStudent?->classe,
            ],
        ];
    }

    public function meContext(Request $request)
    {
        $actor = $this->actor($request);
        if (! $actor) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        return response()->json([
            'user_id' => $actor['user']->id,
            'student_id' => $actor['student']?->id,
            'role' => $actor['user']->role,
        ]);
    }

    public function feed(Request $request)
    {
        $actor = $this->actor($request);
        if (! $actor) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $viewerUserId = (int) $actor['user']->id;

        // Candidate pool for ranking: collect recent posts first, then personalize order.
        $candidatePosts = StudentPost::with(['student.user', 'student.classeObj', 'authorUser'])
            ->whereHas('authorUser', function ($q) {
                $q->whereIn('role', ['student', 'professeur']);
            })
            ->latest('id')
            ->limit(450)
            ->get();

        if ($candidatePosts->isEmpty()) {
            return response()->json([]);
        }

        $postIds = $candidatePosts->pluck('id')->values();
        $authorUserIds = $candidatePosts->pluck('author_user_id')->filter()->unique()->values();

        $likesByPost = StudentPostLike::query()
            ->whereIn('post_id', $postIds)
            ->select('post_id', DB::raw('COUNT(*) as c'))
            ->groupBy('post_id')
            ->pluck('c', 'post_id');

        $commentsByPost = StudentPostComment::query()
            ->whereIn('post_id', $postIds)
            ->select('post_id', DB::raw('COUNT(*) as c'))
            ->groupBy('post_id')
            ->pluck('c', 'post_id');

        $myLikedPostIds = StudentPostLike::query()
            ->whereIn('post_id', $postIds)
            ->where('user_id', $viewerUserId)
            ->pluck('post_id')
            ->flip();

        $myCommentedPostIds = StudentPostComment::query()
            ->whereIn('post_id', $postIds)
            ->where('author_user_id', $viewerUserId)
            ->pluck('post_id')
            ->flip();

        $connectedUserIds = collect($this->connectedUserIds($viewerUserId))->flip();

        // Author affinity: how often current viewer engaged with this author's posts before.
        $likedAuthors = StudentPostLike::query()
            ->join('student_posts', 'student_posts.id', '=', 'student_post_likes.post_id')
            ->where('student_post_likes.user_id', $viewerUserId)
            ->whereIn('student_posts.author_user_id', $authorUserIds)
            ->select('student_posts.author_user_id', DB::raw('COUNT(*) as c'))
            ->groupBy('student_posts.author_user_id')
            ->pluck('c', 'student_posts.author_user_id');

        $commentedAuthors = StudentPostComment::query()
            ->join('student_posts', 'student_posts.id', '=', 'student_post_comments.post_id')
            ->where('student_post_comments.author_user_id', $viewerUserId)
            ->whereIn('student_posts.author_user_id', $authorUserIds)
            ->select('student_posts.author_user_id', DB::raw('COUNT(*) as c'))
            ->groupBy('student_posts.author_user_id')
            ->pluck('c', 'student_posts.author_user_id');

        // Basic preference signal: image vs text based on my engagement history.
        $engagedPostIds = StudentPostLike::query()
            ->where('user_id', $viewerUserId)
            ->pluck('post_id')
            ->merge(
                StudentPostComment::query()
                    ->where('author_user_id', $viewerUserId)
                    ->pluck('post_id')
            )
            ->unique()
            ->values();

        $engagedImageCount = 0;
        $engagedTextCount = 0;
        if ($engagedPostIds->isNotEmpty()) {
            $engagedImageCount = StudentPost::query()
                ->whereIn('id', $engagedPostIds)
                ->whereNotNull('image_path')
                ->count();
            $engagedTextCount = max(0, $engagedPostIds->count() - $engagedImageCount);
        }
        $engagementTotal = max(1, $engagedImageCount + $engagedTextCount);
        $imagePreference = $engagedImageCount / $engagementTotal;
        $textPreference = $engagedTextCount / $engagementTotal;

        $posts = $candidatePosts
            ->map(function (StudentPost $post) use (
                $likesByPost,
                $commentsByPost,
                $myLikedPostIds,
                $myCommentedPostIds,
                $connectedUserIds,
                $likedAuthors,
                $commentedAuthors,
                $imagePreference,
                $textPreference
            ) {
                $likes = (int) ($likesByPost[$post->id] ?? 0);
                $comments = (int) ($commentsByPost[$post->id] ?? 0);
                $hoursOld = max(0.0, now()->diffInSeconds($post->created_at) / 3600.0);

                // Freshness (1.0 recent -> decays over time)
                $freshness = 1.0 / (1.0 + ($hoursOld / 18.0));

                // Engagement score with comments weighted more than likes.
                $engagement = log(1 + $likes + (2 * $comments));

                $isConnected = isset($connectedUserIds[(int) $post->author_user_id]) ? 1.0 : 0.0;
                $authorAffinity = log(1 + (int) ($likedAuthors[$post->author_user_id] ?? 0) + (2 * (int) ($commentedAuthors[$post->author_user_id] ?? 0)));

                $alreadyInteracted = isset($myLikedPostIds[$post->id]) || isset($myCommentedPostIds[$post->id]);
                $interactionBoost = $alreadyInteracted ? 0.4 : 0.0;

                $contentPreference = $post->image_path ? $imagePreference : $textPreference;

                // Final weighted ranking score.
                $score = (2.5 * $freshness)
                    + (1.8 * $engagement)
                    + (1.5 * $isConnected)
                    + (1.4 * $authorAffinity)
                    + (0.9 * $contentPreference)
                    + $interactionBoost;

                return ['post' => $post, 'score' => $score];
            })
            ->sort(function ($a, $b) {
                if ($a['score'] === $b['score']) {
                    return $b['post']->id <=> $a['post']->id;
                }
                return $b['score'] <=> $a['score'];
            })
            ->take(200)
            ->map(fn (array $ranked) => $this->mapPost($ranked['post'], $request, $actor['user']->id))
            ->values();

        return response()->json($posts);
    }

    public function myPosts(Request $request)
    {
        $actor = $this->actor($request);
        if (! $actor) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $posts = StudentPost::with(['student.user', 'student.classeObj', 'authorUser'])
            ->where('author_user_id', $actor['user']->id)
            ->latest('id')
            ->limit(100)
            ->get()
            ->map(fn (StudentPost $post) => $this->mapPost($post, $request, $actor['user']->id))
            ->values();

        return response()->json($posts);
    }

    public function store(Request $request)
    {
        $actor = $this->actor($request);
        if (! $actor) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $request->validate([
            'body' => 'nullable|string|max:5000',
            'image' => 'nullable|file|mimes:jpg,jpeg,png,gif,webp|max:10240',
        ]);

        $body = trim((string) $request->input('body', ''));
        $imagePath = null;
        $uid = $actor['user']->id;
        $sub = $actor['student'] ? "student_docs/{$actor['student']->id}" : "user_docs/{$uid}";
        if ($request->hasFile('image')) {
            $imagePath = $request->file('image')->store("{$sub}/posts", 'public');
        }

        if ($body === '' && ! $imagePath) {
            return response()->json(['message' => 'Post is empty.'], 422);
        }

        $post = StudentPost::create([
            'student_id' => $actor['student']?->id,
            'author_user_id' => $uid,
            'body' => $body !== '' ? $body : null,
            'image_path' => $imagePath,
        ]);
        $post->load(['student.user', 'student.classeObj', 'authorUser']);

        return response()->json($this->mapPost($post, $request, $actor['user']->id), 201);
    }

    public function toggleLike(Request $request, int $id)
    {
        $actor = $this->actor($request);
        if (! $actor) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        $post = StudentPost::find($id);
        if (! $post) {
            return response()->json(['message' => 'Post not found.'], 404);
        }

        $existing = StudentPostLike::where('post_id', $post->id)->where('user_id', $actor['user']->id)->first();
        if ($existing) {
            $existing->delete();
            $liked = false;
        } else {
            StudentPostLike::create(['post_id' => $post->id, 'user_id' => $actor['user']->id]);
            $liked = true;
        }

        return response()->json([
            'liked' => $liked,
            'likes_count' => StudentPostLike::where('post_id', $post->id)->count(),
        ]);
    }

    public function addComment(Request $request, int $id)
    {
        $actor = $this->actor($request);
        if (! $actor) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        $post = StudentPost::find($id);
        if (! $post) {
            return response()->json(['message' => 'Post not found.'], 404);
        }
        $data = $request->validate([
            'body' => 'required|string|max:2000',
        ]);
        $body = trim((string) $data['body']);
        if ($body === '') {
            return response()->json(['message' => 'Comment is empty.'], 422);
        }
        $comment = StudentPostComment::create([
            'post_id' => $post->id,
            'author_user_id' => $actor['user']->id,
            'body' => $body,
        ]);

        return response()->json([
            'comment' => $this->mapComment($comment, $request, $actor['user']->id),
            'comments_count' => StudentPostComment::where('post_id', $post->id)->count(),
        ], 201);
    }

    public function toggleCommentLike(Request $request, int $id)
    {
        $actor = $this->actor($request);
        if (! $actor) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        $comment = StudentPostComment::find($id);
        if (! $comment) {
            return response()->json(['message' => 'Comment not found.'], 404);
        }
        $existing = StudentPostCommentLike::where('comment_id', $comment->id)->where('user_id', $actor['user']->id)->first();
        if ($existing) {
            $existing->delete();
            $liked = false;
        } else {
            StudentPostCommentLike::create(['comment_id' => $comment->id, 'user_id' => $actor['user']->id]);
            $liked = true;
        }

        return response()->json([
            'liked' => $liked,
            'likes_count' => StudentPostCommentLike::where('comment_id', $comment->id)->count(),
        ]);
    }

    public function addReply(Request $request, int $id)
    {
        $actor = $this->actor($request);
        if (! $actor) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        $comment = StudentPostComment::find($id);
        if (! $comment) {
            return response()->json(['message' => 'Comment not found.'], 404);
        }
        $data = $request->validate([
            'body' => 'required|string|max:2000',
        ]);
        $body = trim((string) $data['body']);
        if ($body === '') {
            return response()->json(['message' => 'Reply is empty.'], 422);
        }
        $reply = StudentPostCommentReply::create([
            'comment_id' => $comment->id,
            'author_user_id' => $actor['user']->id,
            'body' => $body,
        ]);

        return response()->json([
            'reply' => $this->mapReply($reply, $request),
        ], 201);
    }

    public function share(Request $request, int $id)
    {
        $actor = $this->actor($request);
        if (! $actor) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        $original = StudentPost::with(['student.user', 'authorUser'])->find($id);
        if (! $original) {
            return response()->json(['message' => 'Post not found.'], 404);
        }

        $original->loadMissing('authorUser');
        $authorName = $original->authorUser?->name ?? $original->student?->user?->name ?? 'Member';
        $prefix = "Shared from {$authorName}: ";
        $body = $original->body ? ($prefix.$original->body) : $prefix;
        $shared = StudentPost::create([
            'student_id' => $actor['student']?->id,
            'author_user_id' => $actor['user']->id,
            'body' => $body,
            'image_path' => $original->image_path,
        ]);
        $shared->load(['student.user', 'student.classeObj', 'authorUser']);

        return response()->json($this->mapPost($shared, $request, $actor['user']->id), 201);
    }

    public function updatePost(Request $request, int $id)
    {
        $actor = $this->actor($request);
        if (! $actor) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        $post = StudentPost::with(['student.user', 'student.classeObj', 'authorUser'])->find($id);
        if (! $post) {
            return response()->json(['message' => 'Post not found.'], 404);
        }
        if ((int) $post->author_user_id !== (int) $actor['user']->id) {
            return response()->json(['message' => 'You can only edit your own posts.'], 403);
        }

        $data = $request->validate([
            'body' => 'required|string|max:5000',
        ]);
        $body = trim((string) $data['body']);
        if ($body === '') {
            return response()->json(['message' => 'Post body is empty.'], 422);
        }

        $post->update(['body' => $body]);
        $post->refresh();

        return response()->json($this->mapPost($post, $request, $actor['user']->id));
    }

    public function deletePost(Request $request, int $id)
    {
        $actor = $this->actor($request);
        if (! $actor) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        $post = StudentPost::find($id);
        if (! $post) {
            return response()->json(['message' => 'Post not found.'], 404);
        }
        if ((int) $post->author_user_id !== (int) $actor['user']->id) {
            return response()->json(['message' => 'You can only delete your own posts.'], 403);
        }

        $post->delete();

        return response()->json(['message' => 'Post deleted.']);
    }

    public function stories(Request $request)
    {
        $actor = $this->actor($request);
        if (! $actor || ! $actor['student']) {
            return response()->json([]);
        }
        $me = $actor['student'];
        $ids = $this->friendStudentIdsForStories($actor['user']->id);
        $ids[] = $me->id;
        $ids = array_values(array_unique($ids));

        $stories = StudentStory::whereIn('student_id', $ids)
            ->where('expires_at', '>', now())
            ->latest('id')
            ->limit(120)
            ->get();

        $students = Student::with('user')->whereIn('id', array_unique($stories->pluck('student_id')->all()))->get()->keyBy('id');

        $mapped = $stories->map(function (StudentStory $story) use ($students, $request, $me) {
            $author = $students->get($story->student_id);

            return [
                'id' => $story->id,
                'body' => $story->body,
                'image_url' => $this->publicStorageUrl($request, $story->image_path),
                'overlay_style' => $story->overlay_style,
                'expires_at' => optional($story->expires_at)->toISOString(),
                'views_count' => StudentStoryView::where('story_id', $story->id)->count(),
                'likes_count' => StudentStoryLike::where('story_id', $story->id)->count(),
                'liked_by_me' => StudentStoryLike::where('story_id', $story->id)->where('student_id', $me->id)->exists(),
                'author' => [
                    'id' => $author?->id,
                    'name' => $author?->user?->name ?? '',
                    'profile_picture_url' => $this->publicStorageUrl($request, $author?->profile_picture),
                ],
            ];
        })->values();

        return response()->json($mapped);
    }

    public function storeStory(Request $request)
    {
        $actor = $this->actor($request);
        if (! $actor || ! $actor['student']) {
            return response()->json(['message' => 'Stories are only available for student accounts.'], 403);
        }
        $me = $actor['student'];
        $request->validate([
            'body' => 'nullable|string|max:1000',
            'image' => 'nullable|file|mimes:jpg,jpeg,png,gif,webp|max:10240',
            'overlay_style' => 'nullable|string|max:2000',
        ]);

        $body = trim((string) $request->input('body', ''));
        $imagePath = null;
        if ($request->hasFile('image')) {
            $imagePath = $request->file('image')->store("student_docs/{$me->id}/stories", 'public');
        }
        if ($body === '' && !$imagePath) {
            return response()->json(['message' => 'Story is empty.'], 422);
        }
        $overlayStyle = null;
        if ($request->filled('overlay_style')) {
            $decoded = json_decode((string) $request->input('overlay_style'), true);
            if (is_array($decoded)) {
                $overlayStyle = [
                    'text' => (string) ($decoded['text'] ?? ''),
                    'color' => (string) ($decoded['color'] ?? '#ffffff'),
                    'x' => (int) ($decoded['x'] ?? 50),
                    'y' => (int) ($decoded['y'] ?? 30),
                    'size' => (int) ($decoded['size'] ?? 36),
                ];
            }
        }

        $story = StudentStory::create([
            'student_id' => $me->id,
            'body' => $body !== '' ? $body : null,
            'image_path' => $imagePath,
            'overlay_style' => $overlayStyle,
            'expires_at' => now()->addHours(24),
        ]);

        return response()->json([
            'id' => $story->id,
            'body' => $story->body,
            'image_url' => $this->publicStorageUrl($request, $story->image_path),
            'overlay_style' => $story->overlay_style,
            'expires_at' => optional($story->expires_at)->toISOString(),
        ], 201);
    }

    public function viewStory(Request $request, int $id)
    {
        $actor = $this->actor($request);
        if (! $actor || ! $actor['student']) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        $me = $actor['student'];
        $story = StudentStory::find($id);
        if (! $story || $story->expires_at <= now()) {
            return response()->json(['message' => 'Story not found.'], 404);
        }

        $isOwner = (int) $story->student_id === (int) $me->id;
        if (! $isOwner && ! in_array($story->student_id, $this->friendStudentIdsForStories($actor['user']->id), true)) {
            return response()->json(['message' => 'Not allowed to view this story.'], 403);
        }

        if (!$isOwner) {
            StudentStoryView::firstOrCreate([
                'story_id' => $story->id,
                'viewer_student_id' => $me->id,
            ]);
        }

        $author = Student::with('user')->find($story->student_id);
        $views = StudentStoryView::where('story_id', $story->id)->get();
        $viewerStudents = Student::with('user')
            ->whereIn('id', $views->pluck('viewer_student_id')->all())
            ->get()
            ->keyBy('id');

        return response()->json([
            'id' => $story->id,
            'body' => $story->body,
            'image_url' => $this->publicStorageUrl($request, $story->image_path),
            'overlay_style' => $story->overlay_style,
            'expires_at' => optional($story->expires_at)->toISOString(),
            'views_count' => $views->count(),
            'likes_count' => StudentStoryLike::where('story_id', $story->id)->count(),
            'liked_by_me' => StudentStoryLike::where('story_id', $story->id)->where('student_id', $me->id)->exists(),
            'author' => [
                'id' => $author?->id,
                'name' => $author?->user?->name ?? '',
                'profile_picture_url' => $this->publicStorageUrl($request, $author?->profile_picture),
            ],
            'viewers' => $views->map(function (StudentStoryView $view) use ($viewerStudents, $request) {
                $student = $viewerStudents->get($view->viewer_student_id);
                return [
                    'id' => $student?->id,
                    'name' => $student?->user?->name ?? '',
                    'profile_picture_url' => $this->publicStorageUrl($request, $student?->profile_picture),
                    'viewed_at' => optional($view->created_at)->toISOString(),
                ];
            })->values(),
        ]);
    }

    public function updateStory(Request $request, int $id)
    {
        $actor = $this->actor($request);
        if (! $actor || ! $actor['student']) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        $me = $actor['student'];
        $story = StudentStory::find($id);
        if (!$story || $story->expires_at <= now()) {
            return response()->json(['message' => 'Story not found.'], 404);
        }
        if ((int) $story->student_id !== (int) $me->id) {
            return response()->json(['message' => 'You can only edit your own story.'], 403);
        }

        $request->validate([
            'body' => 'nullable|string|max:1000',
            'overlay_style' => 'nullable|string|max:2000',
        ]);
        $body = trim((string) $request->input('body', ''));
        $overlayStyle = $story->overlay_style;
        if ($request->filled('overlay_style')) {
            $decoded = json_decode((string) $request->input('overlay_style'), true);
            if (is_array($decoded)) {
                $overlayStyle = [
                    'text' => (string) ($decoded['text'] ?? ''),
                    'color' => (string) ($decoded['color'] ?? '#ffffff'),
                    'x' => (int) ($decoded['x'] ?? 50),
                    'y' => (int) ($decoded['y'] ?? 30),
                    'size' => (int) ($decoded['size'] ?? 36),
                ];
            }
        }
        $story->update([
            'body' => $body !== '' ? $body : null,
            'overlay_style' => $overlayStyle,
        ]);

        return response()->json([
            'id' => $story->id,
            'body' => $story->body,
            'image_url' => $this->publicStorageUrl($request, $story->image_path),
            'overlay_style' => $story->overlay_style,
            'expires_at' => optional($story->expires_at)->toISOString(),
            'views_count' => StudentStoryView::where('story_id', $story->id)->count(),
            'likes_count' => StudentStoryLike::where('story_id', $story->id)->count(),
            'liked_by_me' => StudentStoryLike::where('story_id', $story->id)->where('student_id', $me->id)->exists(),
        ]);
    }

    public function deleteStory(Request $request, int $id)
    {
        $actor = $this->actor($request);
        if (! $actor || ! $actor['student']) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        $me = $actor['student'];
        $story = StudentStory::find($id);
        if (!$story || $story->expires_at <= now()) {
            return response()->json(['message' => 'Story not found.'], 404);
        }
        if ((int) $story->student_id !== (int) $me->id) {
            return response()->json(['message' => 'You can only delete your own story.'], 403);
        }
        $story->delete();
        return response()->json(['message' => 'Story deleted.']);
    }

    public function toggleStoryLike(Request $request, int $id)
    {
        $actor = $this->actor($request);
        if (! $actor || ! $actor['student']) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        $me = $actor['student'];
        $story = StudentStory::find($id);
        if (! $story || $story->expires_at <= now()) {
            return response()->json(['message' => 'Story not found.'], 404);
        }

        $isOwner = (int) $story->student_id === (int) $me->id;
        if (! $isOwner && ! in_array($story->student_id, $this->friendStudentIdsForStories($actor['user']->id), true)) {
            return response()->json(['message' => 'Not allowed to like this story.'], 403);
        }

        $existing = StudentStoryLike::where('story_id', $story->id)->where('student_id', $me->id)->first();
        if ($existing) {
            $existing->delete();
            $liked = false;
        } else {
            StudentStoryLike::create(['story_id' => $story->id, 'student_id' => $me->id]);
            $liked = true;
        }

        return response()->json([
            'liked' => $liked,
            'likes_count' => StudentStoryLike::where('story_id', $story->id)->count(),
        ]);
    }
}
