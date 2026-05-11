<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE students MODIFY COLUMN overall_status ENUM('pending', 'in_progress', 'accepted', 'rejected') DEFAULT 'pending'");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE students MODIFY COLUMN overall_status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending'");
        }
    }
};
