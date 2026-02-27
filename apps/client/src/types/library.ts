export const UNKNOWN_GENRE = "Genre Unknown";
export const UNKNOWN_YEAR = "Year Unknown";
export const UNRATED = "Rating Unrated";

export type LibraryBookSource = "scan" | "search";
export type LibraryViewMode = "list" | "grid";
export type LoanedFilter = "all" | "loaned" | "not_loaned";
export type LibrarySortMode =
  | "recent_desc"
  | "recent_asc"
  | "title_asc"
  | "title_desc"
  | "author_asc"
  | "author_desc"
  | "rating_desc"
  | "rating_asc"
  | "published_desc"
  | "published_asc";

export type LibraryBook = {
  id: string;
  title: string;
  author: string;
  publishedYear: number | null;
  publishedDate?: string | null;
  genres: string[];
  rating: number | null;
  review?: string | null;
  coverThumbnail: string | null;
  loaned: boolean;
  liked: boolean;
  reread: boolean;
  addedAt: string;
  source: LibraryBookSource;
  googleBooksId: string | null;
  pageCount?: number | null;
  synopsis?: string | null;
  infoLink?: string | null;
};

export type LibraryFilters = {
  genres: string[];
  yearMin: number | null;
  yearMax: number | null;
  includeUnknownYear: boolean;
  minRating: number | null;
  includeUnrated: boolean;
  loaned: LoanedFilter;
};

export type ProfileMetrics = {
  booksInLibrary: number;
  booksThisYear: number;
  activeLoans: number;
  shelves: number;
  friends: number;
  averageRating: number | null;
};

export type UserProfile = {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  badge: string;
  metrics: ProfileMetrics;
  favoriteBooks: LibraryBook[];
  recentReviews: LibraryBook[];
};

export type FriendStatus = "active" | "blocked";

export type LibraryFriend = {
  id: string;
  name: string;
  initials: string;
  email: string | null;
  avatarUrl: string | null;
  status: FriendStatus;
  friendUserId: string | null;
  createdAt: string;
};

export type LoanStatus = "active" | "returned";

export type LibraryLoan = {
  id: string;
  userBookId: string;
  friendId: string | null;
  borrowerName: string;
  borrowerContact: string | null;
  lentAt: string | null;
  dueAt: string | null;
  returnedAt: string | null;
  status: LoanStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  book: LibraryBook;
  friend: LibraryFriend | null;
};

export const DEFAULT_LIBRARY_FILTERS: LibraryFilters = {
  genres: [],
  yearMin: null,
  yearMax: null,
  includeUnknownYear: false,
  minRating: null,
  includeUnrated: false,
  loaned: "all"
};

export const DEFAULT_LIBRARY_SORT_MODE: LibrarySortMode = "recent_desc";
