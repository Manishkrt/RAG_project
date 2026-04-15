"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { useRef } from "react";

type Doc = {
  _id: string;
  originalName: string;
  status: string;
  createdAt: string;
};

type ChatMessage = { role: string; content: string };
type PendingDelete = { id: string; name: string };

export default function DashboardPage() {
  const router = useRouter();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [selectedDoc, setSelectedDoc] = useState<string>("all");
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [undoSeconds, setUndoSeconds] = useState(10);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const purgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/auth/login");
      return;
    }
    fetchDocs();
    fetchHistory();
  }, [router]);

  useEffect(() => {
    if (messagesRef.current) {
      const el = messagesRef.current;
      el.scrollTop = el.scrollHeight;
    }
  }, [chat]);

  useEffect(() => {
    const hasProcessing = docs.some((d) => d.status !== "ready");
    if (!hasProcessing) return;
    const id = setInterval(fetchDocs, 4000);
    return () => clearInterval(id);
  }, [docs]);

  useEffect(() => {
    return () => {
      if (purgeTimerRef.current) {
        clearTimeout(purgeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!pendingDelete) return;
    setUndoSeconds(10);
    const interval = setInterval(() => {
      setUndoSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [pendingDelete]);

  async function fetchDocs() {
    const { data } = await api.get("/api/docs");
    setDocs(data);
  }

  async function removeDoc(id: string) {
    setBusy(true);
    if (purgeTimerRef.current && pendingDelete) {
      clearTimeout(purgeTimerRef.current);
      purgeTimerRef.current = null;
      await api.delete(`/api/docs/${pendingDelete.id}/purge`);
      setPendingDelete(null);
    }

    const target = docs.find((d) => d._id === id);
    await api.delete(`/api/docs/${id}`);
    const deletePayload = { id, name: target?.originalName || "document" };
    setPendingDelete(deletePayload);
    setUndoSeconds(10);

    purgeTimerRef.current = setTimeout(async () => {
      try {
        await api.delete(`/api/docs/${id}/purge`);
      } finally {
        setPendingDelete((prev) => (prev?.id === id ? null : prev));
        purgeTimerRef.current = null;
      }
    }, 10000);

    await fetchDocs();
    setBusy(false);
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return;
    const form = new FormData();
    form.append("file", e.target.files[0]);
    setBusy(true);
    setUploadPct(0);
    await api.post("/api/docs/upload", form, {
      onUploadProgress: (p) => {
        if (!p.total) return;
        setUploadPct(Math.round((p.loaded / p.total) * 100));
      },
    });
    await fetchDocs();
    setUploadPct(0);
    setBusy(false);
  }

  async function fetchHistory() {
    const { data } = await api.get("/api/chat/history");
    setChat(data);
  }

  async function resetChat() {
    await api.delete("/api/chat/reset");
    setChat([]);
  }

  async function ask() {
    if (!question) return;
    setBusy(true);
    const payload: any = { question };
    if (selectedDoc !== "all") payload.documentIds = [selectedDoc];
    const { data } = await api.post("/api/chat/ask", payload);
    setChat((c) => [...c, { role: "user", content: question }, { role: "assistant", content: data.text }]);
    setQuestion("");
    setBusy(false);
  }

  function signOut() {
    localStorage.removeItem("token");
    if (typeof window !== "undefined") {
      window.location.href = "/auth/login";
    } else {
      router.replace("/auth/login");
    }
  }

  async function undoDelete() {
    if (!pendingDelete) return;
    if (purgeTimerRef.current) {
      clearTimeout(purgeTimerRef.current);
      purgeTimerRef.current = null;
    }
    const id = pendingDelete.id;
    setPendingDelete(null);
    setBusy(true);
    await api.post(`/api/docs/${id}/undo`);
    await fetchDocs();
    setBusy(false);
  }

  return (
    <main className="h-screen p-6 flex flex-col gap-6 overflow-hidden">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">Document Intelligence Platform</p>
          <h1 className="text-3xl font-semibold text-white">Dashboard & Chat</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="px-3 py-2 rounded-md bg-slate-800 text-slate-200 border border-slate-700"
            onClick={signOut}
          >
            Sign out
          </button>
        </div>
      </header>

      {pendingDelete && (
        <div className="glass rounded-xl p-3 flex items-center justify-between">
          <p className="text-sm text-slate-200">
            Deleted <span className="font-semibold">{pendingDelete.name}</span>. Undo available for {undoSeconds} seconds.
          </p>
          <button
            onClick={undoDelete}
            className="text-xs px-3 py-1 rounded bg-cyan-400 text-slate-900 font-semibold hover:bg-cyan-300"
          >
            Undo
          </button>
        </div>
      )}

      <section className="grid md:grid-cols-3 gap-4 flex-1 overflow-hidden">
        <div className="glass p-5 rounded-xl md:col-span-1 space-y-3 h-full flex flex-col">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Documents</h2>
            <label className="text-sm px-3 py-1 bg-cyan-400 text-slate-900 rounded cursor-pointer">
              Upload
              <input type="file" className="hidden" onChange={upload} />
            </label>
          </div>
          <p className="text-xs text-slate-400">PDF, DOCX, PPTX (max ~10MB placeholder)</p>
          <div className="space-y-2 overflow-y-auto flex-1">
            {docs.map((d) => (
              <div key={d._id} className="border border-slate-800 rounded p-3 bg-slate-900/50">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm text-white truncate">{d.originalName}</p>
                    <p className="text-xs text-slate-400">Status: {d.status}</p>
                  </div>
                  <button
                    onClick={() => removeDoc(d._id)}
                    className="text-xs px-2 py-1 rounded bg-red-500/80 text-white hover:bg-red-400"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {docs.length === 0 && <p className="text-slate-500 text-sm">No documents yet.</p>}
          </div>
          {uploadPct > 0 && (
            <div className="w-full h-2 bg-slate-800 rounded">
              <div
                className="h-2 bg-cyan-400 rounded transition-all"
                style={{ width: `${uploadPct}%` }}
              ></div>
            </div>
          )}
        </div>

        <div className="glass p-5 rounded-xl md:col-span-2 space-y-3 h-full flex flex-col overflow-hidden">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Chat</h2>
            {busy && <span className="text-xs text-cyan-300">Working…</span>}
            <button
              onClick={resetChat}
              className="text-xs px-3 py-1 rounded bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700"
            >
              Reset Chat
            </button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Scope:</label>
            <select
              className="px-3 py-2 rounded bg-slate-900 border border-slate-700 text-white text-sm"
              value={selectedDoc}
              onChange={(e) => setSelectedDoc(e.target.value)}
            >
              <option value="all">All documents</option>
              {docs.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.originalName}
                </option>
              ))}
            </select>
          </div>
          <div
            ref={messagesRef}
            className="border border-slate-800 rounded p-4 bg-slate-900/50 flex-1 overflow-y-auto space-y-2"
          >
            {chat.map((m, idx) => (
              <div key={idx} className="text-sm">
                <span className="font-semibold text-cyan-300">{m.role}: </span>
                <span className="text-slate-200">{m.content}</span>
              </div>
            ))}
            {chat.length === 0 && <p className="text-slate-500 text-sm">Ask something about your docs.</p>}
          </div>
          <form
            className="flex gap-2 pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              ask();
            }}
          >
            <input
              className="flex-1 px-4 py-3 rounded-lg bg-slate-900 border border-slate-700 text-white"
              placeholder="Ask a question…"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <button
              type="submit"
              className="px-4 py-3 rounded-lg bg-cyan-400 text-slate-900 font-semibold hover:bg-cyan-300 transition disabled:opacity-50"
              disabled={busy}
            >
              Send
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
