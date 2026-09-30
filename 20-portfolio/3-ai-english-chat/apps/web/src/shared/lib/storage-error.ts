export function isStorageObjectConflict(error: { message: string; statusCode?: string | number; status?: number }): boolean {
  return String(error.statusCode ?? error.status ?? "") === "409" || /duplicate|already exists/i.test(error.message);
}
