<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ModuleSessionAttendance extends Model
{
    protected $table = 'module_session_attendance';

    protected $fillable = [
        'module_course_session_id',
        'student_id',
        'status',
    ];

    public function session(): BelongsTo
    {
        return $this->belongsTo(ModuleCourseSession::class, 'module_course_session_id');
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }
}
