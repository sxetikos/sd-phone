function fold(s: string): string {
    return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function matchScore(text: string, query: string): number {
    const needle = fold(query).trim();
    if (!needle) return 0;
    const hay = fold(text);
    if (hay.startsWith(needle)) return 3;
    if (hay.split(/[\s\-&/,.]+/).some(word => word.startsWith(needle))) return 2;
    return hay.includes(needle) ? 1 : 0;
}

export function rankBy<T>(items: T[], query: string, fields: (item: T) => [string, ...string[]], limit: number): T[] {
    return items
        .map((item, index) => {
            const [primary, ...rest] = fields(item);
            const score = Math.max(matchScore(primary, query) * 2, ...rest.map(f => matchScore(f, query)));
            return { item, index, score };
        })
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .slice(0, limit)
        .map(x => x.item);
}
