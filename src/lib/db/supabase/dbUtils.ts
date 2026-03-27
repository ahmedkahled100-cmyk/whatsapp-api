// src/lib/db/supabase/dbUtils.ts
// Utilities for converting between camelCase (TypeScript) and snake_case (PostgreSQL)

/** Convert camelCase string to snake_case */
export function toSnake(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/** Convert snake_case string to camelCase */
export function toCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/** Recursively convert all keys of an object from snake_case to camelCase */
export function fromDB<T = any>(row: any): T {
  if (!row || typeof row !== 'object') return row;
  if (Array.isArray(row)) return row.map(fromDB) as any;
  const result: any = {};
  for (const key of Object.keys(row)) {
    const camelKey = toCamel(key);
    const val = row[key];
    result[camelKey] = val && typeof val === 'object' && !Array.isArray(val) ? fromDB(val) : val;
  }
  return result as T;
}

/** Recursively convert all keys of an object from camelCase to snake_case */
export function toDB(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toDB);
  const result: any = {};
  for (const key of Object.keys(obj)) {
    const snakeKey = toSnake(key);
    const val = obj[key];
    // Preserve JSONB arrays/objects as-is (they are stored as JSON, no key transforming inside)
    result[snakeKey] = val;
  }
  return result;
}

/** Helper: convert array from DB rows to camelCase */
export function manyFromDB<T = any>(rows: any[]): T[] {
  return (rows || []).map(fromDB<T>);
}
