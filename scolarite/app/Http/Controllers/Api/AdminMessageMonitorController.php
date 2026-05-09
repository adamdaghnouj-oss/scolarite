<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ClassMessage;
use App\Models\FriendMessage;
use App\Models\PanierClassMessage;
use App\Models\Student;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminMessageMonitorController extends Controller
{
    public function index(Request $request)
    {
        $type = (string) $request->query('type', 'all');
        $studentId = $request->query('student_id');
        $classId = $request->query('class_id');
        $courseThreadId = $request->query('course_thread_id');

        $items = collect();

        if ($type === 'all' || $type === 'friend') {
            $friend = FriendMessage::query()
                ->with(['sender.user', 'receiver.user', 'sender.classeObj'])
                ->latest('id')
                ->limit(500)
                ->get()
                ->map(function (FriendMessage $m) {
                    return [
                        'id' => $m->id,
                        'type' => 'friend',
                        'body' => $m->body,
                        'created_at' => optional($m->created_at)->toISOString(),
                        'sender_name' => $m->sender?->user?->name,
                        'receiver_name' => $m->receiver?->user?->name,
                        'student_id' => $m->sender_student_id,
                        'class_id' => $m->sender?->class_id,
                        'course_thread_id' => null,
                    ];
                });
            $items = $items->concat($friend);
        }

        if ($type === 'all' || $type === 'class') {
            $class = ClassMessage::query()
                ->with(['sender.user', 'sender.classeObj', 'classe'])
                ->latest('id')
                ->limit(500)
                ->get()
                ->map(function (ClassMessage $m) {
                    return [
                        'id' => $m->id,
                        'type' => 'class',
                        'body' => $m->body,
                        'created_at' => optional($m->created_at)->toISOString(),
                        'sender_name' => $m->sender?->user?->name,
                        'receiver_name' => null,
                        'student_id' => $m->sender_student_id,
                        'class_id' => $m->class_id,
                        'course_thread_id' => null,
                    ];
                });
            $items = $items->concat($class);
        }

        if ($type === 'all' || $type === 'course') {
            $course = PanierClassMessage::query()
                ->with(['sender', 'thread.classe', 'thread.panier'])
                ->latest('id')
                ->limit(500)
                ->get()
                ->map(function (PanierClassMessage $m) {
                    $student = Student::where('user_id', $m->sender_user_id)->first();
                    return [
                        'id' => $m->id,
                        'type' => 'course',
                        'body' => $m->body,
                        'created_at' => optional($m->created_at)->toISOString(),
                        'sender_name' => $m->sender?->name,
                        'receiver_name' => null,
                        'student_id' => $student?->id,
                        'class_id' => $m->thread?->class_id,
                        'course_thread_id' => $m->thread_id,
                    ];
                });
            $items = $items->concat($course);
        }

        if ($studentId !== null && $studentId !== '') {
            $items = $items->where('student_id', (int) $studentId);
        }
        if ($classId !== null && $classId !== '') {
            $items = $items->where('class_id', (int) $classId);
        }
        if ($courseThreadId !== null && $courseThreadId !== '') {
            $items = $items->where('course_thread_id', (int) $courseThreadId);
        }

        $items = $items->sortByDesc('created_at')->values();

        return response()->json($items->take(800)->values());
    }

    public function destroy(Request $request, string $type, int $id)
    {
        if ($type === 'friend') {
            FriendMessage::findOrFail($id)->delete();
            return response()->json(['message' => 'Deleted.']);
        }
        if ($type === 'class') {
            ClassMessage::findOrFail($id)->delete();
            return response()->json(['message' => 'Deleted.']);
        }
        if ($type === 'course') {
            PanierClassMessage::findOrFail($id)->delete();
            return response()->json(['message' => 'Deleted.']);
        }

        return response()->json(['message' => 'Unsupported type.'], 422);
    }
}
