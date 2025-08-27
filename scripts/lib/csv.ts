export function parseCsv(text: string, opts?: { commentPrefix?: string }): string[][] {
  const prefix = opts?.commentPrefix ?? '#';
  return text
    .split(/\r?\n/)
    .filter((line) => line && !line.trim().startsWith(prefix))
    .map((line) => line.split(',').map((cell) => cell.trim()));
}
