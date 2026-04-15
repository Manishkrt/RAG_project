"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (token) router.replace("/dashboard");
    else router.replace("/auth/login");
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-slate-300">
        <div className="h-10 w-10 rounded-full border-4 border-slate-700 border-t-cyan-400 animate-spin" />
      </div>
    </main>
  );
}
