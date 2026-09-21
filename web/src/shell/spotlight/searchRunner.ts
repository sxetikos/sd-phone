export function createSearchRunner<T>(
    fetcher: (q: string) => Promise<T | null>,
    onResult: (q: string, result: T | null) => void,
    delayMs = 250,
    minLength = 2,
): { update(q: string): void; dispose(): void } {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let seq = 0;

    function cancel(): void {
        if (timer !== null) { clearTimeout(timer); timer = null; }
    }

    return {
        update(raw: string) {
            const q = raw.trim();
            cancel();
            const mine = ++seq;
            if (q.length < minLength) { onResult(q, null); return; }
            timer = setTimeout(() => {
                timer = null;
                fetcher(q).then(
                    result => { if (mine === seq) onResult(q, result); },
                    () => { if (mine === seq) onResult(q, null); },
                );
            }, delayMs);
        },
        dispose() {
            cancel();
            seq++;
        },
    };
}
