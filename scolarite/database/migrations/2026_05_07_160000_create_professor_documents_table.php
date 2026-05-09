<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('professor_documents', function (Blueprint $table) {
            $table->id();
            $table->string('type', 40); // timetable | exam_surveillance

            $table->string('title', 160)->nullable();
            $table->string('file_path', 500);
            $table->string('file_mime', 120)->nullable();
            $table->unsignedBigInteger('file_size')->nullable();

            // visibility window (same behavior as student docs)
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();

            $table->timestamps();

            $table->index(['type']);
            $table->index(['type', 'starts_at', 'ends_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('professor_documents');
    }
};

