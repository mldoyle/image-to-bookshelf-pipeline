import {
  DEFAULT_LIBRARY_FILTERS,
  type LibraryBook,
  type LibraryFilters,
  type LibraryViewMode
} from "../types/library";

declare const require: undefined | ((id: string) => unknown);

const BOOKS_KEY = "bookshelf.library.v1.books";
const VIEW_MODE_KEY = "bookshelf.library.v1.viewMode";
const FILTERS_KEY = "bookshelf.library.v1.filters";

type AsyncStorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

const memoryStorage = (() => {
  const data = new Map<string, string>();
  return {
    async getItem(key: string): Promise<string | null> {
      return data.has(key) ? data.get(key) ?? null : null;
    },
    async setItem(key: string, value: string): Promise<void> {
      data.set(key, value);
    }
  } satisfies AsyncStorageLike;
})();

const resolveStorage = (): AsyncStorageLike => {
  const maybeRequire = typeof require === "function" ? require : undefined;
  if (typeof maybeRequire === "function") {
    try {
      const loaded = maybeRequire("@react-native-async-storage/async-storage") as {
        default?: AsyncStorageLike;
      };
      if (loaded?.default) {
        return loaded.default;
      }
    } catch {
      // Fallback for local/dev environments where AsyncStorage is not installed.
    }
  }

  return memoryStorage;
};

const asyncStorage = resolveStorage();

const parseJson = <T>(raw: string | null): T | null => {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const libraryStorageKeys = {
  books: BOOKS_KEY,
  viewMode: VIEW_MODE_KEY,
  filters: FILTERS_KEY
} as const;

export const loadLibraryBooks = async (): Promise<LibraryBook[]> => {
  const raw = await asyncStorage.getItem(BOOKS_KEY);
  const parsed = parseJson<LibraryBook[]>(raw);
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.map((book) => ({
    ...book,
    genres: Array.isArray(book.genres) ? book.genres : [],
    rating:
      typeof book.rating === "number" && Number.isFinite(book.rating) ? book.rating : null,
    review: typeof book.review === "string" ? book.review : null,
    loaned: Boolean(book.loaned),
    coverThumbnail: book.coverThumbnail || null,
    googleBooksId: book.googleBooksId || null,
    publishedYear:
      typeof book.publishedYear === "number" && Number.isFinite(book.publishedYear)
        ? book.publishedYear
        : null,
    addedAt: book.addedAt || new Date().toISOString(),
    source: book.source === "search" ? "search" : "scan"
  }));
};

export const saveLibraryBooks = async (books: LibraryBook[]): Promise<void> => {
  await asyncStorage.setItem(BOOKS_KEY, JSON.stringify(books));
};

export const loadLibraryViewMode = async (): Promise<LibraryViewMode> => {
  const raw = await asyncStorage.getItem(VIEW_MODE_KEY);
  return raw === "grid" ? "grid" : "list";
};

export const saveLibraryViewMode = async (viewMode: LibraryViewMode): Promise<void> => {
  await asyncStorage.setItem(VIEW_MODE_KEY, viewMode);
};

const asNumberOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export const loadLibraryFilters = async (): Promise<LibraryFilters> => {
  const raw = await asyncStorage.getItem(FILTERS_KEY);
  const parsed = parseJson<Partial<LibraryFilters>>(raw);
  if (!parsed) {
    return DEFAULT_LIBRARY_FILTERS;
  }

  return {
    genres: Array.isArray(parsed.genres)
      ? parsed.genres.filter((genre): genre is string => typeof genre === "string")
      : [],
    yearMin: asNumberOrNull(parsed.yearMin),
    yearMax: asNumberOrNull(parsed.yearMax),
    includeUnknownYear: Boolean(parsed.includeUnknownYear),
    minRating: asNumberOrNull(parsed.minRating),
    includeUnrated: Boolean(parsed.includeUnrated),
    loaned:
      parsed.loaned === "loaned" || parsed.loaned === "not_loaned"
        ? parsed.loaned
        : "all"
  };
};

export const saveLibraryFilters = async (filters: LibraryFilters): Promise<void> => {
  await asyncStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
};
