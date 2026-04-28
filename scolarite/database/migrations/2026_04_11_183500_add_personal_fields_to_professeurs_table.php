<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('professeurs', function (Blueprint $table) {
            if (! Schema::hasColumn('professeurs', 'phone')) {
                $table->string('phone')->nullable()->after('departement');
            }
            if (! Schema::hasColumn('professeurs', 'address')) {
                $table->string('address')->nullable();
            }
            if (! Schema::hasColumn('professeurs', 'postal_code')) {
                $table->string('postal_code')->nullable();
            }
            if (! Schema::hasColumn('professeurs', 'city')) {
                $table->string('city')->nullable();
            }
            if (! Schema::hasColumn('professeurs', 'country')) {
                $table->string('country')->nullable();
            }
            if (! Schema::hasColumn('professeurs', 'date_of_birth')) {
                $table->date('date_of_birth')->nullable();
            }
            if (! Schema::hasColumn('professeurs', 'place_of_birth')) {
                $table->string('place_of_birth')->nullable();
            }
            if (! Schema::hasColumn('professeurs', 'gender')) {
                $table->string('gender')->nullable();
            }
            if (! Schema::hasColumn('professeurs', 'profile_picture')) {
                $table->string('profile_picture')->nullable();
            }
            if (! Schema::hasColumn('professeurs', 'cover_photo')) {
                $table->string('cover_photo')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('professeurs', function (Blueprint $table) {
            foreach ([
                'phone', 'address', 'postal_code', 'city', 'country',
                'date_of_birth', 'place_of_birth', 'gender',
                'profile_picture', 'cover_photo',
            ] as $col) {
                if (Schema::hasColumn('professeurs', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
