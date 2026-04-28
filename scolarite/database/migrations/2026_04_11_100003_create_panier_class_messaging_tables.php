<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('panier_class_message_threads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();
            $table->foreignId('panier_id')->constrained('paniers')->cascadeOnDelete();
            $table->string('annee_scolaire', 20);
            $table->timestamps();
            $table->unique(['class_id', 'panier_id', 'annee_scolaire'], 'uniq_panier_class_year');
        });

        Schema::create('panier_class_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('thread_id')->constrained('panier_class_message_threads')->cascadeOnDelete();
            $table->foreignId('sender_user_id')->constrained('users')->cascadeOnDelete();
            $table->text('body')->nullable();
            $table->string('image_path')->nullable();
            $table->string('audio_path')->nullable();
            $table->timestamps();
            $table->index(['thread_id', 'created_at']);
        });

        Schema::create('panier_class_message_reads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('panier_class_message_id')->constrained('panier_class_messages')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
            $table->unique(['panier_class_message_id', 'user_id'], 'uniq_panier_msg_user_read');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('panier_class_message_reads');
        Schema::dropIfExists('panier_class_messages');
        Schema::dropIfExists('panier_class_message_threads');
    }
};
