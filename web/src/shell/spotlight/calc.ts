import { getLocaleTag } from '@/i18n';

type TokKind = 'num' | '+' | '-' | '*' | '/' | '%' | '(' | ')';

interface Tok {
    kind:  TokKind;
    value?: number;
}

const OPERATOR_KINDS = new Set<TokKind>(['+', '-', '*', '/', '%']);

function parseNumberLiteral(raw: string): number | null {
    const dotParts = raw.split('.');
    if (dotParts.length > 2) return null;
    let intPart = dotParts[0];
    let fracPart = dotParts.length === 2 ? dotParts[1] : null;

    if (fracPart !== null && (fracPart.includes(',') || !/^\d*$/.test(fracPart))) return null;

    if (intPart.includes(',')) {
        const groups = intPart.split(',');
        const isThousands = groups.length >= 2
            && /^\d{1,3}$/.test(groups[0])
            && groups.slice(1).every(g => /^\d{3}$/.test(g));
        if (isThousands) {
            intPart = groups.join('');
        } else if (groups.length === 2 && fracPart === null) {
            const [a, b] = groups;
            if (!/^\d*$/.test(a) || !/^\d+$/.test(b)) return null;
            intPart = a;
            fracPart = b;
        } else {
            return null;
        }
    } else if (!/^\d*$/.test(intPart)) {
        return null;
    }

    if (intPart === '' && (fracPart === null || fracPart === '')) return null;
    const normalized = fracPart !== null ? `${intPart || '0'}.${fracPart}` : intPart;
    const value = Number(normalized);
    if (!Number.isFinite(value)) return null;
    return value;
}

function tokenize(input: string): Tok[] | null {
    const toks: Tok[] = [];
    let i = 0;
    while (i < input.length) {
        const c = input[i];
        if (/\s/.test(c)) { i++; continue; }
        if (c === '+') { toks.push({ kind: '+' }); i++; continue; }
        if (c === '-') { toks.push({ kind: '-' }); i++; continue; }
        if (c === '*' || c === 'x' || c === '×') { toks.push({ kind: '*' }); i++; continue; }
        if (c === '/' || c === '÷') { toks.push({ kind: '/' }); i++; continue; }
        if (c === '%') { toks.push({ kind: '%' }); i++; continue; }
        if (c === '(') { toks.push({ kind: '(' }); i++; continue; }
        if (c === ')') { toks.push({ kind: ')' }); i++; continue; }
        if (/[0-9.,]/.test(c)) {
            let j = i;
            let raw = '';
            while (j < input.length && /[0-9.,]/.test(input[j])) { raw += input[j]; j++; }
            const value = parseNumberLiteral(raw);
            if (value === null) return null;
            toks.push({ kind: 'num', value });
            i = j;
            continue;
        }
        return null;
    }
    return toks;
}

class ParseError extends Error {}

function parse(tokens: Tok[]): number {
    let pos = 0;
    const peek = (): Tok | undefined => tokens[pos];
    const advance = (): Tok => {
        const t = tokens[pos];
        if (!t) throw new ParseError();
        pos++;
        return t;
    };

    function parsePrimary(): number {
        const t = peek();
        if (!t) throw new ParseError();
        if (t.kind === 'num') { advance(); return t.value as number; }
        if (t.kind === '(') {
            advance();
            const v = parseExpr();
            const close = peek();
            if (!close || close.kind !== ')') throw new ParseError();
            advance();
            return v;
        }
        throw new ParseError();
    }

    function parsePostfix(): number {
        let v = parsePrimary();
        while (peek()?.kind === '%') { advance(); v = v / 100; }
        return v;
    }

    function parseUnary(): number {
        if (peek()?.kind === '-') { advance(); return -parseUnary(); }
        if (peek()?.kind === '+') { advance(); return parseUnary(); }
        return parsePostfix();
    }

    function parseTerm(): number {
        let v = parseUnary();
        for (;;) {
            const t = peek();
            if (t?.kind === '*') { advance(); v = v * parseUnary(); }
            else if (t?.kind === '/') { advance(); v = v / parseUnary(); }
            else break;
        }
        return v;
    }

    function parseExpr(): number {
        let v = parseTerm();
        for (;;) {
            const t = peek();
            if (t?.kind === '+') { advance(); v = v + parseTerm(); }
            else if (t?.kind === '-') { advance(); v = v - parseTerm(); }
            else break;
        }
        return v;
    }

    const result = parseExpr();
    if (pos !== tokens.length) throw new ParseError();
    return result;
}

const MAX_INPUT_LENGTH = 200;
const PHONE_NUMBER_DIGITS = 7;

export function evaluateExpression(input: string): { expression: string; result: string } | null {
    const trimmed = input.trim();
    if (!trimmed || trimmed.length > MAX_INPUT_LENGTH) return null;
    const tokens = tokenize(trimmed);
    if (!tokens || tokens.length === 0) return null;
    const usedOperators = new Set(tokens.map(t => t.kind).filter(k => OPERATOR_KINDS.has(k)));
    if (usedOperators.size === 0) return null;
    if (usedOperators.size === 1 && usedOperators.has('-')) {
        const digitCount = (trimmed.match(/\d/g) ?? []).length;
        if (digitCount >= PHONE_NUMBER_DIGITS) return null;
    }
    let value: number;
    try {
        value = parse(tokens);
    } catch {
        return null;
    }
    if (!Number.isFinite(value)) return null;
    if (Object.is(value, -0)) value = 0;
    const result = new Intl.NumberFormat(getLocaleTag(), { maximumSignificantDigits: 10 }).format(value);
    return { expression: trimmed, result };
}
