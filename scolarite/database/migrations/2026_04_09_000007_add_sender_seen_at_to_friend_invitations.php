<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('friend_invitations', function (Blueprint $table) {
            $table->timestamp('sender_seen_at')->nullable()->after('accepted_at');
        });
    }

    public function down(): void
    {
        Schema::table('friend_invitations', function (Blueprint $table) {
            $table->dropColumn('sender_seen_at');
        });
    }
};
