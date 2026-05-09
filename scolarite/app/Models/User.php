<?php

namespace App\Models;

use App\Mail\OtpVerificationMail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'verification_code',
        'verification_code_expires_at',
        'is_verified',
        'verification_attempts',
        'password_reset_code',
        'password_reset_code_expires_at',
        'password_reset_attempts',
    ];

    public function student(): HasOne
    {
        return $this->hasOne(Student::class);
    }

    public function professeur(): HasOne
    {
        return $this->hasOne(Professeur::class);
    }

    public function administrateur(): HasOne
    {
        return $this->hasOne(Administrateur::class);
    }

    public function directeurEtudes(): HasOne
    {
        return $this->hasOne(DirecteurEtudes::class);
    }

    public function directeurStage(): HasOne
    {
        return $this->hasOne(DirecteurStage::class);
    }

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'verification_code_expires_at' => 'datetime',
            'is_verified' => 'boolean',
        ];
    }

    /**
     * Generate a random 6-digit OTP code.
     */
    public function generateVerificationCode(): string
    {
        return str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    }

    /**
     * Send OTP verification email.
     */
    public function sendVerificationEmail(): void
    {
        $code = $this->generateVerificationCode();
        
        $this->update([
            'verification_code' => $code,
            'verification_code_expires_at' => now()->addMinutes(15),
            'verification_attempts' => 0,
        ]);

        Mail::to($this->email)->send(new OtpVerificationMail($code, $this->name));
    }

    /**
     * Send password reset OTP code.
     */
    public function sendPasswordResetEmail(): void
    {
        $code = $this->generateVerificationCode();

        $this->update([
            'password_reset_code' => $code,
            'password_reset_code_expires_at' => now()->addMinutes(15),
            'password_reset_attempts' => 0,
        ]);

        Mail::to($this->email)->send(new OtpVerificationMail($code, $this->name));
    }

    /**
     * Verify password reset OTP code.
     */
    public function verifyPasswordResetCode(string $code): bool
    {
        if ($this->password_reset_code !== $code) {
            $this->increment('password_reset_attempts');
            return false;
        }

        if ($this->password_reset_code_expires_at && now()->greaterThan($this->password_reset_code_expires_at)) {
            return false;
        }

        $this->update([
            'password_reset_code' => null,
            'password_reset_code_expires_at' => null,
            'password_reset_attempts' => 0,
        ]);

        return true;
    }

    /**
     * Verify the OTP code.
     */
    public function verifyCode(string $code): bool
    {
        // Check if code matches
        if ($this->verification_code !== $code) {
            $this->increment('verification_attempts');
            return false;
        }

        // Check if code has expired
        if ($this->verification_code_expires_at && now()->greaterThan($this->verification_code_expires_at)) {
            return false;
        }

        // Mark user as verified
        $this->update([
            'is_verified' => true,
            'verification_code' => null,
            'verification_code_expires_at' => null,
            'verification_attempts' => 0,
            'email_verified_at' => now(),
        ]);

        return true;
    }

    /**
     * Check if the user is verified.
     */
    public function isVerified(): bool
    {
        return $this->is_verified === true;
    }

    /**
     * Check if verification code can be resent (rate limiting).
     */
    public function canResendVerificationCode(): bool
    {
        if (!$this->verification_code_expires_at) {
            return true;
        }

        // Allow resend if code has expired
        if (now()->greaterThan($this->verification_code_expires_at)) {
            return true;
        }

        // Check rate limiting (max 3 attempts per hour)
        return $this->verification_attempts < 3;
    }
}
