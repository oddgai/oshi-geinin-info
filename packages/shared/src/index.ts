/**
 * 日時テキストからDateをパースする。パースできない場合はnullを返す。
 * 例: "2026年4月1日(水) 開場18:00 開演18:30" → Date
 */
export function parseDatetime(text: string): Date | null {
  const match = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日.*?(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
}

/**
 * 料金テキストから最安値（円）を抽出する。抽出できない場合はnullを返す。
 * 例: "前売3,500円 / 当日4,000円" → 3500
 */
export function parseMinPrice(text: string): number | null {
  const matches = text.match(/[\d,]+(?=円)/g);
  if (!matches || matches.length === 0) return null;
  const prices = matches.map((m) => Number(m.replace(/,/g, "")));
  return Math.min(...prices);
}
