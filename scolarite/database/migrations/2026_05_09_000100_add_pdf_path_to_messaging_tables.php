<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('friend_messages', function (Blueprint $table) {
            $table->string('pdf_path')->nullable()->after('audio_path');
        });

        Schema::table('class_messages', function (Blueprint $table) {
            $table->string('pdf_path')->nullable()->after('audio_path');
        });

        Schema::table('panier_class_messages', function (Blueprint $table) {
            $table->string('pdf_path')->nullable()->after('audio_path');
        });
    }

    public function down(): void
    {
        Schema::table('friend_messages', function (Blueprint $table) {
            $table->dropColumn('pdf_path');
        });

        Schema::table('class_messages', function (Blueprint $table) {
            $table->dropColumn('pdf_path');
        });

        Schema::table('panier_class_messages', function (Blueprint $table) {
            $table->dropColumn('pdf_path');
        });
    }
};
