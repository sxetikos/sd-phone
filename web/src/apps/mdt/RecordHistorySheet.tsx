import { useState } from 'react';
import { History } from 'lucide-react';

import { t } from '@/i18n';
import { formatMoney } from '@/lib/money';
import { formatListDate, formatMediumDate } from '@/lib/time';
import { useAsyncData } from '@/hooks/useAsyncData';
import { AlertDialog } from '@/ui/AlertDialog';
import { EmptyState } from '@/ui/EmptyState';
import { Pill } from '@/ui/Pill';
import { Scroller } from '@/ui/Scroller';
import { Sheet } from '@/ui/Sheet';

import type { RecordKind, Revision } from './data';
import { mdtRestoreRevision, mdtRevisions } from './mdtApi';
import { mdtRowMeta, mdtRowTitle } from './mdtTheme';
import { MdtButton } from './ui/MdtButton';

const PREVIEW_CHARS = 160;

export function recordFieldLabel(field: string): string {
    switch (field) {
        case 'title':    return t('mdt.title', 'Title');
        case 'type':     return t('mdt.type', 'Type');
        case 'body':     return t('mdt.narrative', 'Narrative');
        case 'evidence': return t('mdt.evidence', 'Evidence');
        case 'parties':  return t('mdt.fieldParties', 'People and charges');
        case 'summary':  return t('mdt.summary', 'Summary');
        case 'status':   return t('mdt.status', 'Status');
        case 'priority': return t('mdt.priority', 'Priority');
        case 'charges':  return t('mdt.charges', 'Charges');
        case 'bond':     return t('mdt.bond', 'Bond');
        case 'expiry':   return t('mdt.fieldExpiry', 'Expiry');
        case 'notes':    return t('mdt.caseNotes', 'Notes');
        default:         return field;
    }
}

function parsed(value: string): unknown {
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function preview(field: string, value: string): string {
    if (value === '') return t('mdt.revisionEmpty', 'Empty');
    if (field === 'parties') {
        const data = parsed(value) as { involved?: unknown[]; charges?: unknown[] } | null;
        return t('mdt.revisionParties', '{people} people, {charges} charges', {
            people: data?.involved?.length ?? 0,
            charges: data?.charges?.length ?? 0,
        });
    }
    if (field === 'charges') {
        const data = parsed(value);
        return t('mdt.nCharges', '{n} charges', { n: Array.isArray(data) ? data.length : 0 });
    }
    if (field === 'evidence') {
        const data = parsed(value);
        return t('mdt.revisionEvidence', '{n} evidence items', { n: Array.isArray(data) ? data.length : 0 });
    }
    if (field === 'bond') return formatMoney(Number(value) || 0, { whole: true });
    if (field === 'expiry') return formatMediumDate(Number(value) || 0);
    return value.length > PREVIEW_CHARS ? `${value.slice(0, PREVIEW_CHARS)}...` : value;
}

function RevisionRow({ revision, canRestore, latest, onRestore }: {
    revision:   Revision;
    canRestore: boolean;
    latest:     boolean;
    onRestore:  () => void;
}) {
    return (
        <div className="flex flex-col gap-2 rounded-[12px] bg-black/[0.04] px-3.5 py-3 dark:bg-white/[0.06]">
            <div className="flex items-center gap-2">
                <span className={`min-w-0 flex-1 truncate ${mdtRowTitle}`}>{recordFieldLabel(revision.field)}</span>
                {revision.court && <Pill tone="orange">{t('mdt.revisionCourt', 'Court')}</Pill>}
                <span className={`shrink-0 tabular-nums ${mdtRowMeta}`}>{formatListDate(revision.createdAt * 1000)}</span>
            </div>
            <div className={mdtRowMeta}>
                {t('mdt.revisionBy', '{name} · {department}', { name: revision.editor, department: revision.department })}
            </div>
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                <div className="min-w-0">
                    <div className={mdtRowMeta}>{t('mdt.revisionBefore', 'Before')}</div>
                    <div dir="auto" className="whitespace-pre-wrap break-words text-[13.5px] text-black/70 line-through decoration-black/30 dark:text-white/70 dark:decoration-white/30">
                        {preview(revision.field, revision.before)}
                    </div>
                </div>
                <div className="min-w-0">
                    <div className={mdtRowMeta}>{t('mdt.revisionAfter', 'After')}</div>
                    <div dir="auto" className="whitespace-pre-wrap break-words text-[13.5px] text-black dark:text-white">
                        {preview(revision.field, revision.after)}
                    </div>
                </div>
            </div>
            {canRestore && (
                <div>
                    <MdtButton size="sm" variant="text" onClick={onRestore}>
                        {latest ? t('mdt.revisionUndo', 'Undo this edit') : t('mdt.revisionRestore', 'Restore the earlier version')}
                    </MdtButton>
                </div>
            )}
        </div>
    );
}

export function RecordHistorySheet({ kind, recordRef, onClose, onRestored }: {
    kind:       RecordKind;
    recordRef:  string;
    onClose:    () => void;
    onRestored: () => void;
}) {
    const { data, loading, refetch } = useAsyncData(() => mdtRevisions(kind, recordRef), [kind, recordRef]);
    const [confirm, setConfirm] = useState<Revision | null>(null);
    const [error, setError] = useState<string | null>(null);

    const rows = data?.rows ?? [];
    const newest = new Map<string, Revision>();
    for (const row of rows) if (!newest.has(row.field)) newest.set(row.field, row);

    async function restore(revision: Revision) {
        setConfirm(null);
        const failed = await mdtRestoreRevision(revision.id);
        if (failed) {
            setError(failed);
            return;
        }
        setError(null);
        refetch();
        onRestored();
    }

    return (
        <Sheet onClose={onClose} fit="content" className="bg-base" title={t('mdt.historyTitle', 'Edit history')}>
            {() => (
                <div className="flex min-h-0 flex-col gap-3 px-4 pb-4">
                    {error && <p className="text-[12.5px] font-medium text-ios-red">{error}</p>}
                    {rows.length === 0 ? (
                        <div className="py-8">
                            <EmptyState
                                center
                                icon={History}
                                title={loading ? t('mdt.loading', 'Loading') : t('mdt.historyEmpty', 'No edits yet')}
                                subtitle={loading ? undefined : t('mdt.historyEmptySub', 'Every change made after filing shows up here, with who made it.')}
                            />
                        </div>
                    ) : (
                        <Scroller className="min-h-0 max-h-[52vh]">
                            <div className="flex flex-col gap-2">
                                {rows.map(revision => (
                                    <RevisionRow
                                        key={revision.id}
                                        revision={revision}
                                        canRestore={(data?.canRestore ?? false) && revision.before !== newest.get(revision.field)?.after}
                                        latest={newest.get(revision.field)?.id === revision.id}
                                        onRestore={() => setConfirm(revision)}
                                    />
                                ))}
                            </div>
                        </Scroller>
                    )}

                    {confirm && (
                        <AlertDialog
                            title={t('mdt.revisionRestoreTitle', 'Restore this field?')}
                            message={t('mdt.revisionRestoreSub', '{field} goes back to what it was before this edit. The restore is kept in the history too.', { field: recordFieldLabel(confirm.field) })}
                            confirmLabel={t('mdt.revisionRestoreConfirm', 'Restore')}
                            onCancel={() => setConfirm(null)}
                            onConfirm={() => void restore(confirm)}
                        />
                    )}
                </div>
            )}
        </Sheet>
    );
}
