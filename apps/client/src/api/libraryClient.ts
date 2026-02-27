import type {
  LibraryBook,
  LibraryFriend,
  LibraryLoan,
  LoanStatus,
  UserProfile,
} from "../types/library";

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

type ListResponse<T> = {
  count: number;
  items: T[];
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
  liked: Boolean(raw.liked),
  reread: Boolean(raw.reread),
  googleBooksId: raw.googleBooksId || null,
  coverThumbnail: raw.coverThumbnail || null,
  publishedYear:
    typeof raw.publishedYear === "number" && Number.isFinite(raw.publishedYear)
      ? raw.publishedYear
      : null,
  publishedDate: raw.publishedDate || null,
  pageCount:
    typeof raw.pageCount === "number" && Number.isFinite(raw.pageCount)
      ? Math.round(raw.pageCount)
      : null,
  synopsis: typeof raw.synopsis === "string" ? raw.synopsis : null,
  infoLink: typeof raw.infoLink === "string" ? raw.infoLink : null,
  addedAt: raw.addedAt || new Date().toISOString(),
  source: raw.source || "scan",
});

const sanitizeFriend = (raw: LibraryFriend): LibraryFriend => ({
  ...raw,
  name: (raw.name || "Friend").trim() || "Friend",
  initials: (raw.initials || "?").trim() || "?",
  email: raw.email || null,
  avatarUrl: raw.avatarUrl || null,
  status: raw.status === "blocked" ? "blocked" : "active",
  friendUserId: raw.friendUserId || null,
  createdAt: raw.createdAt || new Date().toISOString(),
});

const sanitizeLoanStatus = (value: string | null | undefined): LoanStatus =>
  value === "returned" ? "returned" : "active";

const sanitizeLoan = (raw: LibraryLoan): LibraryLoan => ({
  ...raw,
  friendId: raw.friendId || null,
  borrowerName: (raw.borrowerName || "Friend").trim() || "Friend",
  borrowerContact: raw.borrowerContact || null,
  lentAt: raw.lentAt || null,
  dueAt: raw.dueAt || null,
  returnedAt: raw.returnedAt || null,
  status: sanitizeLoanStatus(raw.status),
  note: raw.note || null,
  createdAt: raw.createdAt || new Date().toISOString(),
  updatedAt: raw.updatedAt || new Date().toISOString(),
  book: sanitizeBook(raw.book),
  friend: raw.friend ? sanitizeFriend(raw.friend) : null,
});

const sanitizeProfile = (raw: UserProfile): UserProfile => ({
  ...raw,
  displayName: raw.displayName || null,
  avatarUrl: raw.avatarUrl || null,
  bio: raw.bio || null,
  location: raw.location || null,
  website: raw.website || null,
  badge: (raw.badge || "PATRON").trim() || "PATRON",
  metrics: {
    booksInLibrary: Number(raw.metrics?.booksInLibrary) || 0,
    booksThisYear: Number(raw.metrics?.booksThisYear) || 0,
    activeLoans: Number(raw.metrics?.activeLoans) || 0,
    shelves: Number(raw.metrics?.shelves) || 0,
    friends: Number(raw.metrics?.friends) || 0,
    averageRating:
      typeof raw.metrics?.averageRating === "number" && Number.isFinite(raw.metrics.averageRating)
        ? raw.metrics.averageRating
        : null,
  },
  favoriteBooks: Array.isArray(raw.favoriteBooks)
    ? raw.favoriteBooks.map(sanitizeBook)
    : [],
  recentReviews: Array.isArray(raw.recentReviews)
    ? raw.recentReviews.map(sanitizeBook)
    : [],
});

const parseList = <T>(payload: ListResponse<T>): T[] =>
  Array.isArray(payload.items) ? payload.items : [];

export const fetchLibraryBooks = async (
  apiBaseUrl: string,
  timeoutMs = 10000
): Promise<LibraryBook[]> =>
  withTimeout(timeoutMs, async (signal) => {
    const response = await fetch(makeEndpointUrl(apiBaseUrl, "/library/me/books"), {
      method: "GET",
      signal,
    });

    if (!response.ok) {
      throw new Error(`library_fetch_http_${response.status}`);
    }

    const payload = (await response.json()) as ListResponse<LibraryBook>;
    return parseList(payload).map(sanitizeBook);
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
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ items }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`library_batch_http_${response.status}`);
    }

    const payload = (await response.json()) as ListResponse<LibraryBook>;
    return parseList(payload).map(sanitizeBook);
  });
};

export const patchLibraryBook = async (
  apiBaseUrl: string,
  bookId: string,
  patch: Partial<
    Pick<LibraryBook, "loaned" | "rating" | "review" | "liked" | "reread" | "synopsis" | "pageCount">
  >,
  timeoutMs = 10000
): Promise<LibraryBook> =>
  withTimeout(timeoutMs, async (signal) => {
    const response = await fetch(
      makeEndpointUrl(apiBaseUrl, `/library/me/books/${encodeURIComponent(bookId)}`),
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(patch),
        signal,
      }
    );

    if (!response.ok) {
      throw new Error(`library_patch_http_${response.status}`);
    }

    const payload = (await response.json()) as { item: LibraryBook };
    return sanitizeBook(payload.item);
  });

export const fetchProfile = async (
  apiBaseUrl: string,
  timeoutMs = 10000
): Promise<UserProfile> =>
  withTimeout(timeoutMs, async (signal) => {
    const response = await fetch(makeEndpointUrl(apiBaseUrl, "/library/me/profile"), {
      method: "GET",
      signal,
    });

    if (!response.ok) {
      throw new Error(`library_profile_fetch_http_${response.status}`);
    }

    const payload = (await response.json()) as { profile: UserProfile };
    return sanitizeProfile(payload.profile);
  });

export const patchProfile = async (
  apiBaseUrl: string,
  patch: Partial<Pick<UserProfile, "displayName" | "bio" | "location" | "website" | "badge" | "avatarUrl">>,
  timeoutMs = 10000
): Promise<UserProfile> =>
  withTimeout(timeoutMs, async (signal) => {
    const response = await fetch(makeEndpointUrl(apiBaseUrl, "/library/me/profile"), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patch),
      signal,
    });

    if (!response.ok) {
      throw new Error(`library_profile_patch_http_${response.status}`);
    }

    const payload = (await response.json()) as { profile: UserProfile };
    return sanitizeProfile(payload.profile);
  });

export const fetchFriends = async (
  apiBaseUrl: string,
  timeoutMs = 10000
): Promise<LibraryFriend[]> =>
  withTimeout(timeoutMs, async (signal) => {
    const response = await fetch(makeEndpointUrl(apiBaseUrl, "/library/me/friends"), {
      method: "GET",
      signal,
    });

    if (!response.ok) {
      throw new Error(`library_friends_fetch_http_${response.status}`);
    }

    const payload = (await response.json()) as ListResponse<LibraryFriend>;
    return parseList(payload).map(sanitizeFriend);
  });

export const upsertFriend = async (
  apiBaseUrl: string,
  friend: Pick<LibraryFriend, "name" | "email">,
  timeoutMs = 10000
): Promise<LibraryFriend> =>
  withTimeout(timeoutMs, async (signal) => {
    const response = await fetch(makeEndpointUrl(apiBaseUrl, "/library/me/friends"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(friend),
      signal,
    });

    if (!response.ok) {
      throw new Error(`library_friends_upsert_http_${response.status}`);
    }

    const payload = (await response.json()) as { item: LibraryFriend };
    return sanitizeFriend(payload.item);
  });

export const patchFriend = async (
  apiBaseUrl: string,
  friendId: string,
  patch: Partial<Pick<LibraryFriend, "name" | "email" | "status" | "avatarUrl">>,
  timeoutMs = 10000
): Promise<LibraryFriend> =>
  withTimeout(timeoutMs, async (signal) => {
    const response = await fetch(
      makeEndpointUrl(apiBaseUrl, `/library/me/friends/${encodeURIComponent(friendId)}`),
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(patch),
        signal,
      }
    );

    if (!response.ok) {
      throw new Error(`library_friends_patch_http_${response.status}`);
    }

    const payload = (await response.json()) as { item: LibraryFriend };
    return sanitizeFriend(payload.item);
  });

export const deleteFriend = async (
  apiBaseUrl: string,
  friendId: string,
  timeoutMs = 10000
): Promise<void> => {
  await withTimeout(timeoutMs, async (signal) => {
    const response = await fetch(
      makeEndpointUrl(apiBaseUrl, `/library/me/friends/${encodeURIComponent(friendId)}`),
      {
        method: "DELETE",
        signal,
      }
    );

    if (!response.ok) {
      throw new Error(`library_friends_delete_http_${response.status}`);
    }
  });
};

type LoanPayload = {
  userBookId: string;
  friendId?: string | null;
  borrowerName?: string | null;
  borrowerContact?: string | null;
  dueDate?: string | null;
  dueAt?: string | null;
  status?: LoanStatus;
  note?: string | null;
};

export const fetchLoans = async (
  apiBaseUrl: string,
  options?: { status?: LoanStatus; timeoutMs?: number }
): Promise<LibraryLoan[]> => {
  const timeoutMs = options?.timeoutMs ?? 10000;
  const query = options?.status ? `?status=${encodeURIComponent(options.status)}` : "";

  return withTimeout(timeoutMs, async (signal) => {
    const response = await fetch(makeEndpointUrl(apiBaseUrl, `/library/me/loans${query}`), {
      method: "GET",
      signal,
    });

    if (!response.ok) {
      throw new Error(`library_loans_fetch_http_${response.status}`);
    }

    const payload = (await response.json()) as ListResponse<LibraryLoan>;
    return parseList(payload).map(sanitizeLoan);
  });
};

export const createLoan = async (
  apiBaseUrl: string,
  loan: LoanPayload,
  timeoutMs = 10000
): Promise<LibraryLoan> =>
  withTimeout(timeoutMs, async (signal) => {
    const response = await fetch(makeEndpointUrl(apiBaseUrl, "/library/me/loans"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(loan),
      signal,
    });

    if (!response.ok) {
      throw new Error(`library_loans_create_http_${response.status}`);
    }

    const payload = (await response.json()) as { item: LibraryLoan };
    return sanitizeLoan(payload.item);
  });

export const patchLoan = async (
  apiBaseUrl: string,
  loanId: string,
  patch: Partial<LoanPayload>,
  timeoutMs = 10000
): Promise<LibraryLoan> =>
  withTimeout(timeoutMs, async (signal) => {
    const response = await fetch(
      makeEndpointUrl(apiBaseUrl, `/library/me/loans/${encodeURIComponent(loanId)}`),
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(patch),
        signal,
      }
    );

    if (!response.ok) {
      throw new Error(`library_loans_patch_http_${response.status}`);
    }

    const payload = (await response.json()) as { item: LibraryLoan };
    return sanitizeLoan(payload.item);
  });

export const deleteLoan = async (
  apiBaseUrl: string,
  loanId: string,
  timeoutMs = 10000
): Promise<void> => {
  await withTimeout(timeoutMs, async (signal) => {
    const response = await fetch(
      makeEndpointUrl(apiBaseUrl, `/library/me/loans/${encodeURIComponent(loanId)}`),
      {
        method: "DELETE",
        signal,
      }
    );

    if (!response.ok) {
      throw new Error(`library_loans_delete_http_${response.status}`);
    }
  });
};
