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
    <main className="min-h-screen flex items-center justify-center text-slate-300">
      Redirecting…
    </main>
  );
}
