<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('specialites')) {
            Schema::create('specialites', function (Blueprint $table) {
                $table->id();
                $table->string('departement', 100);
                $table->string('code', 50)->nullable(); // e.g. DSI
                $table->string('name', 150); // e.g. Développement Web et Application
                $table->timestamps();

                $table->unique(['departement', 'name']);
            });
        }

        if (!Schema::hasTable('semestres')) {
            Schema::create('semestres', function (Blueprint $table) {
                $table->id();
                $table->unsignedTinyInteger('number'); // 1..12
                $table->string('label', 50)->nullable(); // e.g. S1
                $table->timestamps();

                $table->unique(['number']);
            });
        }

        if (!Schema::hasTable('plans_etude')) {
            Schema::create('plans_etude', function (Blueprint $table) {
                $table->id();
                $table->foreignId('specialite_id')->constrained('specialites')->cascadeOnDelete();
                $table->foreignId('semestre_id')->constrained('semestres')->restrictOnDelete();
                $table->string('title', 200)->nullable(); // optional display title
                $table->unsignedInteger('version')->default(1);
                $table->boolean('is_active')->default(true);
                $table->timestamps();

                $table->unique(['specialite_id', 'semestre_id', 'version']);
            });
        }

        if (!Schema::hasTable('paniers')) {
            Schema::create('paniers', function (Blueprint $table) {
                $table->id();
                $table->foreignId('plan_etude_id')->constrained('plans_etude')->cascadeOnDelete();
                $table->string('name', 150); // e.g. Tronc commun, Option, UE Fondamentale
                $table->unsignedSmallInteger('ordre')->default(0);
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('modules')) {
            Schema::create('modules', function (Blueprint $table) {
                $table->id();
                $table->foreignId('panier_id')->constrained('paniers')->cascadeOnDelete();
                $table->string('code', 50)->nullable();
                $table->string('name', 200);
                $table->decimal('coefficient', 6, 2)->default(1);
                $table->unsignedSmallInteger('ordre')->default(0);
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('evaluations')) {
            Schema::create('evaluations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('module_id')->constrained('modules')->cascadeOnDelete();
                $table->string('type', 30); // e.g. ds, examen, tp
                $table->decimal('weight', 6, 2)->nullable(); // optional weight/percentage
                $table->unsignedSmallInteger('ordre')->default(0);
                $table->timestamps();

                $table->index(['module_id', 'type']);
            });
        }

        if (!Schema::hasTable('classe_plan_affectations')) {
            Schema::create('classe_plan_affectations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();
                $table->foreignId('plan_etude_id')->constrained('plans_etude')->cascadeOnDelete();
                $table->string('annee_scolaire', 20); // e.g. 2025-2026
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->unique(['class_id', 'plan_etude_id', 'annee_scolaire'], 'uniq_class_plan_year');
                $table->index(['class_id', 'annee_scolaire']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('classe_plan_affectations');
        Schema::dropIfExists('evaluations');
        Schema::dropIfExists('modules');
        Schema::dropIfExists('paniers');
        Schema::dropIfExists('plans_etude');
        Schema::dropIfExists('semestres');
        Schema::dropIfExists('specialites');
    }
};

