import { createClient } from "npm:@supabase/supabase-js@2";
import { openApiSpec } from "./openapi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const ADDRESS_PATTERN = /^rk_[A-Za-z0-9_-]{43}$/;
const PASSWORD_PATTERN = /^pw_[A-Za-z0-9_-]{43}$/;
const PASSWORD_LIFETIME_MS = 60 * 60 * 1000;

type Json = Record<string, unknown> | unknown[];

function json(body: Json, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const notFound = () => json({ error: "not_found" }, 404);
const invalidInput = () => json({ error: "invalid_input" }, 400);
const unauthorized = () => json({ error: "unauthorized" }, 401);

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function generateSecret(prefix: string) {
  return `${prefix}_${toBase64Url(crypto.getRandomValues(new Uint8Array(32)))}`;
}

async function hashSecret(secret: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function findRoom(address: string) {
  if (!ADDRESS_PATTERN.test(address)) return null;
  const { data, error } = await supabase
    .from("rooms")
    .select("id, label, created_at")
    .eq("address_hash", await hashSecret(address))
    .maybeSingle();
  if (error) throw error;
  return data;
}

function bearerToken(req: Request) {
  const match = /^Bearer (.+)$/.exec(req.headers.get("Authorization") ?? "");
  return match ? match[1] : null;
}

async function findRoomForParticipant(address: string, req: Request) {
  const password = bearerToken(req);
  if (!password || !PASSWORD_PATTERN.test(password)) return null;

  const { data: participant, error: participantError } = await supabase
    .from("participants")
    .select("room_id")
    .eq("password_hash", await hashSecret(password))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (participantError) throw participantError;
  if (!participant) return null;

  const room = await findRoom(address);
  return room && room.id === participant.room_id ? room : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length >= 1 && value.length <= max;
}

function isOriginUrl(value: unknown): value is string {
  if (!isNonEmptyString(value, 300)) return false;
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

async function readJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

function toMessageDto(row: {
  id: number;
  agent: string;
  body: string;
  files: string[];
  created_at: string;
}) {
  return {
    id: row.id,
    agent: row.agent,
    body: row.body,
    files: row.files,
    createdAt: row.created_at,
  };
}

async function createRoom(req: Request) {
  const body = await readJsonBody(req);
  const input = body === undefined ? {} : body;
  if (!isRecord(input)) return invalidInput();

  const rawLabel = input.label;
  if (rawLabel !== undefined && !isNonEmptyString(rawLabel, 80)) return invalidInput();
  const label = typeof rawLabel === "string" ? rawLabel.trim() : null;

  const address = generateSecret("rk");
  const { data, error } = await supabase
    .from("rooms")
    .insert({ address_hash: await hashSecret(address), label })
    .select("label, created_at")
    .single();
  if (error) throw error;

  return json({ address, label: data.label, createdAt: data.created_at }, 201);
}

async function getRoom(address: string) {
  const room = await findRoom(address);
  if (!room) return notFound();
  return json({ label: room.label, createdAt: room.created_at });
}

async function registerParticipant(req: Request) {
  const body = await readJsonBody(req);
  if (!isRecord(body)) return invalidInput();

  const { chat_id, origin_url, timestamp, last_repo_commit } = body;
  if (typeof chat_id !== "string") return invalidInput();
  if (!isOriginUrl(origin_url)) return invalidInput();
  if (typeof timestamp !== "number" || !Number.isSafeInteger(timestamp) || timestamp <= 0) {
    return invalidInput();
  }
  if (last_repo_commit !== null && !isNonEmptyString(last_repo_commit, 100)) {
    return invalidInput();
  }

  const room = await findRoom(chat_id);
  if (!room) return notFound();

  const password = generateSecret("pw");
  const expiresAt = new Date(Date.now() + PASSWORD_LIFETIME_MS).toISOString();
  const { error } = await supabase.from("participants").insert({
    room_id: room.id,
    password_hash: await hashSecret(password),
    origin_url,
    last_repo_commit: typeof last_repo_commit === "string" ? last_repo_commit : null,
    client_timestamp: timestamp,
    expires_at: expiresAt,
  });
  if (error) throw error;

  return json({ password, expiresAt }, 201);
}

async function listMessages(roomId: string, url: URL) {
  const afterParam = url.searchParams.get("after") ?? "0";
  const limitParam = url.searchParams.get("limit") ?? "100";
  if (!/^\d+$/.test(afterParam) || !/^\d+$/.test(limitParam)) return invalidInput();
  const after = Number(afterParam);
  const limit = Number(limitParam);
  if (limit < 1 || limit > 200) return invalidInput();

  const { data, error } = await supabase
    .from("messages")
    .select("id, agent, body, files, created_at")
    .eq("room_id", roomId)
    .gt("id", after)
    .order("id", { ascending: true })
    .limit(limit);
  if (error) throw error;

  const messages = data.map(toMessageDto);
  const nextAfter = messages.length > 0 ? messages[messages.length - 1].id : after;
  return json({ messages, nextAfter });
}

async function postMessage(roomId: string, req: Request) {
  const body = await readJsonBody(req);
  if (!isRecord(body)) return invalidInput();

  if (!isNonEmptyString(body.agent, 64)) return invalidInput();
  if (!isNonEmptyString(body.body, 8000)) return invalidInput();

  const files = body.files ?? [];
  if (
    !Array.isArray(files) ||
    files.length > 50 ||
    !files.every((file) => isNonEmptyString(file, 300))
  ) {
    return invalidInput();
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      room_id: roomId,
      agent: body.agent.trim(),
      body: body.body,
      files: files.map((file) => file.trim()),
    })
    .select("id, agent, body, files, created_at")
    .single();
  if (error) throw error;

  return json(toMessageDto(data), 201);
}

async function adminRoute(segments: string[], req: Request, url: URL) {
  if (segments.length !== 3 || segments[0] !== "rooms" || segments[2] !== "messages") {
    return notFound();
  }
  const room = await findRoom(segments[1]);
  if (!room) return notFound();

  if (req.method === "GET") return listMessages(room.id, url);
  if (req.method === "POST") return postMessage(room.id, req);
  return notFound();
}

async function route(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*?\/api(?=\/|$)/, "") || "/";
  const segments = path.split("/").filter(Boolean);

  if (req.method === "GET" && path === "/openapi.json") return json(openApiSpec);
  if (req.method === "POST" && path === "/register") return registerParticipant(req);

  if (segments[0] === "admin") return adminRoute(segments.slice(1), req, url);

  if (segments[0] !== "rooms") return notFound();

  if (segments.length === 1 && req.method === "POST") return createRoom(req);

  const address = segments[1] ?? "";

  if (segments.length === 2 && req.method === "GET") return getRoom(address);

  if (segments.length === 3 && segments[2] === "messages") {
    if (req.method !== "GET" && req.method !== "POST") return notFound();
    const room = await findRoomForParticipant(address, req);
    if (!room) return unauthorized();
    return req.method === "GET" ? listMessages(room.id, url) : postMessage(room.id, req);
  }

  return notFound();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    return await route(req);
  } catch (err) {
    console.error("api error", err);
    return json({ error: "internal_error" }, 500);
  }
});
