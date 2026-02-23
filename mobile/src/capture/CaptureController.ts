import type {
  CaptureScanResponse,
  CaptureScanSpine,
  FeedDecision,
  FeedItem,
  LookupBookItem
} from "../types/vision";

const createLookupFeedItem = (
  spine: CaptureScanSpine,
  lookupItem: LookupBookItem
): FeedItem => {
  const title = lookupItem.title?.trim() || spine.extraction.title.trim() || "Untitled";
  const author =
    lookupItem.authors?.filter(Boolean).join(", ") || spine.extraction.author?.trim() || "Unknown author";

  return {
    id: `spine-${spine.spineIndex}-lookup-primary`,
    spineIndex: spine.spineIndex,
    title,
    author,
    source: "lookup",
    confidence: spine.extraction.confidence,
    raw: spine,
    metadata: lookupItem,
    hiddenAlternatives: Math.max(0, spine.lookup.items.length - 1),
    decision: null
  };
};

const createFallbackExtractionFeedItem = (spine: CaptureScanSpine): FeedItem => {
  const title = spine.extraction.title.trim() || "Untitled";
  const author = spine.extraction.author?.trim() || "Unknown author";

  return {
    id: `spine-${spine.spineIndex}-extraction`,
    spineIndex: spine.spineIndex,
    title,
    author,
    source: "extraction",
    confidence: spine.extraction.confidence,
    raw: spine,
    hiddenAlternatives: 0,
    decision: null
  };
};

export const buildFeedItems = (capture: CaptureScanResponse): FeedItem[] => {
  const items: FeedItem[] = [];

  capture.spines.forEach((spine) => {
    const primaryLookupItem = spine.lookup.items[0];
    if (!primaryLookupItem) {
      items.push(createFallbackExtractionFeedItem(spine));
      return;
    }

    items.push(createLookupFeedItem(spine, primaryLookupItem));
  });

  return items;
};

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const dedupeKey = (item: FeedItem): string => {
  const lookupId = item.metadata?.id?.trim();
  if (lookupId) {
    return `lookup:${lookupId}`;
  }

  const title = normalize(item.title);
  const author = normalize(item.author);
  return `${title}::${author}`;
};

export const dedupeFeedItems = (items: FeedItem[]): FeedItem[] => {
  const byKey = new Map<string, FeedItem>();

  items.forEach((item) => {
    const key = dedupeKey(item);
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, item);
      return;
    }

    const next =
      item.confidence > existing.confidence
        ? {
            ...item,
            hiddenAlternatives: Math.max(item.hiddenAlternatives, existing.hiddenAlternatives)
          }
        : {
            ...existing,
            hiddenAlternatives: Math.max(item.hiddenAlternatives, existing.hiddenAlternatives)
          };

    byKey.set(key, next);
  });

  return Array.from(byKey.values());
};

export const applyDecision = (
  items: FeedItem[],
  itemId: string,
  decision: Exclude<FeedDecision, null>
): FeedItem[] =>
  items.map((item) => {
    if (item.id !== itemId) {
      return item;
    }
    return {
      ...item,
      decision
    };
  });

export const summarizeDecisions = (
  items: FeedItem[]
): { accepted: number; rejected: number; undecided: number } => {
  let accepted = 0;
  let rejected = 0;
  let undecided = 0;

  items.forEach((item) => {
    if (item.decision === "accepted") {
      accepted += 1;
      return;
    }
    if (item.decision === "rejected") {
      rejected += 1;
      return;
    }
    undecided += 1;
  });

  return { accepted, rejected, undecided };
};
