"use client";

import { Eye, EyeOff, Lock } from "lucide-react";

interface AdminLoginCardProps {
  password: string;
  showPassword: boolean;
  errorMessage?: string;
  onPasswordChange: (value: string) => void;
  onToggleShowPassword: () => void;
  onAuthenticate: () => void;
}

export function AdminLoginCard({
  password,
  showPassword,
  errorMessage,
  onPasswordChange,
  onToggleShowPassword,
  onAuthenticate,
}: AdminLoginCardProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-500 p-6">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 space-y-6">
        <div className="text-center">
          <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold">CMS Admin Panel</h1>
          <p className="text-gray-500 text-sm">Enter your password</p>
        </div>

        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
              errorMessage ? "border-red-400 focus:ring-red-500" : ""
            }`}
            placeholder="Password"
          />
          <button
            onClick={onToggleShowPassword}
            className="absolute right-3 top-3 text-gray-500"
          >
            {showPassword ? <EyeOff /> : <Eye />}
          </button>
        </div>

        {errorMessage && (
          <p className="text-sm text-red-600">{errorMessage}</p>
        )}

        <button
          onClick={onAuthenticate}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700"
        >
          Sign In
        </button>
      </div>
    </div>
  );
}
