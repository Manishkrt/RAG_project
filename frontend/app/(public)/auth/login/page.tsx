"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../../../../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) router.replace("/dashboard");
  }, [router]);

  async function handleLogin() {
    try {
      setBusy(true);
      setError(null);
      const { data } = await api.post("/api/auth/login", { email, password });
      localStorage.setItem("token", data.token);
      router.replace("/dashboard");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <section className="glass max-w-md w-full p-8 rounded-2xl space-y-6">
        <header>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Document Intelligence</p>
          <h1 className="text-2xl font-semibold text-white">Login</h1>
        </header>
        <div className="space-y-3">
          <input
            className="w-full px-4 py-3 rounded-lg bg-slate-900 border border-slate-700 text-white"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            className="w-full px-4 py-3 rounded-lg bg-slate-900 border border-slate-700 text-white"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            onClick={handleLogin}
            disabled={busy}
            className="w-full py-3 rounded-lg bg-cyan-400 text-slate-900 font-semibold hover:bg-cyan-300 transition disabled:opacity-50"
          >
            {busy ? "Signing in..." : "Login"}
          </button>
          <p className="text-sm text-slate-400 text-center">
            No account?{" "}
            <Link className="underline" href="/auth/register">
              Register
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
