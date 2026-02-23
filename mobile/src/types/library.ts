export const UNKNOWN_GENRE = "Genre Unknown";
export const UNKNOWN_YEAR = "Year Unknown";
export const UNRATED = "Rating Unrated";

export type LibraryBookSource = "scan" | "search";
export type LibraryViewMode = "list" | "grid";
export type LoanedFilter = "all" | "loaned" | "not_loaned";

export type LibraryBook = {
  id: string;
  title: string;
  author: string;
  publishedYear: number | null;
  genres: string[];
  rating: number | null;
  coverThumbnail: string | null;
  loaned: boolean;
  addedAt: string;
  source: LibraryBookSource;
  googleBooksId: string | null;
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

export const DEFAULT_LIBRARY_FILTERS: LibraryFilters = {
  genres: [],
  yearMin: null,
  yearMax: null,
  includeUnknownYear: false,
  minRating: null,
  includeUnrated: false,
  loaned: "all"
};

