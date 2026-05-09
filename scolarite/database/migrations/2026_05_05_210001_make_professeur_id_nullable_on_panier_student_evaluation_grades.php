<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('panier_student_evaluation_grades', function (Blueprint $table) {
            $table->dropForeign(['professeur_id']);
        });

        Schema::table('panier_student_evaluation_grades', function (Blueprint $table) {
            $table->unsignedBigInteger('professeur_id')->nullable()->change();
        });

        Schema::table('panier_student_evaluation_grades', function (Blueprint $table) {
            $table->foreign('professeur_id')->references('id')->on('professeurs')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('panier_student_evaluation_grades', function (Blueprint $table) {
            $table->dropForeign(['professeur_id']);
        });

        Schema::table('panier_student_evaluation_grades', function (Blueprint $table) {
            $table->unsignedBigInteger('professeur_id')->nullable(false)->change();
        });

        Schema::table('panier_student_evaluation_grades', function (Blueprint $table) {
            $table->foreign('professeur_id')->references('id')->on('professeurs')->cascadeOnDelete();
        });
    }
};
