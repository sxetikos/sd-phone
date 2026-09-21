import type { ReactNode } from 'react';

import { t, appLabel } from '@/i18n';
import type { AppDef } from '@/core/types';
import { AppIcon } from '@/shell/AppIcon';
import { AppIconSVG } from '@/shell/AppIconSVG';
import { SettingsRow } from '@/apps/settings/SettingsRow';
import type { SettingsRowDef } from '@/apps/settings/data';
import { ContactAvatar } from '@/shared/ContactAvatar';
import { initialsFor } from '@/lib/format';
import { useContactsStore } from '@/stores/contactsStore';
import { useMaskedPhone } from '@/stores/themeStore';
import type { ContactHit, GenericHit, MailHit, MessageHit, NoteHit, RemoteResults } from './spotlightApi';
import { CARD, RISE, Row, SECTIONS, Section, riseDelay } from './sections';
import type { GenericKey } from './sections';

interface Props {
    query:         string;
    apps:          AppDef[];
    appHits:       AppDef[];
    settingsHits:  SettingsRowDef[];
    calc:          { expression: string; result: string } | null;
    installableHits: AppDef[];
    musicHits:     GenericHit[];
    remote:        RemoteResults | null;
    settled:       boolean;
    onLaunchApp:   (app: AppDef, origin: { x: number; y: number }) => void;
    onOpenSetting: (row: SettingsRowDef) => void;
    onOpenContact: (hit: ContactHit) => void;
    onOpenMessage: (hit: MessageHit) => void;
    onOpenMail:    (hit: MailHit) => void;
    onOpenNote:    (hit: NoteHit) => void;
    onOpenInstallable: (app: AppDef) => void;
    onOpenHit:     (open: () => void) => void;
}

function digits(s: string): string {
    return s.replace(/\D/g, '');
}

export function SpotlightResults(p: Props) {
    const contacts = useContactsStore(s => s.contacts);
    const phone = useMaskedPhone();
    const r = p.remote;

    function hitsFor(key: GenericKey): GenericHit[] {
        if (key === 'music') return p.musicHits;
        return r ? r[key] : [];
    }

    const genericCount = SECTIONS.reduce((n, s) => n + hitsFor(s.key).length, 0);
    const nothing = p.settled && p.appHits.length === 0 && p.settingsHits.length === 0
        && !p.calc && p.installableHits.length === 0 && genericCount === 0
        && (r === null || r.contacts.length + r.messages.length + r.mail.length + r.notes.length === 0);

    if (!p.query) return null;

    function appTile(appId: string): ReactNode {
        const def = p.apps.find(a => a.id === appId);
        if (!def) return null;
        return (
            <span className="block overflow-hidden rounded-[9px] shadow-sm">
                <AppIconSVG icon={def.icon} size={40} />
            </span>
        );
    }

    function threadTitle(hit: MessageHit): string {
        if (hit.groupName) return hit.groupName;
        if (hit.conversationId.startsWith('g-')) return t('spotlight.group', 'Group');
        const card = contacts.find(c => digits(c.phone ?? '') === digits(hit.conversationId));
        return card?.name || phone(hit.conversationId);
    }

    return (
        <>
            {p.calc && (
                <div className={`mb-5 px-4 py-3.5 ${CARD} ${RISE}`}>
                    <p className="truncate text-[15px] text-ios-gray">{p.calc.expression} =</p>
                    <p className="truncate text-[34px] font-semibold leading-tight text-label">{p.calc.result}</p>
                </div>
            )}
            {p.appHits.length > 0 && (
                <Section title={t('spotlight.apps', 'Apps')}>
                    <div className={`grid grid-cols-4 gap-y-3 px-2 py-3 ${CARD}`}>
                        {p.appHits.map((app, i) => (
                            <div key={app.id} className={`flex flex-col items-center gap-1.5 ${RISE}`} style={riseDelay(i)}>
                                <AppIcon app={app} label={false} onOpen={p.onLaunchApp} />
                                <span className="w-full truncate px-1 text-center text-[12px] text-label">{appLabel(app)}</span>
                            </div>
                        ))}
                    </div>
                </Section>
            )}
            {p.installableHits.length > 0 && (
                <Section title={t('spotlight.appstore', 'App Store')}>
                    <div className={CARD}>
                        {p.installableHits.map((app, i) => (
                            <Row
                                key={app.id}
                                icon={(
                                    <span className="block overflow-hidden rounded-[9px] shadow-sm">
                                        <AppIconSVG icon={app.icon} size={40} />
                                    </span>
                                )}
                                title={appLabel(app)}
                                subtitle={t('spotlight.appStoreSubtitle', 'App Store')}
                                divider={i < p.installableHits.length - 1}
                                index={i}
                                onPress={() => p.onOpenInstallable(app)}
                                action={(
                                    <span className="shrink-0 rounded-full bg-black/5 px-4 py-1 text-[15px] font-semibold text-ios-blue dark:bg-white/10">
                                        {t('appstore.get', 'Get')}
                                    </span>
                                )}
                            />
                        ))}
                    </div>
                </Section>
            )}
            {p.settingsHits.length > 0 && (
                <Section title={t('spotlight.settings', 'Settings')}>
                    <div className={CARD}>
                        {p.settingsHits.map((row, i) => (
                            <div key={row.id} className={RISE} style={riseDelay(i)}>
                                <SettingsRow row={row} divider={i < p.settingsHits.length - 1} onPress={() => p.onOpenSetting(row)} />
                            </div>
                        ))}
                    </div>
                </Section>
            )}
            {r && r.contacts.length > 0 && (
                <Section title={t('spotlight.contacts', 'Contacts')}>
                    <div className={CARD}>
                        {r.contacts.map((hit, i) => (
                            <Row
                                key={hit.id}
                                icon={<ContactAvatar contact={{ name: hit.name, initials: initialsFor(hit.name), color: hit.color || 'rgb(var(--ios-blue))', avatar: hit.avatar }} size={40} />}
                                title={hit.name}
                                subtitle={phone(hit.phone)}
                                divider={i < r.contacts.length - 1}
                                index={i}
                                onPress={() => p.onOpenContact(hit)}
                            />
                        ))}
                    </div>
                </Section>
            )}
            {r && r.messages.length > 0 && (
                <Section title={t('spotlight.messages', 'Messages')}>
                    <div className={CARD}>
                        {r.messages.map((hit, i) => (
                            <Row key={hit.conversationId} icon={appTile('messages')} title={threadTitle(hit)} subtitle={hit.snippet} divider={i < r.messages.length - 1} index={i} onPress={() => p.onOpenMessage(hit)} />
                        ))}
                    </div>
                </Section>
            )}
            {r && r.mail.length > 0 && (
                <Section title={t('spotlight.mail', 'Mail')}>
                    <div className={CARD}>
                        {r.mail.map((hit, i) => (
                            <Row key={`${hit.accountId}:${hit.id}`} icon={appTile('mail')} title={hit.subject || hit.fromName} subtitle={hit.subject ? `${hit.fromName} · ${hit.snippet}` : hit.snippet} divider={i < r.mail.length - 1} index={i} onPress={() => p.onOpenMail(hit)} />
                        ))}
                    </div>
                </Section>
            )}
            {r && r.notes.length > 0 && (
                <Section title={t('spotlight.notes', 'Notes')}>
                    <div className={CARD}>
                        {r.notes.map((hit, i) => (
                            <Row key={hit.id} icon={appTile('notes')} title={hit.title || t('spotlight.untitledNote', 'New Note')} subtitle={hit.snippet} divider={i < r.notes.length - 1} index={i} onPress={() => p.onOpenNote(hit)} />
                        ))}
                    </div>
                </Section>
            )}
            {SECTIONS.map(section => {
                const hits = hitsFor(section.key);
                if (hits.length === 0) return null;
                return (
                    <Section key={section.key} title={section.title()}>
                        <div className={CARD}>
                            {hits.map((hit, i) => (
                                <Row
                                    key={`${hit.extra ?? ''}:${hit.id}`}
                                    icon={appTile(section.appId)}
                                    title={section.masked && !hit.subtitle ? phone(hit.title) : hit.title}
                                    subtitle={section.masked && hit.subtitle ? phone(hit.subtitle) : hit.subtitle}
                                    divider={i < hits.length - 1}
                                    index={i}
                                    onPress={() => p.onOpenHit(() => section.open(hit))}
                                />
                            ))}
                        </div>
                    </Section>
                );
            })}
            {nothing && (
                <div className={`pt-16 text-center ${RISE}`}>
                    <p className="text-[20px] font-semibold text-label">{t('spotlight.noResults', 'No Results')}</p>
                    <p className="mt-1 text-[15px] text-ios-gray">{t('spotlight.noResultsFor', 'Nothing matched "{query}"', { query: p.query })}</p>
                </div>
            )}
        </>
    );
}
