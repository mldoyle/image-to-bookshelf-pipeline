import type { LibraryBook } from "../types/library";

const makeEndpointUrl = (baseUrl: string, path: string): string => {
  const trimmedBase = baseUrl.trim().replace(/\/+$/, "");
  const trimmedPath = path.startsWith("/") ? path : `/${path}`;
  return `${trimmedBase}${trimmedPath}`;
};

const withTimeout = async <T>(
  timeoutMs: number,
  fn: (signal: AbortSignal) => Promise<T>
): Promise<T> => {
  const controller = new AbortController();
  const handle = setTimeout(() => controller.abort(), Math.max(300, timeoutMs));
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(handle);
  }
};

type LibraryBooksResponse = {
  count: number;
  items: LibraryBook[];
};

const sanitizeBook = (raw: LibraryBook): LibraryBook => ({
  ...raw,
  genres: Array.isArray(raw.genres) ? raw.genres : [],
  rating:
    typeof raw.rating === "number" && Number.isFinite(raw.rating)
      ? raw.rating
      : null,
  review: typeof raw.review === "string" ? raw.review : null,
  loaned: Boolean(raw.loaned),
  googleBooksId: raw.googleBooksId || null,
  coverThumbnail: raw.coverThumbnail || null,
  publishedYear:
    typeof raw.publishedYear === "number" && Number.isFinite(raw.publishedYear)
      ? raw.publishedYear
      : null,
  addedAt: raw.addedAt || new Date().toISOString(),
  source: raw.source || "scan"
});

const parseBooksResponse = (payload: LibraryBooksResponse): LibraryBook[] =>
  Array.isArray(payload.items) ? payload.items.map(sanitizeBook) : [];

export const fetchLibraryBooks = async (
  apiBaseUrl: string,
  timeoutMs = 10000
): Promise<LibraryBook[]> =>
  withTimeout(timeoutMs, async (signal) => {
    const response = await fetch(makeEndpointUrl(apiBaseUrl, "/library/me/books"), {
      method: "GET",
      signal
    });

    if (!response.ok) {
      throw new Error(`library_fetch_http_${response.status}`);
    }

    const payload = (await response.json()) as LibraryBooksResponse;
    return parseBooksResponse(payload);
  });

export const batchUpsertLibraryBooks = async (
  apiBaseUrl: string,
  items: LibraryBook[],
  timeoutMs = 10000
): Promise<LibraryBook[]> => {
  if (items.length === 0) {
    return [];
  }

  return withTimeout(timeoutMs, async (signal) => {
    const response = await fetch(makeEndpointUrl(apiBaseUrl, "/library/me/books/batch"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ items }),
      signal
    });

    if (!response.ok) {
      throw new Error(`library_batch_http_${response.status}`);
    }

    const payload = (await response.json()) as LibraryBooksResponse;
    return parseBooksResponse(payload);
  });
};

export const patchLibraryBook = async (
  apiBaseUrl: string,
  bookId: string,
  patch: Partial<Pick<LibraryBook, "loaned" | "rating" | "review">>,
  timeoutMs = 10000
): Promise<LibraryBook> =>
  withTimeout(timeoutMs, async (signal) => {
    const response = await fetch(
      makeEndpointUrl(apiBaseUrl, `/library/me/books/${encodeURIComponent(bookId)}`),
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(patch),
        signal
      }
    );

    if (!response.ok) {
      throw new Error(`library_patch_http_${response.status}`);
    }

    const payload = (await response.json()) as { item: LibraryBook };
    return sanitizeBook(payload.item);
  });
