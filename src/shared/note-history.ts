import { NOTE_REVISION_MAX } from "./schemas";
import type { Actor, NoteItem, NoteRevision } from "./schemas";

export type DiffLine = {
  kind: "same" | "add" | "del";
  text: string;
};

export type DiffRow = {
  left: DiffLine | null;
  right: DiffLine | null;
};

const DIFF_CELL_LIMIT = 200_000;

export function reviseNoteItem(
  item: NoteItem,
  body: string,
  actor: Actor,
  source: NoteItem["source"],
  now: string,
): NoteItem {
  if (item.body === body) {
    return item;
  }

  const prior = item.revisions ?? [];
  const seeded =
    prior.length === 0
      ? [
          {
            body: item.body,
            author: item.author,
            source: item.source,
            createdAt: item.createdAt,
          } satisfies NoteRevision,
        ]
      : prior;

  return {
    ...item,
    body,
    updatedAt: now,
    updatedBy: actor,
    revisions: capNoteRevisions([
      ...seeded,
      {
        body,
        author: actor,
        source,
        createdAt: now,
      },
    ]),
  };
}

function capNoteRevisions(revisions: NoteRevision[]): NoteRevision[] {
  if (revisions.length <= NOTE_REVISION_MAX) {
    return revisions;
  }

  const original = revisions[0];
  if (!original) {
    return revisions.slice(-NOTE_REVISION_MAX);
  }

  return [original, ...revisions.slice(-(NOTE_REVISION_MAX - 1))];
}

export function lineDiff(previous: string, next: string): DiffLine[] {
  const left = previous.split("\n");
  const right = next.split("\n");
  const rows = left.length;
  const cols = right.length;

  if ((rows + 1) * (cols + 1) > DIFF_CELL_LIMIT) {
    return [
      ...left.map((text) => ({ kind: "del" as const, text })),
      ...right.map((text) => ({ kind: "add" as const, text })),
    ];
  }

  const table: number[][] = Array.from({ length: rows + 1 }, () =>
    Array.from({ length: cols + 1 }, () => 0),
  );

  for (let i = 1; i <= rows; i += 1) {
    for (let j = 1; j <= cols; j += 1) {
      const row = table[i];
      const previousRow = table[i - 1];
      if (!row || !previousRow) {
        continue;
      }
      row[j] =
        left[i - 1] === right[j - 1]
          ? (previousRow[j - 1] ?? 0) + 1
          : Math.max(previousRow[j] ?? 0, row[j - 1] ?? 0);
    }
  }

  const lines: DiffLine[] = [];
  let i = rows;
  let j = cols;
  while (i > 0 && j > 0) {
    const leftLine = left[i - 1] ?? "";
    const rightLine = right[j - 1] ?? "";
    if (leftLine === rightLine) {
      lines.push({ kind: "same", text: leftLine });
      i -= 1;
      j -= 1;
      continue;
    }

    const up = table[i - 1]?.[j] ?? 0;
    const leftScore = table[i]?.[j - 1] ?? 0;
    if (leftScore >= up) {
      lines.push({ kind: "add", text: rightLine });
      j -= 1;
    } else {
      lines.push({ kind: "del", text: leftLine });
      i -= 1;
    }
  }

  while (i > 0) {
    lines.push({ kind: "del", text: left[i - 1] ?? "" });
    i -= 1;
  }
  while (j > 0) {
    lines.push({ kind: "add", text: right[j - 1] ?? "" });
    j -= 1;
  }

  return lines.reverse();
}

export function splitDiffRows(previous: string, next: string): DiffRow[] {
  const rows: DiffRow[] = [];
  const lines = lineDiff(previous, next);
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line) {
      break;
    }

    if (line.kind === "same") {
      rows.push({ left: line, right: line });
      index += 1;
      continue;
    }

    const removed: DiffLine[] = [];
    const added: DiffLine[] = [];
    while (index < lines.length && lines[index]?.kind === "del") {
      removed.push(lines[index]!);
      index += 1;
    }
    while (index < lines.length && lines[index]?.kind === "add") {
      added.push(lines[index]!);
      index += 1;
    }

    const count = Math.max(removed.length, added.length);
    for (let offset = 0; offset < count; offset += 1) {
      rows.push({
        left: removed[offset] ?? null,
        right: added[offset] ?? null,
      });
    }
  }

  return rows;
}
