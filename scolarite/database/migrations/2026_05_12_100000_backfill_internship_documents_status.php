<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('internship_requests')
            ->where('rapport_status', 'accepted')
            ->where('attestation_status', 'accepted')
            ->where('status', 'approved')
            ->update(['status' => 'documents_accepted']);

        DB::table('internship_requests')
            ->where('status', 'approved')
            ->where(function ($q) {
                $q->whereIn('rapport_status', ['pending_review', 'rejected'])
                    ->orWhereIn('attestation_status', ['pending_review', 'rejected'])
                    ->orWhereNotNull('rapport_path')
                    ->orWhereNotNull('attestation_path');
            })
            ->update(['status' => 'documents_pending_review']);
    }

    public function down(): void
    {
        DB::table('internship_requests')
            ->whereIn('status', ['documents_accepted', 'documents_pending_review'])
            ->update(['status' => 'approved']);
    }
};
