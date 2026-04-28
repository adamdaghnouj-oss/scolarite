<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('student_stories', function (Blueprint $table) {
            $table->json('overlay_style')->nullable()->after('image_path');
        });
    }

    public function down(): void
    {
        Schema::table('student_stories', function (Blueprint $table) {
            $table->dropColumn('overlay_style');
        });
    }
};
