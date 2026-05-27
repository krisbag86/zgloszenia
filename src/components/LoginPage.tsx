import React, { useState } from "react";
import { Zap, LogIn, AlertTriangle, Shield } from "lucide-react";

interface LoginPageProps {
  onLogin: (username: string, password: string) => boolean;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const ok = onLogin(username, password);
    if (!ok) {
      setError("Nieprawidłowy login lub hasło.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-violet-600/5 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-sm space-y-6 relative z-10">
        {/* Logo */}
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-xl shadow-indigo-500/25 relative">
            <Zap className="w-8 h-8 text-white" />
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-400/20 to-transparent" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
            Panel Wsparcia IT
          </h1>
          <p className="text-xs text-white/30 mt-2 tracking-wide">
            Zaloguj się, aby kontynuować
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/[0.06] p-6 space-y-5 shadow-2xl"
        >
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="login-username"
              className="block text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-2"
            >
              Login
            </label>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoFocus
              required
              className="w-full px-4 py-2.5 text-sm border border-white/10 rounded-xl focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 bg-white/[0.03] text-white placeholder-white/20 font-mono"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-2"
            >
              Hasło
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              required
              className="w-full px-4 py-2.5 text-sm border border-white/10 rounded-xl focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 bg-white/[0.03] text-white placeholder-white/20 font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-2.5 rounded-xl transition-all cursor-pointer text-sm shadow-lg shadow-indigo-500/20 active:scale-[0.98] disabled:opacity-50 select-none"
          >
            <LogIn className="w-4 h-4" />
            {loading ? "Logowanie..." : "Zaloguj się"}
          </button>

          <div className="flex items-center justify-center gap-1.5 text-[10px] text-white/20">
            <Shield className="w-3 h-3" />
            <span>Szyfrowane połączenie</span>
          </div>
        </form>
      </div>
    </div>
  );
}
