import { PencilLine } from 'lucide-react';

import { t } from '@/i18n';
import { colorFor } from '@/lib/format';
import { InitialsAvatar } from '@/shared/ContactAvatar';
import { Pill } from '@/ui/Pill';

import type { LiveHolder, ShareAccess } from './data';
import type { LiveRecord } from './useLiveRecord';
import { useMdtSession } from './useMdtSession';
import { mdtRowMeta } from './mdtTheme';

export function LivePresence({ live }: { live: LiveRecord }) {
    const { me } = useMdtSession();
    const others = live.viewers.filter(viewer => viewer.citizenid !== me?.citizenid);
    if (others.length === 0) return null;

    return (
        <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ios-green">
                <span className="h-2 w-2 rounded-full bg-ios-green" />
                {t('mdt.liveViewing', 'Also open')}
            </span>
            {others.map(viewer => (
                <span
                    key={viewer.citizenid}
                    className="flex items-center gap-1.5 rounded-full bg-black/[0.05] py-[3px] pe-2.5 ps-[3px] dark:bg-white/[0.08]"
                >
                    <InitialsAvatar name={viewer.name} color={colorFor(viewer.citizenid)} size={20} />
                    <span className="text-[12.5px] font-medium text-black dark:text-white">{viewer.name}</span>
                    <span className={mdtRowMeta}>{viewer.department}</span>
                </span>
            ))}
        </div>
    );
}

export function FieldLock({ holder, className = '' }: { holder: LiveHolder | null; className?: string }) {
    if (!holder) return null;
    return (
        <span className={`flex items-center gap-1.5 text-[12.5px] font-medium text-ios-orange ${className}`}>
            <PencilLine className="h-[13px] w-[13px] shrink-0" strokeWidth={2.4} />
            {t('mdt.liveEditing', '{name} is editing this', { name: holder.name })}
        </span>
    );
}

export function SharedAccessPill({ access }: { access?: ShareAccess }) {
    if (!access) return null;
    return (
        <Pill tone={access === 'edit' ? 'orange' : 'grey'}>
            {access === 'edit' ? t('mdt.sharedCanEdit', 'Can edit') : t('mdt.sharedViewOnly', 'View only')}
        </Pill>
    );
}
