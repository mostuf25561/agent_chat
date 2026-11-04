export const API_DOCS_PATH = "/api-docs";

const ROOM_PATH_PREFIX = "/rooms/";

export type Route =
  | { name: "home" }
  | { name: "api-docs" }
  | { name: "room"; address: string };

export function roomPath(address: string) {
  return `${ROOM_PATH_PREFIX}${encodeURIComponent(address)}`;
}

export function parseRoute(pathname: string): Route {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  if (normalized === API_DOCS_PATH) return { name: "api-docs" };

  if (normalized.startsWith(ROOM_PATH_PREFIX)) {
    const raw = normalized.slice(ROOM_PATH_PREFIX.length);
    try {
      const address = decodeURIComponent(raw);
      if (address) return { name: "room", address };
    } catch {
      return { name: "home" };
    }
  }

  return { name: "home" };
}
