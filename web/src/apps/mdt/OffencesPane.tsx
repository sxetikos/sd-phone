import { useMemo, useState } from 'react';
import { Plus, Scale } from 'lucide-react';

import { t } from '@/i18n';
import { formatMoney } from '@/lib/money';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useNuiEvent } from '@/hooks/useNuiEvent';
import { useSessionState } from '@/hooks/useSessionState';
import { AlertDialog } from '@/ui/AlertDialog';
import { EmptyState } from '@/ui/EmptyState';
import { ListColumn } from '@/ui/ListColumn';
import { MasterDetail } from '@/ui/MasterDetail';
import { Pill } from '@/ui/Pill';
import { Scroller } from '@/ui/Scroller';

import { classLabel, sentenceLabel } from './ChargePicker';
import { CHARGE_CLASSES, type ChargeClass, type Offence } from './data';
import { mdtOffenceCatalog, mdtRemoveOffence, mdtResetOffence, mdtSaveOffence } from './mdtApi';
import { useViewEnter } from './useMdtSession';
import { mdtPanePad, mdtRowHover, mdtRowMeta, mdtSectionHeader, STATUS_TONE } from './mdtTheme';
import { MdtButton } from './ui/MdtButton';
import { MdtCard } from './ui/MdtCard';
import { MdtField } from './ui/MdtField';

const MAX_MONTHS = 9999;
const MAX_FINE = 100000000;

const BLANK: Offence = { code: '', label: '', class: 'misdemeanor', months: 0, fine: 0, description: '' };

export function OffencesPane() {
    const [query, setQuery] = useSessionState('mdt:offences:query', '');
    const [code, setCode] = useSessionState<string | null>('mdt:offences:code', null);
    const [editing, setEditing] = useState<'new' | 'current' | null>(null);

    const { data, loading, settled, refetch } = useAsyncData(mdtOffenceCatalog, []);
    useNuiEvent('sd-phone:mdt:offences', refetch);

    const offences = useMemo(() => data?.rows ?? [], [data]);
    const removed = useMemo(() => data?.removed ?? [], [data]);
    const canManage = data?.canManage ?? false;

    const groups = useMemo(() => {
        const needle = query.trim().toLowerCase();
        const hits = needle.length === 0
            ? offences
            : offences.filter(o =>
                o.code.toLowerCase().includes(needle)
                || o.label.toLowerCase().includes(needle)
                || o.description.toLowerCase().includes(needle));
        return CHARGE_CLASSES
            .map(cls => ({ cls, rows: hits.filter(o => o.class === cls) }))
            .filter(group => group.rows.length > 0);
    }, [offences, query]);

    const selected = useMemo(
        () => offences.find(o => o.code === code) ?? removed.find(o => o.code === code) ?? null,
        [offences, removed, code],
    );
    const selectedRemoved = useMemo(() => removed.some(o => o.code === code), [removed, code]);

    const enter = useViewEnter(editing ? `edit:${editing}` : selected?.code ?? null);

    const empty = (
        <EmptyState
            center
            icon={Scale}
            title={loading ? t('mdt.loadingCode', 'Loading the penal code') : t('mdt.noOffences', 'No offences')}
            subtitle={loading
                ? undefined
                : query.trim()
                    ? t('mdt.noOffencesSub', 'Nothing in the penal code matches that search.')
                    : t('mdt.emptyCode', 'No charges are configured. The penal code lives in configs/penalcode.lua.')}
        />
    );

    const row = (offence: Offence, hidden: boolean) => (
        <button
            key={offence.code}
            type="button"
            onClick={() => { setEditing(null); setCode(offence.code); }}
            className={`flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-start ${
                offence.code === code ? 'bg-ios-blue/10' : mdtRowHover
            } ${hidden ? 'opacity-55' : ''}`}
        >
            <span className="w-[64px] shrink-0 text-[12.5px] font-bold uppercase tabular-nums tracking-wide text-ios-gray">
                {offence.code}
            </span>
            <span className="min-w-0 flex-1 truncate text-[14.5px] text-black dark:text-white">
                {offence.label}
            </span>
            {offence.edited && !hidden && <Pill tone="orange">{t('mdt.offenceEdited', 'Edited')}</Pill>}
            {offence.custom && <Pill tone="blue">{t('mdt.offenceCustom', 'Custom')}</Pill>}
            <span className={`shrink-0 tabular-nums ${mdtRowMeta}`}>
                {offence.months > 0 ? t('mdt.monthsShort', '{n}m', { n: offence.months }) : '-'}
                {' · '}
                {formatMoney(offence.fine, { whole: true })}
            </span>
        </button>
    );

    const master = (
        <ListColumn
            className="flex-1"
            title={t('mdt.offences', 'Offences')}
            count={offences.length}
            query={query}
            onQuery={setQuery}
            placeholder={t('mdt.searchOffencesShort', 'Code, label or wording')}
            action={canManage ? (
                <MdtButton
                    size="sm"
                    icon={<Plus className="h-[13px] w-[13px]" strokeWidth={3} />}
                    onClick={() => { setCode(null); setEditing('new'); }}
                >
                    {t('mdt.create', 'Create')}
                </MdtButton>
            ) : undefined}
            isEmpty={settled && groups.length === 0}
            empty={empty}
        >
            {groups.map(group => (
                <div key={group.cls}>
                    <div className="sticky top-0 z-10 bg-base/95 px-4 py-1 backdrop-blur-sm">
                        <span className={mdtSectionHeader}>{classLabel(group.cls)}</span>
                    </div>
                    <div className="flex flex-col gap-0.5 px-1">
                        {group.rows.map(offence => row(offence, false))}
                    </div>
                </div>
            ))}
            {canManage && removed.length > 0 && !query.trim() && (
                <div>
                    <div className="sticky top-0 z-10 bg-base/95 px-4 py-1 backdrop-blur-sm">
                        <span className={mdtSectionHeader}>{t('mdt.offencesHidden', 'Hidden')}</span>
                    </div>
                    <div className="flex flex-col gap-0.5 px-1">
                        {removed.map(offence => row(offence, true))}
                    </div>
                </div>
            )}
        </ListColumn>
    );

    const done = (next: string | null) => { setEditing(null); setCode(next); refetch(); };

    const detail = editing
        ? (
            <OffenceEditor
                key={editing === 'new' ? 'new' : selected?.code}
                offence={editing === 'current' ? selected : null}
                enter={enter}
                onCancel={() => setEditing(null)}
                onSaved={done}
            />
        )
        : selected
            ? (
                <OffenceDetail
                    key={selected.code}
                    offence={selected}
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
                    icon={Scale}
                    title={t('mdt.pickOffence', 'No offence selected')}
                    subtitle={t('mdt.pickOffenceSub', 'Open a code to read what it carries in jail time and fines.')}
                />
            }
            onCloseDetail={() => { setEditing(null); setCode(null); }}
        />
    );
}

function OffenceDetail({ offence, hidden, canManage, enter, onEdit, onChanged }: {
    offence:   Offence;
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
        const ok = action === 'remove' ? await mdtRemoveOffence(offence.code) : await mdtResetOffence(offence.code);
        setBusy(false);
        if (!ok) { setError(t('mdt.offenceChangeFailed', 'That did not go through.')); return; }
        onChanged(action === 'remove' ? null : offence.code);
    }

    const retuned = offence.edited && !hidden
        && (offence.defaultFine !== offence.fine || offence.defaultMonths !== offence.months);

    return (
        <Scroller className={`h-full ${mdtPanePad} ${enter}`}>
            <div className="flex flex-wrap items-center gap-3">
                <span className="shrink-0 text-[13px] font-bold uppercase tabular-nums tracking-wide text-ios-gray">
                    {offence.code}
                </span>
                <h1 className="min-w-0 flex-1 text-[26px] font-bold leading-tight tracking-ios-display text-black dark:text-white">
                    {offence.label}
                </h1>
                {hidden && <Pill tone="grey">{t('mdt.offencesHidden', 'Hidden')}</Pill>}
                {offence.edited && !hidden && <Pill tone="orange">{t('mdt.offenceEdited', 'Edited')}</Pill>}
                {offence.custom && <Pill tone="blue">{t('mdt.offenceCustom', 'Custom')}</Pill>}
                <Pill tone={STATUS_TONE[offence.class] ?? 'blue'}>{classLabel(offence.class)}</Pill>
            </div>

            <MdtCard className="mt-5 overflow-hidden">
                <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                    <div className="p-4">
                        <div className={mdtSectionHeader}>{t('mdt.jailTime', 'Jail time')}</div>
                        <div className="mt-1 text-[20px] font-semibold tabular-nums text-black dark:text-white">
                            {sentenceLabel(offence.months)}
                        </div>
                        {retuned && offence.defaultMonths !== undefined && (
                            <div className={`mt-0.5 ${mdtRowMeta}`}>
                                {t('mdt.offenceDefault', 'Default {value}', { value: sentenceLabel(offence.defaultMonths) })}
                            </div>
                        )}
                    </div>
                    <div className="p-4">
                        <div className={mdtSectionHeader}>{t('mdt.fine', 'Fine')}</div>
                        <div className="mt-1 text-[20px] font-semibold tabular-nums text-black dark:text-white">
                            {formatMoney(offence.fine, { whole: true })}
                        </div>
                        {retuned && offence.defaultFine !== undefined && (
                            <div className={`mt-0.5 ${mdtRowMeta}`}>
                                {t('mdt.offenceDefault', 'Default {value}', { value: formatMoney(offence.defaultFine, { whole: true }) })}
                            </div>
                        )}
                    </div>
                </div>
            </MdtCard>

            <MdtCard className="mt-4 p-4">
                <div className={mdtSectionHeader}>{t('mdt.description', 'Description')}</div>
                <p dir="auto" className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-black dark:text-white">
                    {offence.description || t('mdt.noDescription', 'No description on file for this code.')}
                </p>
            </MdtCard>

            {canManage && (
                <>
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                        {hidden ? (
                            <MdtButton variant="filled" disabled={busy} onClick={() => void run('reset')}>
                                {t('mdt.offenceRestore', 'Put back in the penal code')}
                            </MdtButton>
                        ) : (
                            <>
                                <MdtButton variant="filled" disabled={busy} onClick={onEdit}>
                                    {t('common.edit', 'Edit')}
                                </MdtButton>
                                {offence.edited && (
                                    <MdtButton disabled={busy} onClick={() => setConfirm('reset')}>
                                        {t('mdt.offenceReset', 'Reset to default')}
                                    </MdtButton>
                                )}
                                <span className="flex-1" />
                                <MdtButton variant="destructive" disabled={busy} onClick={() => setConfirm('remove')}>
                                    {offence.custom ? t('common.delete', 'Delete') : t('mdt.offenceHide', 'Hide')}
                                </MdtButton>
                            </>
                        )}
                    </div>
                    <p className={`mt-3 ${mdtRowMeta}`}>
                        {t('mdt.offenceManageHint', 'Changes apply to paperwork filed from now on. Reports and warrants already on file keep the figures they were filed with.')}
                    </p>
                </>
            )}

            {error && <div className="mt-3 text-[14px] text-ios-red">{error}</div>}
            <div className="h-6" />

            {confirm === 'remove' && (
                <AlertDialog
                    title={offence.custom
                        ? t('mdt.offenceDeleteTitle', 'Delete this charge?')
                        : t('mdt.offenceHideTitle', 'Hide this charge?')}
                    message={offence.custom
                        ? t('mdt.offenceDeleteSub', '{code} was added on this server and will be gone for good.', { code: offence.code })
                        : t('mdt.offenceHideSub', 'Officers will no longer be able to pick {code}. You can put it back at any time.', { code: offence.code })}
                    confirmLabel={offence.custom ? t('common.delete', 'Delete') : t('mdt.offenceHide', 'Hide')}
                    destructive
                    onCancel={() => setConfirm(null)}
                    onConfirm={() => void run('remove')}
                />
            )}
            {confirm === 'reset' && (
                <AlertDialog
                    title={t('mdt.offenceResetTitle', 'Reset to default?')}
                    message={t('mdt.offenceResetSub', '{code} goes back to the fine and jail time it shipped with.', { code: offence.code })}
                    confirmLabel={t('mdt.offenceResetConfirm', 'Reset')}
                    onCancel={() => setConfirm(null)}
                    onConfirm={() => void run('reset')}
                />
            )}
        </Scroller>
    );
}

function wholeNumber(raw: string, max: number): number {
    const n = Math.floor(Number(raw.replace(/[^\d]/g, '')));
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(n, max);
}

function OffenceEditor({ offence, enter, onCancel, onSaved }: {
    offence:  Offence | null;
    enter:    string;
    onCancel: () => void;
    onSaved:  (code: string) => void;
}) {
    const [draft, setDraft] = useState<Offence>(offence ?? BLANK);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const set = <K extends keyof Offence>(key: K, value: Offence[K]) =>
        setDraft(d => ({ ...d, [key]: value }));

    async function save() {
        const code = draft.code.trim();
        const label = draft.label.trim();
        if (!code || !label) {
            setError(t('mdt.offenceNeedsCode', 'A code and a title are both required.'));
            return;
        }
        setSaving(true);
        const failed = await mdtSaveOffence({ ...draft, code, label, description: draft.description.trim() });
        setSaving(false);
        if (failed) { setError(failed); return; }
        onSaved(code);
    }

    return (
        <Scroller key="edit" className={`h-full ${mdtPanePad} ${enter}`}>
            <h1 className="text-[26px] font-bold tracking-ios-display text-black dark:text-white">
                {offence ? t('mdt.editOffence', 'Edit charge') : t('mdt.newOffence', 'New charge')}
            </h1>

            <div className="mt-5 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <MdtField
                    label={t('mdt.code', 'Code')}
                    value={draft.code}
                    onChange={v => set('code', v)}
                    placeholder="PC 103"
                    maxLength={16}
                    disabled={offence !== null}
                />
                <MdtField
                    label={t('mdt.offenceClass', 'Class')}
                    value={draft.class}
                    onChange={v => set('class', v as ChargeClass)}
                    options={CHARGE_CLASSES.map(c => ({ value: c, label: classLabel(c) }))}
                />
            </div>

            <div className="mt-4">
                <MdtField
                    label={t('mdt.title', 'Title')}
                    value={draft.label}
                    onChange={v => set('label', v)}
                    maxLength={120}
                />
            </div>

            <div className="mt-4 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <MdtField
                    label={t('mdt.offenceMonths', 'Jail time, in months')}
                    value={String(draft.months)}
                    onChange={v => set('months', wholeNumber(v, MAX_MONTHS))}
                    inputMode="numeric"
                    maxLength={4}
                    hint={t('mdt.offencePerCount', 'Per count.')}
                />
                <MdtField
                    label={t('mdt.fine', 'Fine')}
                    value={String(draft.fine)}
                    onChange={v => set('fine', wholeNumber(v, MAX_FINE))}
                    inputMode="numeric"
                    maxLength={9}
                    hint={t('mdt.offencePerCount', 'Per count.')}
                />
            </div>

            <div className="mt-4">
                <MdtField
                    label={t('mdt.description', 'Description')}
                    value={draft.description}
                    onChange={v => set('description', v)}
                    multiline
                    rows={3}
                    maxLength={255}
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
