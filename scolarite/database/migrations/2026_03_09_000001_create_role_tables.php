<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasColumn('users', 'role')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('role')->nullable()->after('email'); // student, professeur, administrateur
            });
        }

        if (!Schema::hasTable('students')) {
        Schema::create('students', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('matricule')->unique();
            $table->string('classe');
            $table->timestamps();
        });
        }

        if (!Schema::hasTable('professeurs')) {
        Schema::create('professeurs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('matricule')->unique()->nullable();
            $table->string('departement')->nullable();
            $table->timestamps();
        });
        }

        if (!Schema::hasTable('administrateurs')) {
        Schema::create('administrateurs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('departement')->nullable();
            $table->timestamps();
        });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('students');
        Schema::dropIfExists('professeurs');
        Schema::dropIfExists('administrateurs');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('role');
        });
    }
};
