import { Badge } from "@/components/ui/badge";
import { formatKst } from "@/lib/format/kst";
import { NOTE_SUBJECT_LABEL, type NoteSubjectType } from "@/lib/domain/crm/schema";
import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type ActivityNote = Pick<
  Database["public"]["Tables"]["activity_notes"]["Row"],
  "id" | "subject_type" | "subject_id" | "body" | "author_id" | "created_at"
>;

/** 메모 작성자 이름을 한 번의 in() 조회로 가져온다(N+1 방지). 실패하면 빈 맵(이름 대신 "운영자") */
export async function fetchNoteAuthors(
  supabase: Awaited<ReturnType<typeof createClient>>,
  notes: Pick<ActivityNote, "author_id">[],
): Promise<Record<string, string>> {
  const ids = [...new Set(notes.map((n) => n.author_id))];
  if (!ids.length) return {};
  const { data } = await supabase.from("profiles").select("id, display_name").in("id", ids);
  return Object.fromEntries((data ?? []).map((p) => [p.id, p.display_name ?? "운영자"]));
}

/**
 * 통화 메모 타임라인(최신순으로 받은 그대로 그린다).
 * authors: author_id → 표시 이름. 호출 측에서 profiles를 in()으로 한 번에 조회해 넘긴다(N+1 방지).
 */
export function ActivityNotes({ notes, authors, showSubject = true }: {
  notes: ActivityNote[]; authors: Record<string, string>; showSubject?: boolean;
}) {
  if (!notes.length) {
    return <p className="rounded-tile bg-section px-5 py-4 text-body text-muted-foreground">아직 남긴 메모가 없습니다.</p>;
  }
  return (
    <ol aria-label="메모 타임라인" className="divide-y divide-border/70 overflow-hidden rounded-tile border border-border/70 bg-card">
      {notes.map((n) => (
        <li key={n.id} className="space-y-1.5 px-5 py-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-micro text-muted-foreground">
            <span className="font-semibold text-foreground">{authors[n.author_id] ?? "운영자"}</span>
            <time dateTime={n.created_at}>{formatKst(n.created_at)}</time>
            {showSubject && n.subject_type !== "customer" && (
              <Badge variant="outline">{NOTE_SUBJECT_LABEL[n.subject_type as NoteSubjectType] ?? n.subject_type}</Badge>
            )}
          </div>
          <p className="text-body break-words whitespace-pre-wrap">{n.body}</p>
        </li>
      ))}
    </ol>
  );
}
