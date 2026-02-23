import type { LookupBookItem } from "../types/vision";

const makeEndpointUrl = (baseUrl: string, path: string): string => {
  const trimmedBase = baseUrl.trim().replace(/\/+$/, "");
  const trimmedPath = path.startsWith("/") ? path : `/${path}`;
  return `${trimmedBase}${trimmedPath}`;
};

export type SearchBooksRequest = {
  apiBaseUrl: string;
  query: string;
  maxResults?: number;
  timeoutMs?: number;
};

export type SearchBooksResponse = {
  totalItems: number;
  items: LookupBookItem[];
};

export const searchBooks = async (
  request: SearchBooksRequest
): Promise<SearchBooksResponse> => {
  const query = request.query.trim();
  if (!query) {
    return { totalItems: 0, items: [] };
  }

  const params = new URLSearchParams({
    q: query,
    maxResults: String(Math.max(1, Math.round(request.maxResults ?? 20)))
  });

  const controller = new AbortController();
  const timeoutHandle = setTimeout(
    () => controller.abort(),
    Math.max(300, request.timeoutMs ?? 15000)
  );

  try {
    const response = await fetch(
      `${makeEndpointUrl(request.apiBaseUrl, "/books/search")}?${params.toString()}`,
      {
        method: "GET",
        signal: controller.signal
      }
    );

    if (!response.ok) {
      throw new Error(`books_search_http_${response.status}`);
    }

    const payload = (await response.json()) as SearchBooksResponse;
    return {
      totalItems: Number(payload.totalItems) || 0,
      items: Array.isArray(payload.items) ? payload.items : []
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
};

