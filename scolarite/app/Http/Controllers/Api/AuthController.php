<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Administrateur;
use App\Models\Classe;
use App\Models\DirecteurEtudes;
use App\Models\DirecteurStage;
use App\Models\Professeur;
use App\Models\Student;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Rules\Password as PasswordRule;

class AuthController extends Controller
{
    /**
     * Register a new user with role and save to correct database table.
     */
    public function register(Request $request)
    {
        $rules = [
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8|confirmed',
            'role' => 'required|in:student,professeur,administrateur,directeur_etudes,directeur_stage',
        ];

        $role = $request->role;
        if ($role === 'student') {
            $rules['matricule'] = 'required|string|max:50|unique:students,matricule';
        } elseif ($role === 'professeur') {
            $rules['matricule'] = 'nullable|string|max:50|unique:professeurs,matricule';
            $allowedDepts = Classe::distinctDepartementNames()->all();
            $rules['departement'] = [
                'nullable',
                'string',
                'max:100',
                function (string $attribute, mixed $value, \Closure $fail) use ($allowedDepts) {
                    if ($value === null || $value === '') {
                        return;
                    }
                    if (! in_array($value, $allowedDepts, true)) {
                        $fail(__('validation.in', ['attribute' => $attribute]));
                    }
                },
            ];
        } elseif ($role === 'administrateur') {
            $rules['departement'] = 'nullable|string|max:100';
        } elseif ($role === 'directeur_etudes') {
            $rules['matricule'] = 'nullable|string|max:50|unique:directeur_etudes,matricule';
            $rules['departement'] = 'nullable|string|max:100';
        } elseif ($role === 'directeur_stage') {
            $rules['matricule'] = 'nullable|string|max:50|unique:directeurs_stage,matricule';
            $rules['departement'] = 'nullable|string|max:100';
        }

        $request->validate($rules, [
            'password.confirmed' => 'The password confirmation does not match.',
        ]);

        try {
            DB::beginTransaction();

            $user = User::create([
                'name' => $request->name,
                'email' => $request->email,
                'password' => $request->password,
                'role' => $role,
                'is_verified' => false,
            ]);

            if ($role === 'student') {
                Student::create([
                    'user_id' => $user->id,
                    'matricule' => $request->matricule,
                    'classe' => null,
                ]);
            } elseif ($role === 'professeur') {
                Professeur::create([
                    'user_id' => $user->id,
                    'matricule' => $request->matricule,
                    'departement' => $request->departement,
                ]);
            } elseif ($role === 'administrateur') {
                Administrateur::create([
                    'user_id' => $user->id,
                    'departement' => $request->departement,
                ]);
            } elseif ($role === 'directeur_etudes') {
                DirecteurEtudes::create([
                    'user_id' => $user->id,
                    'matricule' => $request->matricule,
                    'departement' => $request->departement,
                ]);
            } elseif ($role === 'directeur_stage') {
                DirecteurStage::create([
                    'user_id' => $user->id,
                    'matricule' => $request->matricule,
                    'departement' => $request->departement,
                ]);
            }

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }

        // Send verification email
        try {
            $user->sendVerificationEmail();
        } catch (\Exception $e) {
            \Log::error('Failed to send verification email: ' . $e->getMessage());
        }

        return response()->json([
            'message' => 'Account created successfully. Please check your email for verification code.',
            'requires_verification' => true,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'is_verified' => false,
            ],
        ], 201);
    }

    /**
     * Verify OTP code.
     */
    public function verifyOtp(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'code' => 'required|string|size:6',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user) {
            return response()->json([
                'message' => 'User not found.',
            ], 404);
        }

        if (!$user->verifyCode($request->code)) {
            $attemptsLeft = 3 - $user->verification_attempts;
            return response()->json([
                'message' => 'Invalid or expired verification code.',
                'attempts_left' => max(0, $attemptsLeft),
            ], 422);
        }

        // Generate token after verification
        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'message' => 'Email verified successfully!',
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'is_verified' => true,
            ],
        ]);
    }

    /**
     * Resend OTP code.
     */
    public function resendOtp(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user) {
            return response()->json([
                'message' => 'User not found.',
            ], 404);
        }

        if (!$user->canResendVerificationCode()) {
            return response()->json([
                'message' => 'Too many attempts. Please wait before requesting a new code.',
                'expires_at' => $user->verification_code_expires_at,
            ], 429);
        }

        try {
            $user->sendVerificationEmail();
            return response()->json([
                'message' => 'Verification code has been resent to your email.',
            ]);
        } catch (\Exception $e) {
            \Log::error('Failed to resend verification email: ' . $e->getMessage());
            return response()->json([
                'message' => 'Failed to send verification email. Please try again later.',
            ], 500);
        }
    }

    /**
     * Start forgot-password: send reset code to email.
     */
    public function forgotPassword(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
        ]);

        $user = User::where('email', $request->email)->first();

        // Do not reveal if email exists
        if (!$user) {
            return response()->json(['message' => 'If the email exists, a reset code was sent.']);
        }

        try {
            $user->sendPasswordResetEmail();
        } catch (\Exception $e) {
            \Log::error('Failed to send password reset OTP: ' . $e->getMessage());
        }

        return response()->json(['message' => 'If the email exists, a reset code was sent.']);
    }

    /**
     * Finish forgot-password: verify code then set new password.
     */
    public function resetPassword(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'code' => 'required|string|size:6',
            'password' => ['required', 'string', 'confirmed', PasswordRule::min(8)],
        ]);

        $user = User::where('email', $request->email)->first();
        if (!$user) {
            return response()->json(['message' => 'Invalid code.'], 422);
        }

        if (!$user->verifyPasswordResetCode($request->code)) {
            return response()->json(['message' => 'Invalid or expired code.'], 422);
        }

        $user->update([
            'password' => $request->password,
        ]);

        // Revoke tokens after reset
        $user->tokens()->delete();

        return response()->json(['message' => 'Password reset successfully. Please login.']);
    }

    /**
     * Login and return token.
     */
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        // Always send a fresh OTP on login (mandatory each time)
        try {
            $user->sendVerificationEmail();
        } catch (\Exception $e) {
            \Log::error('Failed to send login OTP: ' . $e->getMessage());
            return response()->json([
                'message' => 'Failed to send verification code. Please try again later.',
            ], 500);
        }

        return response()->json([
            'message' => 'Verification code sent to your email. Please enter the code to login.',
            'requires_verification' => true,
        ], 403);
    }

    /**
     * Logout (revoke current token).
     */
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out.']);
    }

    /**
     * Change password for the authenticated user.
     */
    public function changePassword(Request $request)
    {
        $request->validate([
            'current_password' => 'required|string',
            'password' => ['required', 'string', 'confirmed', PasswordRule::min(8)],
        ]);

        $user = $request->user();

        if (!$user || !Hash::check($request->current_password, $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Current password is incorrect.'],
            ]);
        }

        $user->update([
            'password' => $request->password,
        ]);

        // Optional: revoke all tokens so user must login again everywhere
        $user->tokens()->delete();

        return response()->json(['message' => 'Password changed successfully. Please login again.']);
    }
}
