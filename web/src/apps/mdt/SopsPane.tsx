import { useMemo, useState } from 'react';
import { BookText, Plus } from 'lucide-react';

import { t } from '@/i18n';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useNuiEvent } from '@/hooks/useNuiEvent';
import { useSessionState } from '@/hooks/useSessionState';
import { AlertDialog } from '@/ui/AlertDialog';
import { EmptyState } from '@/ui/EmptyState';
import { ListColumn } from '@/ui/ListColumn';
import { MasterDetail } from '@/ui/MasterDetail';
import { Pill } from '@/ui/Pill';
import { Scroller } from '@/ui/Scroller';

import type { Sop } from './data';
import { mdtRemoveSop, mdtResetSop, mdtSaveSop, mdtSopCatalog } from './mdtApi';
import { useViewEnter } from './useMdtSession';
import { mdtPanePad, mdtRef, mdtRowHover, mdtRowMeta, mdtSectionHeader } from './mdtTheme';
import { MdtButton } from './ui/MdtButton';
import { MdtCard } from './ui/MdtCard';
import { MdtField } from './ui/MdtField';
import { MdtRichText } from './ui/MdtRichText';

const MAX_BODY = 12000;

const BLANK: Sop = { code: '', title: '', category: '', summary: '', revised: '', body: '' };

function groupByCategory(sops: Sop[]): { category: string; rows: Sop[] }[] {
    const order: string[] = [];
    const byCategory = new Map<string, Sop[]>();
    for (const sop of sops) {
        if (!byCategory.has(sop.category)) { byCategory.set(sop.category, []); order.push(sop.category); }
        byCategory.get(sop.category)!.push(sop);
    }
    return order.map(category => ({ category, rows: byCategory.get(category)! }));
}

export function SopsPane() {
    const [query, setQuery] = useSessionState('mdt:sops:query', '');
    const [code, setCode] = useSessionState<string | null>('mdt:sops:code', null);
    const [editing, setEditing] = useState<'new' | 'current' | null>(null);

    const { data, loading, settled, refetch } = useAsyncData(mdtSopCatalog, []);
    useNuiEvent('sd-phone:mdt:sops', refetch);

    const sops = useMemo(() => data?.rows ?? [], [data]);
    const removed = useMemo(() => data?.removed ?? [], [data]);
    const canManage = data?.canManage ?? false;

    const groups = useMemo(() => {
        const needle = query.trim().toLowerCase();
        const hits = needle.length === 0
            ? sops
            : sops.filter(s =>
                s.code.toLowerCase().includes(needle)
                || s.title.toLowerCase().includes(needle)
                || s.summary.toLowerCase().includes(needle)
                || s.body.toLowerCase().includes(needle));
        return groupByCategory(hits);
    }, [sops, query]);

    const categories = useMemo(() => Array.from(new Set(sops.map(s => s.category))), [sops]);

    const selected = useMemo(
        () => sops.find(s => s.code === code) ?? removed.find(s => s.code === code) ?? null,
        [sops, removed, code],
    );
    const selectedRemoved = useMemo(() => removed.some(s => s.code === code), [removed, code]);

    const enter = useViewEnter(editing ? `edit:${editing}` : selected?.code ?? null);

    const empty = (
        <EmptyState
            center
            icon={BookText}
            title={loading ? t('mdt.sopsLoading', 'Loading SOPs') : t('mdt.sopsNone', 'No SOPs')}
            subtitle={loading
                ? undefined
                : query.trim()
                    ? t('mdt.sopsNoMatch', 'No SOP matches that search.')
                    : canManage
                        ? t('mdt.sopsNoneManage', 'Nothing published yet. Create your department\'s first standing order.')
                        : t('mdt.sopsNoneSub', 'Standing orders are published from configs/sops.lua.')}
        />
    );

    const row = (sop: Sop, hidden: boolean) => (
        <button
            key={sop.code}
            type="button"
            onClick={() => { setEditing(null); setCode(sop.code); }}
            className={`flex w-full flex-col gap-0.5 rounded-[10px] px-3 py-2 text-start ${
                sop.code === code ? 'bg-ios-blue/10' : mdtRowHover
            } ${hidden ? 'opacity-55' : ''}`}
        >
            <span className="flex w-full items-center gap-2">
                <span dir="ltr" className={`shrink-0 ${mdtRef}`}>{sop.code}</span>
                <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold text-black dark:text-white">
                    {sop.title}
                </span>
                {sop.edited && !hidden && <Pill tone="orange">{t('mdt.sopEdited', 'Edited')}</Pill>}
                {sop.custom && <Pill tone="blue">{t('mdt.sopCustom', 'Ours')}</Pill>}
            </span>
            <span className={`w-full truncate ${mdtRowMeta}`}>{sop.summary}</span>
        </button>
    );

    const master = (
        <ListColumn
            className="flex-1"
            title={t('mdt.sops', 'SOPs')}
            count={sops.length}
            query={query}
            onQuery={setQuery}
            placeholder={t('mdt.sopsSearch', 'Code, title or wording')}
            action={canManage ? (
                <MdtButton
                    size="sm"
                    icon={<Plus className="h-[13px] w-[13px]" strokeWidth={3} />}
                    onClick={() => { setCode(null); setEditing('new'); }}
                >
                    {t('mdt.create', 'Create')}
                </MdtButton>
            ) : undefined}
            isEmpty={settled && groups.length === 0 && !(canManage && removed.length > 0)}
            empty={empty}
        >
            {groups.map(group => (
                <div key={group.category}>
                    <div className="sticky top-0 z-10 bg-base/95 px-4 py-1 backdrop-blur-sm">
                        <span className={mdtSectionHeader}>{group.category}</span>
                    </div>
                    <div className="flex flex-col gap-0.5 px-1">
                        {group.rows.map(sop => row(sop, false))}
                    </div>
                </div>
            ))}
            {canManage && removed.length > 0 && !query.trim() && (
                <div>
                    <div className="sticky top-0 z-10 bg-base/95 px-4 py-1 backdrop-blur-sm">
                        <span className={mdtSectionHeader}>{t('mdt.sopsHidden', 'Hidden')}</span>
                    </div>
                    <div className="flex flex-col gap-0.5 px-1">
                        {removed.map(sop => row(sop, true))}
                    </div>
                </div>
            )}
        </ListColumn>
    );

    const done = (next: string | null) => { setEditing(null); setCode(next); refetch(); };

    const detail = editing
        ? (
            <SopEditor
                key={editing === 'new' ? 'new' : selected?.code}
                sop={editing === 'current' ? selected : null}
                categories={categories}
                enter={enter}
                onCancel={() => setEditing(null)}
                onSaved={done}
            />
        )
        : selected
            ? (
                <SopDetail
                    key={selected.code}
                    sop={selected}
                    hidden={selectedRemoved}
                    canManage={canManage}
                    enter={enter}
                    onEdit={() => setEditing('current')}
                    onChanged={done}
                />
            )
            : undefined;

    return (
        <MasterDetail
            master={master}
            hasDetail={detail !== undefined}
            detail={detail}
            placeholder={
                <EmptyState
                    center
                    icon={BookText}
                    title={t('mdt.sopsPick', 'No SOP selected')}
                    subtitle={t('mdt.sopsPickSub', 'Open a standing order to read it in full.')}
                />
            }
            onCloseDetail={() => { setEditing(null); setCode(null); }}
        />
    );
}

function SopDetail({ sop, hidden, canManage, enter, onEdit, onChanged }: {
    sop:       Sop;
    hidden:    boolean;
    canManage: boolean;
    enter:     string;
    onEdit:    () => void;
    onChanged: (next: string | null) => void;
}) {
    const [confirm, setConfirm] = useState<'remove' | 'reset' | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    async function run(action: 'remove' | 'reset') {
        setConfirm(null);
        setBusy(true);
        const ok = action === 'remove' ? await mdtRemoveSop(sop.code) : await mdtResetSop(sop.code);
        setBusy(false);
        if (!ok) { setError(t('mdt.sopChangeFailed', 'That did not go through.')); return; }
        onChanged(action === 'remove' ? null : sop.code);
    }

    return (
        <Scroller className={`h-full ${mdtPanePad} ${enter}`}>
            <div className="flex flex-wrap items-center gap-2">
                <span dir="ltr" className={mdtRef}>{sop.code}</span>
                {hidden && <Pill tone="grey">{t('mdt.sopsHidden', 'Hidden')}</Pill>}
                {sop.edited && !hidden && <Pill tone="orange">{t('mdt.sopEdited', 'Edited')}</Pill>}
                {sop.custom && <Pill tone="blue">{t('mdt.sopCustom', 'Ours')}</Pill>}
            </div>
            <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-ios-display text-black dark:text-white">
                {sop.title}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-ios-gray">
                <span>{sop.category}</span>
                {sop.revised && <><span>·</span><span>{sop.revised}</span></>}
            </div>

            {sop.summary && (
                <p className="mt-4 text-[15px] leading-relaxed text-black/70 dark:text-white/70">{sop.summary}</p>
            )}

            <MdtCard className="mt-4 p-5">
                <MdtRichText text={sop.body} className="text-[15px] leading-relaxed text-black dark:text-white" />
            </MdtCard>

            {canManage && (
                <>
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                        {hidden ? (
                            <MdtButton variant="filled" disabled={busy} onClick={() => void run('reset')}>
                                {t('mdt.sopRestore', 'Publish it again')}
                            </MdtButton>
                        ) : (
                            <>
                                <MdtButton variant="filled" disabled={busy} onClick={onEdit}>
                                    {t('common.edit', 'Edit')}
                                </MdtButton>
                                {sop.edited && (
                                    <MdtButton disabled={busy} onClick={() => setConfirm('reset')}>
                                        {t('mdt.sopReset', 'Reset to default')}
                                    </MdtButton>
                                )}
                                <span className="flex-1" />
                                <MdtButton variant="destructive" disabled={busy} onClick={() => setConfirm('remove')}>
                                    {sop.custom ? t('common.delete', 'Delete') : t('mdt.sopHide', 'Hide')}
                                </MdtButton>
                            </>
                        )}
                    </div>
                    <p className={`mt-3 ${mdtRowMeta}`}>
                        {t('mdt.sopManageHint', 'Changes here only affect your own department. Other departments keep the orders they already read.')}
                    </p>
                </>
            )}

            {error && <div className="mt-3 text-[14px] text-ios-red">{error}</div>}
            <div className="h-6" />

            {confirm === 'remove' && (
                <AlertDialog
                    title={sop.custom
                        ? t('mdt.sopDeleteTitle', 'Delete this order?')
                        : t('mdt.sopHideTitle', 'Hide this order?')}
                    message={sop.custom
                        ? t('mdt.sopDeleteSub', '{code} was written by your department and will be gone for good.', { code: sop.code })
                        : t('mdt.sopHideSub', 'Your department will stop seeing {code}. You can publish it again at any time.', { code: sop.code })}
                    confirmLabel={sop.custom ? t('common.delete', 'Delete') : t('mdt.sopHide', 'Hide')}
                    destructive
                    onCancel={() => setConfirm(null)}
                    onConfirm={() => void run('remove')}
                />
            )}
            {confirm === 'reset' && (
                <AlertDialog
                    title={t('mdt.sopResetTitle', 'Reset to default?')}
                    message={t('mdt.sopResetSub', '{code} goes back to the wording it shipped with, and your department\'s version is discarded.', { code: sop.code })}
                    confirmLabel={t('mdt.sopResetConfirm', 'Reset')}
                    destructive
                    onCancel={() => setConfirm(null)}
                    onConfirm={() => void run('reset')}
                />
            )}
        </Scroller>
    );
}

function SopEditor({ sop, categories, enter, onCancel, onSaved }: {
    sop:        Sop | null;
    categories: string[];
    enter:      string;
    onCancel:   () => void;
    onSaved:    (code: string) => void;
}) {
    const [draft, setDraft] = useState<Sop>(sop ?? BLANK);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const set = <K extends keyof Sop>(key: K, value: Sop[K]) =>
        setDraft(d => ({ ...d, [key]: value }));

    async function save() {
        const code = draft.code.trim();
        const title = draft.title.trim();
        if (!code || !title) {
            setError(t('mdt.sopNeedsCode', 'A code and a title are both required.'));
            return;
        }
        setSaving(true);
        const failed = await mdtSaveSop({
            ...draft,
            code,
            title,
            category: draft.category.trim(),
            summary:  draft.summary.trim(),
            revised:  draft.revised.trim(),
        });
        setSaving(false);
        if (failed) { setError(failed); return; }
        onSaved(code);
    }

    return (
        <Scroller key="edit" className={`h-full ${mdtPanePad} ${enter}`}>
            <h1 className="text-[26px] font-bold tracking-ios-display text-black dark:text-white">
                {sop ? t('mdt.editSop', 'Edit standing order') : t('mdt.newSop', 'New standing order')}
            </h1>

            <div className="mt-5 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <MdtField
                    label={t('mdt.code', 'Code')}
                    value={draft.code}
                    onChange={v => set('code', v)}
                    placeholder="SOP 100"
                    maxLength={16}
                    disabled={sop !== null}
                />
                <MdtField
                    label={t('mdt.category', 'Category')}
                    value={draft.category}
                    onChange={v => set('category', v)}
                    placeholder={categories[0] ?? t('mdt.sopCategoryPlaceholder', 'Conduct')}
                    maxLength={40}
                    hint={categories.length > 0
                        ? t('mdt.sopCategoryHint', 'In use: {list}', { list: categories.slice(0, 6).join(', ') })
                        : undefined}
                />
                <MdtField
                    label={t('mdt.sopRevised', 'Revision')}
                    value={draft.revised}
                    onChange={v => set('revised', v)}
                    placeholder={t('mdt.sopRevisedPlaceholder', 'Revision 1')}
                    maxLength={60}
                />
            </div>

            <div className="mt-4">
                <MdtField
                    label={t('mdt.title', 'Title')}
                    value={draft.title}
                    onChange={v => set('title', v)}
                    maxLength={160}
                />
            </div>

            <div className="mt-4">
                <MdtField
                    label={t('mdt.summary', 'Summary')}
                    value={draft.summary}
                    onChange={v => set('summary', v)}
                    maxLength={255}
                    hint={t('mdt.sopSummaryHint', 'One line, shown in the list.')}
                />
            </div>

            <div className="mt-4">
                <MdtField
                    label={t('mdt.standingOrder', 'Standing order')}
                    value={draft.body}
                    onChange={v => set('body', v)}
                    multiline
                    rows={14}
                    maxLength={MAX_BODY}
                    hint={t('mdt.sopBodyHint', 'Formatting: **bold**, *italic*, __underline__, ~~strike~~, `code`, and lines starting with "- " for bullets.')}
                />
            </div>

            {error && <div className="mt-4 text-[14px] text-ios-red">{error}</div>}

            <div className="mt-5 flex items-center gap-3 pb-6">
                <MdtButton variant="filled" disabled={saving} onClick={() => void save()}>
                    {saving ? t('mdt.saving', 'Saving') : t('common.save', 'Save')}
                </MdtButton>
                <MdtButton onClick={onCancel}>{t('common.cancel', 'Cancel')}</MdtButton>
            </div>
        </Scroller>
    );
}
