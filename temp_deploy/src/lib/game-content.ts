// Normalize AI / stored game payloads into a flat array per game type.

import type { GameType } from '@/types';

export function normalizeGameContent(type: GameType, raw: unknown): unknown[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);

  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const keysByType: Partial<Record<GameType, string[]>> = {
      flashcards: ['flashcards', 'cards', 'items', 'data'],
      match: ['pairs', 'matches', 'items', 'data'],
      sentence: ['sentences', 'items', 'data'],
      sort: ['items', 'sortItems', 'data'],
      tf_run: ['statements', 'items', 'questions', 'data'],
      quiz: ['questions', 'items', 'data'],
    };
    const tryKeys = keysByType[type] || ['items', 'data', 'content'];
    for (const k of tryKeys) {
      const v = o[k];
      if (Array.isArray(v)) return v.filter(Boolean);
    }
    if (Array.isArray(o.content)) return o.content.filter(Boolean);
  }

  return [];
}

export function gameItemCount(type: GameType, raw: unknown): number {
  return normalizeGameContent(type, raw).length;
}
