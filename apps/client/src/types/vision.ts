import type { DetectionBox } from "@bookshelf/scanner-core";

export type FrameDetections = {
  frameWidth: number;
  frameHeight: number;
  boxes: DetectionBox[];
  frameTimestampMs: number;
  detectorLatencyMs: number;
  payloadCandidateCount: number;
  parsedBoxCount: number;
  backendBoxCount: number | null;
};

export type LookupBookItem = {
  id?: string;
  title?: string;
  authors?: string[];
  publishedDate?: string;
  categories?: string[];
  averageRating?: number;
  ratingsCount?: number;
  pageCount?: number;
  imageLinks?: {
    thumbnail?: string;
    smallThumbnail?: string;
  };
  publisher?: string;
  infoLink?: string;
  previewLink?: string;
  descriptionSnippet?: string;
};

export type CaptureScanSpine = {
  spineIndex: number;
  bbox: [number, number, number, number];
  confidence: number;
  extraction: {
    title: string;
    author: string | null;
    confidence: number;
  };
  lookup: {
    totalItems: number;
    items: LookupBookItem[];
    error: string | null;
  };
};

export type CaptureScanResponse = {
  count: number;
  frameWidth: number;
  frameHeight: number;
  spines: CaptureScanSpine[];
  timingsMs?: {
    detect: number;
    extractLookup: number;
    total: number;
  };
};

export type FeedDecision = "accepted" | "rejected" | null;

export type FeedItem = {
  id: string;
  spineIndex: number;
  title: string;
  author: string;
  source: "lookup" | "extraction";
  confidence: number;
  raw: CaptureScanSpine;
  metadata?: LookupBookItem;
  hiddenAlternatives: number;
  decision: FeedDecision;
};
