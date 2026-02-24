const FIGMA_COVER_BY_TITLE: Record<string, string> = {
  "the secret history": "https://www.figma.com/api/mcp/asset/494c4e1e-c9af-4dfc-9c82-22df73b069c6",
  "norwegian wood": "https://www.figma.com/api/mcp/asset/f7756d1f-dff2-43e3-89ba-d5e08c972411",
  beloved: "https://www.figma.com/api/mcp/asset/59253b7d-cb7b-487b-8d6d-1cd96eee7ff5",
  "the remains of the day": "https://www.figma.com/api/mcp/asset/2b773b8f-85ff-4e68-8704-f9f3f4303eb2",
  "a little life": "https://www.figma.com/api/mcp/asset/8fc0b3e9-2769-4f09-a675-fae6dabd05b1",
  pachinko: "https://www.figma.com/api/mcp/asset/99678952-f417-4a57-bda2-1e3d6b9cfbf8",
  "never let me go": "https://www.figma.com/api/mcp/asset/0760b74c-2c13-4542-9647-c37973debe51",
  "the goldfinch": "https://www.figma.com/api/mcp/asset/3dbe1489-5363-4b49-b0e7-602f132bbb04",
  "on earth we're briefly gorgeous": "https://www.figma.com/api/mcp/asset/a9712ce2-9d6b-4e96-9ca9-8b59eba0d74a"
};

const normalizeTitle = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const getFigmaCoverForTitle = (title: string): string | null =>
  FIGMA_COVER_BY_TITLE[normalizeTitle(title)] ?? null;

export const resolveBookCoverUri = (title: string, fallback: string | null): string | null =>
  getFigmaCoverForTitle(title) ?? fallback;
