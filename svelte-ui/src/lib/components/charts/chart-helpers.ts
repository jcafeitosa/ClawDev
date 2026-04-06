export const CHART_WINDOW_DAYS = 14;

export function getLast14Days(): string[] {
  return Array.from({ length: CHART_WINDOW_DAYS }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (CHART_WINDOW_DAYS - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

export function formatDayLabel(dateStr: string, index?: number): string {
  if (index !== undefined && index !== 0 && index !== 6 && index !== 13) return "";
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
