"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Loader2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "Email atau kata sandi salah."
          : error.message
      );
      setLoading(false);
      return;
    }

    router.push("/peserta");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-(--color-canvas-soft) px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-(--color-ink)">
            <CalendarDays className="h-6 w-6 text-white" />
          </div>
          <h1 className="font-display text-xl font-semibold text-(--color-ink)">
            {process.env.NEXT_PUBLIC_EVENT_NAME || "Event Check-in"}
          </h1>
          <p className="mt-1 text-sm text-(--color-slate)">
            Masuk untuk mengelola peserta undangan
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-(--color-border) bg-white p-6 shadow-sm"
        >
          <div className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-(--color-ink)"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="panitia@acara.com"
                className="w-full rounded-lg border border-(--color-border) px-3.5 py-2.5 text-sm text-(--color-ink) placeholder:text-(--color-slate-light) focus:border-(--color-ink) focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-(--color-ink)"
              >
                Kata sandi
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-(--color-border) px-3.5 py-2.5 text-sm text-(--color-ink) placeholder:text-(--color-slate-light) focus:border-(--color-ink) focus:outline-none"
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-(--color-ink) px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Memeriksa..." : "Masuk"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-(--color-slate)">
          Akun panitia dibuat oleh admin melalui Supabase Dashboard.
        </p>
      </div>
    </div>
  );
}
