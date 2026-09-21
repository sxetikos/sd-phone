import { useState } from 'react';
import { Gavel, Scale } from 'lucide-react';

import { t } from '@/i18n';
import { formatListDate } from '@/lib/time';
import { useAsyncData } from '@/hooks/useAsyncData';
import { EmptyState } from '@/ui/EmptyState';
import { Pill } from '@/ui/Pill';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Sheet } from '@/ui/Sheet';

import type { RecordKind, ShareAccess, ShareRow, ShareTarget } from './data';
import { mdtRevokeShare, mdtShare, mdtShares } from './mdtApi';
import { mdtRowMeta } from './mdtTheme';
import { MdtButton } from './ui/MdtButton';

function kindLabel(kind: RecordKind): string {
    if (kind === 'case') return t('mdt.shareKindCase', 'case file');
    if (kind === 'warrant') return t('mdt.shareKindWarrant', 'warrant');
    return t('mdt.shareKindReport', 'report');
}

function TargetRow({ target, share, canRevoke, busy, onShare, onRevoke }: {
    target:    ShareTarget;
    share:     ShareRow | undefined;
    canRevoke: boolean;
    busy:      boolean;
    onShare:   (access: ShareAccess) => void;
    onRevoke:  () => void;
}) {
    const [access, setAccess] = useState<ShareAccess>(share?.access ?? 'view');
    const Icon = target.bench ? Gavel : Scale;
    const unchanged = share !== undefined && share.access === access;

    return (
        <div className="flex flex-col gap-3 rounded-[12px] bg-black/[0.04] px-3.5 py-3 dark:bg-white/[0.06]">
            <div className="flex items-start gap-3">
                <span className="mt-[1px] flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-black/[0.06] text-ios-gray dark:bg-white/[0.10]">
                    <Icon className="h-4 w-4" strokeWidth={2.2} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-semibold text-black dark:text-white">{target.label}</span>
                    <span className={`truncate ${mdtRowMeta}`}>
                        {share
                            ? t('mdt.sharedBy', 'Shared by {name}, {date}', { name: share.sharedBy, date: formatListDate(share.createdAt * 1000) })
                            : t('mdt.notShared', 'Not shared')}
                    </span>
                </span>
                {share && (
                    <Pill tone={share.access === 'edit' ? 'orange' : 'grey'}>
                        {share.access === 'edit' ? t('mdt.sharedCanEdit', 'Can edit') : t('mdt.sharedViewOnly', 'View only')}
                    </Pill>
                )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <SegmentedControl<ShareAccess>
                    className="min-w-[180px] flex-1"
                    value={access}
                    onChange={setAccess}
                    options={[
                        { value: 'view', label: t('mdt.shareViewOnly', 'View only') },
                        { value: 'edit', label: t('mdt.shareCanEdit', 'Can edit') },
                    ]}
                />
                <MdtButton size="sm" variant="filled" disabled={busy || unchanged} onClick={() => onShare(access)}>
                    {share ? t('mdt.shareUpdate', 'Update') : t('mdt.shareAction', 'Share')}
                </MdtButton>
                {share && canRevoke && (
                    <MdtButton size="sm" variant="destructive" disabled={busy} onClick={onRevoke}>
                        {t('mdt.shareRevoke', 'Revoke')}
                    </MdtButton>
                )}
            </div>
        </div>
    );
}

export function RecordShareSheet({ kind, recordRef, onClose }: {
    kind:      RecordKind;
    recordRef: string;
    onClose:   () => void;
}) {
    const { data, loading } = useAsyncData(() => mdtShares(kind, recordRef), [kind, recordRef]);
    const [shares, setShares] = useState<ShareRow[] | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const current = shares ?? data?.shares ?? [];
    const targets = data?.targets ?? [];

    async function run(task: Promise<{ value: ShareRow[] | null; error: string | null }>) {
        setBusy(true);
        setError(null);
        const res = await task;
        setBusy(false);
        if (res.value) setShares(res.value);
        else setError(res.error);
    }

    return (
        <Sheet onClose={onClose} fit="content" className="bg-base" title={t('mdt.shareWithCourt', 'Share with the court')}>
            {() => (
                <div className="flex min-h-0 flex-col gap-3 px-4 pb-4">
                    <p className={mdtRowMeta}>
                        {t('mdt.shareWithCourtSub', 'Pick who gets this {kind}. View only lets them read it; Can edit lets them change it, and every change is kept in its history.', { kind: kindLabel(kind) })}
                    </p>

                    {error && <p className="text-[12.5px] font-medium text-ios-red">{error}</p>}

                    {targets.length === 0 ? (
                        <div className="py-6">
                            <EmptyState
                                center
                                icon={Scale}
                                title={loading ? t('mdt.loading', 'Loading') : t('mdt.noCourtDepartments', 'No court on this server')}
                                subtitle={loading ? undefined : t('mdt.noCourtDepartmentsSub', 'Add a department with type doj in configs/mdt.lua to share paperwork with it.')}
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {targets.map(target => (
                                <TargetRow
                                    key={`${target.job}:${current.find(s => s.department === target.job)?.access ?? 'none'}`}
                                    target={target}
                                    share={current.find(s => s.department === target.job)}
                                    canRevoke={data?.canRevoke ?? false}
                                    busy={busy}
                                    onShare={access => void run(mdtShare(kind, recordRef, target.job, access))}
                                    onRevoke={() => void run(mdtRevokeShare(kind, recordRef, target.job))}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </Sheet>
    );
}
