export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL;
  const relative = path.replace(/^\//, "");
  return `${base}${relative}`;
}
