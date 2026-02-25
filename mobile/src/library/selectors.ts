import {
  DEFAULT_LIBRARY_SORT_MODE,
  DEFAULT_LIBRARY_FILTERS,
  UNKNOWN_GENRE,
  UNKNOWN_YEAR,
  UNRATED,
  type LibraryBook,
  type LibraryFilters,
  type LibrarySortMode
} from "../types/library";

const sortByRecentlyAdded = (books: LibraryBook[], sortMode: LibrarySortMode): LibraryBook[] =>
  [...books].sort((left, right) => {
    const delta = new Date(right.addedAt).getTime() - new Date(left.addedAt).getTime();
    return sortMode === "recent_asc" ? -delta : delta;
  });

export type LibraryFilterOptions = {
  genres: string[];
  years: string[];
  ratings: string[];
};

export const deriveLibraryFilterOptions = (books: LibraryBook[]): LibraryFilterOptions => {
  const genreSet = new Set<string>();
  const yearSet = new Set<string>();
  let hasUnknownGenre = false;
  let hasUnknownYear = false;
  let hasUnrated = false;

  books.forEach((book) => {
    if (book.genres.length === 0) {
      hasUnknownGenre = true;
    } else {
      book.genres.forEach((genre) => {
        genreSet.add(genre);
      });
    }

    if (book.publishedYear === null) {
      hasUnknownYear = true;
    } else {
      yearSet.add(String(book.publishedYear));
    }

    if (book.rating === null) {
      hasUnrated = true;
    }
  });

  const genres = Array.from(genreSet).sort((left, right) => left.localeCompare(right));
  const years = Array.from(yearSet).sort((left, right) => Number(right) - Number(left));
  const ratings = ["5", "4", "3", "2", "1"];

  if (hasUnknownGenre) {
    genres.push(UNKNOWN_GENRE);
  }
  if (hasUnknownYear) {
    years.push(UNKNOWN_YEAR);
  }
  if (hasUnrated) {
    ratings.push(UNRATED);
  }

  return { genres, years, ratings };
};

const hasYearFilter = (filters: LibraryFilters): boolean => {
  return filters.yearMin !== null || filters.yearMax !== null || filters.includeUnknownYear;
};

const hasRatingFilter = (filters: LibraryFilters): boolean => {
  return filters.minRating !== null || filters.includeUnrated;
};

const hasGenreFilter = (filters: LibraryFilters): boolean => filters.genres.length > 0;

export const hasActiveFilters = (filters: LibraryFilters): boolean => {
  const defaultFilters = DEFAULT_LIBRARY_FILTERS;
  return (
    filters.loaned !== defaultFilters.loaned ||
    hasGenreFilter(filters) ||
    hasYearFilter(filters) ||
    hasRatingFilter(filters)
  );
};

export const selectVisibleLibraryBooks = (
  books: LibraryBook[],
  filters: LibraryFilters,
  sortMode: LibrarySortMode = DEFAULT_LIBRARY_SORT_MODE
): LibraryBook[] => {
  const filtered = books.filter((book) => {
    if (filters.loaned === "loaned" && !book.loaned) {
      return false;
    }
    if (filters.loaned === "not_loaned" && book.loaned) {
      return false;
    }

    if (filters.genres.length > 0) {
      const includeUnknownGenre = filters.genres.includes(UNKNOWN_GENRE);
      const selectedKnownGenres = filters.genres.filter((genre) => genre !== UNKNOWN_GENRE);
      const matchesKnownGenre =
        selectedKnownGenres.length > 0 && book.genres.some((genre) => selectedKnownGenres.includes(genre));
      const matchesUnknownGenre = includeUnknownGenre && book.genres.length === 0;

      if (!matchesKnownGenre && !matchesUnknownGenre) {
        return false;
      }
    }

    if (hasYearFilter(filters)) {
      if (book.publishedYear === null) {
        if (!filters.includeUnknownYear) {
          return false;
        }
      } else {
        if (filters.yearMin !== null && book.publishedYear < filters.yearMin) {
          return false;
        }
        if (filters.yearMax !== null && book.publishedYear > filters.yearMax) {
          return false;
        }
      }
    }

    if (hasRatingFilter(filters)) {
      if (book.rating === null) {
        if (!filters.includeUnrated) {
          return false;
        }
      } else if (filters.minRating !== null && book.rating < filters.minRating) {
        return false;
      }
    }

    return true;
  });

  return sortByRecentlyAdded(filtered, sortMode);
};
