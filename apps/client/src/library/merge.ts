import type { FeedItem, LookupBookItem } from "../types/vision";
import type { LibraryBook, LibraryBookSource } from "../types/library";

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const asNumberOrNull = (value: number | undefined): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const asIntegerOrNull = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }
  return null;
};

export const parsePublishedYear = (publishedDate: string | undefined): number | null => {
  if (!publishedDate) {
    return null;
  }

  const match = publishedDate.match(/\b(\d{4})\b/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  if (!Number.isFinite(year)) {
    return null;
  }

  if (year < 0 || year > 3000) {
    return null;
  }

  return year;
};

const createBookId = (): string =>
  `book-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const sanitizeGenres = (categories: string[] | undefined): string[] => {
  if (!categories || categories.length === 0) {
    return [];
  }

  return categories
    .map((genre) => genre.trim())
    .filter((genre) => genre.length > 0);
};

const toAuthorLine = (authors: string[] | undefined, fallback: string): string => {
  const names = (authors ?? []).map((author) => author.trim()).filter(Boolean);
  if (names.length > 0) {
    return names.join(", ");
  }
  return fallback.trim() || "Unknown author";
};

const withBookDefaults = (book: LibraryBook): LibraryBook => ({
  ...book,
  liked: Boolean(book.liked),
  reread: Boolean(book.reread),
  publishedDate: book.publishedDate || null,
  pageCount: typeof book.pageCount === "number" && Number.isFinite(book.pageCount) ? Math.round(book.pageCount) : null,
  synopsis: typeof book.synopsis === "string" ? book.synopsis : null,
  infoLink: typeof book.infoLink === "string" ? book.infoLink : null,
});

export const toLibraryBookFromLookupItem = (
  lookupItem: LookupBookItem,
  source: LibraryBookSource,
  fallback?: Pick<LibraryBook, "title" | "author">
): LibraryBook =>
  withBookDefaults({
    id: createBookId(),
    title: lookupItem.title?.trim() || fallback?.title || "Untitled",
    author: toAuthorLine(lookupItem.authors, fallback?.author || "Unknown author"),
    publishedYear: parsePublishedYear(lookupItem.publishedDate),
    publishedDate: lookupItem.publishedDate || null,
    genres: sanitizeGenres(lookupItem.categories),
    rating: asNumberOrNull(lookupItem.averageRating),
    review: null,
    coverThumbnail: lookupItem.imageLinks?.thumbnail || lookupItem.imageLinks?.smallThumbnail || null,
    loaned: false,
    liked: false,
    reread: false,
    addedAt: new Date().toISOString(),
    source,
    googleBooksId: lookupItem.id?.trim() || null,
    pageCount: asIntegerOrNull((lookupItem as { pageCount?: number }).pageCount),
    synopsis: lookupItem.descriptionSnippet || null,
    infoLink: lookupItem.infoLink || null,
  });

export const toLibraryBookFromFeedItem = (item: FeedItem): LibraryBook => {
  const metadata = item.metadata;
  if (metadata) {
    return toLibraryBookFromLookupItem(metadata, "scan", {
      title: item.title,
      author: item.author,
    });
  }

  return withBookDefaults({
    id: createBookId(),
    title: item.title.trim() || "Untitled",
    author: item.author.trim() || "Unknown author",
    publishedYear: null,
    publishedDate: null,
    genres: [],
    rating: null,
    review: null,
    coverThumbnail: null,
    loaned: false,
    liked: false,
    reread: false,
    addedAt: new Date().toISOString(),
    source: "scan",
    googleBooksId: null,
    pageCount: null,
    synopsis: null,
    infoLink: null,
  });
};

const dedupeKey = (book: Pick<LibraryBook, "googleBooksId" | "title" | "author" | "publishedYear">): string => {
  if (book.googleBooksId) {
    return `gid:${book.googleBooksId.trim().toLowerCase()}`;
  }
  return `n:${normalizeText(book.title)}|${normalizeText(book.author)}|${book.publishedYear ?? "unknown"}`;
};

const choosePreferredBook = (existing: LibraryBook, incoming: LibraryBook): LibraryBook => {
  const existingScore =
    (existing.coverThumbnail ? 1 : 0) +
    (existing.genres.length > 0 ? 1 : 0) +
    (existing.rating !== null ? 1 : 0) +
    (existing.synopsis ? 1 : 0);
  const incomingScore =
    (incoming.coverThumbnail ? 1 : 0) +
    (incoming.genres.length > 0 ? 1 : 0) +
    (incoming.rating !== null ? 1 : 0) +
    (incoming.synopsis ? 1 : 0);

  const preferred = incomingScore > existingScore ? incoming : existing;
  const preservedAddedAt =
    new Date(existing.addedAt) <= new Date(incoming.addedAt) ? existing.addedAt : incoming.addedAt;
  const shouldAdoptIncomingId = existing.id.startsWith("book-") && !incoming.id.startsWith("book-");

  return withBookDefaults({
    ...preferred,
    id: shouldAdoptIncomingId ? incoming.id : existing.id,
    addedAt: preservedAddedAt,
    loaned: existing.loaned || incoming.loaned,
    liked: existing.liked || incoming.liked,
    reread: existing.reread || incoming.reread,
    review: preferred.review ?? existing.review ?? null,
  });
};

export const mergeLibraryBooks = (
  existingBooks: LibraryBook[],
  incomingBooks: LibraryBook[]
): LibraryBook[] => {
  const byId = new Map<string, LibraryBook>();
  [...existingBooks, ...incomingBooks].forEach((book) => {
    const normalizedId = book.id.trim() || createBookId();
    const normalizedBook = withBookDefaults(normalizedId === book.id ? book : { ...book, id: normalizedId });
    const existing = byId.get(normalizedId);
    if (!existing) {
      byId.set(normalizedId, normalizedBook);
      return;
    }
    byId.set(normalizedId, choosePreferredBook(existing, normalizedBook));
  });

  const byKey = new Map<string, LibraryBook>();

  Array.from(byId.values()).forEach((book) => {
    const key = dedupeKey(book);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, book);
      return;
    }
    byKey.set(key, choosePreferredBook(existing, book));
  });

  return Array.from(byKey.values()).sort(
    (left, right) => new Date(right.addedAt).getTime() - new Date(left.addedAt).getTime()
  );
};
