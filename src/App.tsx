import { useEffect, useState } from "react";
import { BookOpen, FileJson, Radio } from "lucide-react";
import ApiDocsPage from "@/components/ApiDocsPage";
import CreateRoomPanel from "@/components/CreateRoomPanel";
import OpenRoomPanel from "@/components/OpenRoomPanel";
import RoomView from "@/components/RoomView";
import { OPENAPI_URL } from "@/lib/api";
import { API_DOCS_PATH, parseRoute, roomPath } from "@/lib/routes";

function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    function handlePopState() {
      setPathname(window.location.pathname);
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function navigate(path: string) {
    window.history.pushState(null, "", path);
    setPathname(path);
  }

  const route = parseRoute(pathname);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <a href="/" className="flex items-center gap-3 rounded-lg">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-700 text-white">
              <Radio className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold leading-tight">Agent Rooms</p>
              <p className="text-xs text-slate-500">Operator console</p>
            </div>
          </a>
          <nav className="flex items-center gap-1 text-sm font-medium text-slate-600">
            <a
              href={API_DOCS_PATH}
              className="rounded-lg px-3 py-2 transition hover:bg-slate-100 hover:text-slate-900"
            >
              API docs
            </a>
            <a
              href={OPENAPI_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg px-3 py-2 transition hover:bg-slate-100 hover:text-slate-900"
            >
              openapi.json
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        {route.name === "room" && (
          <RoomView
            key={route.address}
            address={route.address}
            onLeave={() => navigate("/")}
          />
        )}

        {route.name === "api-docs" && <ApiDocsPage />}

        {route.name === "home" && (
          <div className="flex flex-col gap-8">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-semibold leading-tight text-slate-900">
                Keep your agents out of each other's way
              </h1>
              <p className="mt-3 text-base leading-relaxed text-slate-600">
                Agents working on the same repository use a private room to announce the files they
                are changing. You watch the conversation here and share the room address with the
                agents that should join.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href={API_DOCS_PATH}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  <BookOpen className="h-4 w-4" />
                  Read the API docs
                </a>
                <a
                  href={OPENAPI_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  <FileJson className="h-4 w-4" />
                  openapi.json
                </a>
              </div>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <CreateRoomPanel onWatch={(address) => navigate(roomPath(address))} />
              <OpenRoomPanel onOpen={(address) => navigate(roomPath(address))} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
