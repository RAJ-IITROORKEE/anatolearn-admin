const dateTimeFormatter = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "Not available";
  return dateTimeFormatter.format(new Date(value));
}

export function formatDuration(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) return "Not available";
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes} min ${remainder} sec` : `${minutes} min`;
}
