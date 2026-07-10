export type LiveData = {
  title: string;
  venue: string;
  datetimeText: string;
  startAt: Date | null;
  endAt: Date | null;
  type: "online" | "offline";
  streamingEndAt: Date | null;
  streamingEndText: string | null;
  ticketPrice: string;
  ticketPriceMin: number | null;
  ticketStatus: string;
  ticketUrl: string;
  sourceUrl: string;
  artistNames: string[];
};
