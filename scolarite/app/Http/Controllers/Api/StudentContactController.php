<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StudentContact;
use Illuminate\Http\Request;

class StudentContactController extends Controller
{
    public function studentIndex(Request $request)
    {
        $contacts = StudentContact::query()
            ->with(['repliedByUser:id,name'])
            ->where('student_user_id', $request->user()->id)
            ->latest('id')
            ->limit(200)
            ->get()
            ->map(fn (StudentContact $contact) => $this->mapContact($contact))
            ->values();

        return response()->json($contacts);
    }

    public function studentStore(Request $request)
    {
        $data = $request->validate([
            'subject' => 'required|string|max:180',
            'message' => 'required|string|max:5000',
        ]);

        $contact = StudentContact::create([
            'student_user_id' => $request->user()->id,
            'subject' => trim((string) $data['subject']),
            'message' => trim((string) $data['message']),
            'status' => 'pending',
        ]);

        return response()->json($this->mapContact($contact), 201);
    }

    public function adminIndex()
    {
        $contacts = StudentContact::query()
            ->with(['studentUser:id,name,email', 'repliedByUser:id,name'])
            ->latest('id')
            ->limit(500)
            ->get()
            ->map(function (StudentContact $contact) {
                return [
                    ...$this->mapContact($contact),
                    'student' => [
                        'id' => $contact->studentUser?->id,
                        'name' => $contact->studentUser?->name ?? 'Student',
                        'email' => $contact->studentUser?->email ?? '',
                    ],
                ];
            })
            ->values();

        return response()->json($contacts);
    }

    public function adminReply(Request $request, int $id)
    {
        $data = $request->validate([
            'reply' => 'required|string|max:5000',
        ]);

        $contact = StudentContact::with(['studentUser:id,name,email', 'repliedByUser:id,name'])->find($id);
        if (! $contact) {
            return response()->json(['message' => 'Contact message not found.'], 404);
        }

        $contact->update([
            'admin_reply' => trim((string) $data['reply']),
            'status' => 'replied',
            'replied_by_user_id' => $request->user()->id,
            'replied_at' => now(),
        ]);
        $contact->refresh();

        return response()->json([
            ...$this->mapContact($contact),
            'student' => [
                'id' => $contact->studentUser?->id,
                'name' => $contact->studentUser?->name ?? 'Student',
                'email' => $contact->studentUser?->email ?? '',
            ],
        ]);
    }

    private function mapContact(StudentContact $contact): array
    {
        return [
            'id' => $contact->id,
            'subject' => $contact->subject,
            'message' => $contact->message,
            'status' => $contact->status,
            'admin_reply' => $contact->admin_reply,
            'replied_at' => optional($contact->replied_at)->toISOString(),
            'replied_by' => $contact->repliedByUser ? [
                'id' => $contact->repliedByUser->id,
                'name' => $contact->repliedByUser->name,
            ] : null,
            'created_at' => optional($contact->created_at)->toISOString(),
            'updated_at' => optional($contact->updated_at)->toISOString(),
        ];
    }
}
