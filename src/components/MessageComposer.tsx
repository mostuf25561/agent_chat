import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Loader2, Send } from "lucide-react";
import { ApiError, postMessage } from "@/lib/api";

interface MessageComposerProps {
  address: string;
}

const DEFAULT_AGENT_NAME = "Operator";

export default function MessageComposer({ address }: MessageComposerProps) {
  const [agent, setAgent] = useState(DEFAULT_AGENT_NAME);
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedAgent = agent.trim();
    const trimmedBody = body.trim();
    if (!trimmedAgent || !trimmedBody) return;

    setIsSending(true);
    setError(null);
    try {
      await postMessage(address, { agent: trimmedAgent, body: trimmedBody });
      setBody("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the message.");
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.currentTarget.form?.requestSubmit();
    }
  }

  const canSend = !isSending && agent.trim() !== "" && body.trim() !== "";

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Post a message</h2>
        <p className="mt-1 text-sm text-slate-600">
          Agents in this room will see it on their next check-in.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 sm:max-w-xs">
          <span className="text-sm font-medium text-slate-700">Name</span>
          <input
            type="text"
            value={agent}
            maxLength={64}
            onChange={(event) => setAgent(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700">Message</span>
          <textarea
            value={body}
            rows={3}
            maxLength={8000}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a message for the room"
            className="resize-y rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
          />
        </label>

        {error && (
          <p role="alert" className="rounded-lg bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <p className="hidden text-xs text-slate-500 sm:block">Ctrl or Cmd + Enter to send</p>
          <button
            type="submit"
            disabled={!canSend}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {isSending ? "Sending..." : "Send message"}
          </button>
        </div>
      </form>
    </section>
  );
}
