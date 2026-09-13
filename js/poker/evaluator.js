import { RANKS } from './deck.js';

const RANK_VALUE = Object.fromEntries(RANKS.map((r, i) => [r, i + 2]));
const HAND_NAMES = ['Carta alta', 'Pareja', 'Doble pareja', 'Trío', 'Escalera', 'Color', 'Full', 'Póker', 'Escalera de color'];

export function combinations5(cards) {
    const result = [];
    for (let a = 0; a < cards.length - 4; a++) {
        for (let b = a + 1; b < cards.length - 3; b++) {
            for (let c = b + 1; c < cards.length - 2; c++) {
                for (let d = c + 1; d < cards.length - 1; d++) {
                    for (let e = d + 1; e < cards.length; e++) result.push([cards[a], cards[b], cards[c], cards[d], cards[e]]);
                }
            }
        }
    }
    return result;
}

export function evaluateFive(cards) {
    const values = cards.map(c => RANK_VALUE[c[0]]).sort((a, b) => b - a);
    const counts = {};
    for (const value of values) counts[value] = (counts[value] || 0) + 1;
    const groups = Object.entries(counts)
        .map(([v, c]) => ({ v: Number(v), c }))
        .sort((a, b) => b.c - a.c || b.v - a.v);
    const flush = cards.every(c => c[1] === cards[0][1]);
    const unique = [...new Set(values)];
    let straightHigh = 0;
    if (unique.length === 5) {
        if (unique[0] - unique[4] === 4) straightHigh = unique[0];
        else if (unique.join(',') === '14,5,4,3,2') straightHigh = 5;
    }
    if (flush && straightHigh) return [8, straightHigh];
    if (groups[0].c === 4) return [7, groups[0].v, groups[1].v];
    if (groups[0].c === 3 && groups[1]?.c === 2) return [6, groups[0].v, groups[1].v];
    if (flush) return [5, ...values];
    if (straightHigh) return [4, straightHigh];
    if (groups[0].c === 3) return [3, groups[0].v, ...groups.filter(g => g.c === 1).map(g => g.v).sort((a, b) => b - a)];
    const pairs = groups.filter(g => g.c === 2).sort((a, b) => b.v - a.v);
    if (pairs.length >= 2) return [2, pairs[0].v, pairs[1].v, groups.find(g => g.c === 1)?.v || 0];
    if (pairs.length === 1) return [1, pairs[0].v, ...groups.filter(g => g.c === 1).map(g => g.v).sort((a, b) => b - a)];
    return [0, ...values];
}

export function compareScores(a, b) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const av = a[i] || 0;
        const bv = b[i] || 0;
        if (av !== bv) return av - bv;
    }
    return 0;
}

export function evaluate(cards) {
    if (cards.length < 5) return [0];
    let best = null;
    for (const hand of combinations5(cards)) {
        const score = evaluateFive(hand);
        if (!best || compareScores(score, best) > 0) best = score;
    }
    return best || [0];
}

export function handName(score) {
    return HAND_NAMES[score?.[0]] || 'Mano';
}
