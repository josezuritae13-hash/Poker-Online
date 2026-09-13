import { newDeck } from './deck.js';
import { evaluate, compareScores, handName } from './evaluator.js';
import { validateConfig, normalizeConfig } from './constants.js';

export function createInitialGame(room) {
    const players = Object.values(room.players || {}).map(p => ({
        id: p.id,
        name: p.name,
        chips: Number(p.chips || 0),
        left: false,
        folded: false,
        roundBet: 0,
        contribution: 0,
        acted: false,
        allIn: false,
        isDealer: false,
        isSB: false,
        isBB: false
    }));
    return {
        handNumber: 0,
        phase: 'waiting',
        pot: 0,
        currentBet: 0,
        lastRaise: normalizeConfig(room.config).bigBlind,
        currentPlayerId: null,
        dealerIndex: -1,
        deck: [],
        community: [],
        players,
        privateHands: {},
        handResult: [],
        winnerText: '',
        message: '',
        config: normalizeConfig(room.config),
        startedAt: Date.now(),
        finishedAt: null
    };
}

export function startNewHand(state) {
    const cfg = normalizeConfig(state.config);
    const eligible = state.players.filter(p => !p.left && p.chips > 0);
    if (eligible.length < 2) {
        state.phase = 'gameover';
        state.currentPlayerId = null;
        state.finishedAt = Date.now();
        state.message = 'La partida terminó: hacen falta 2 jugadores con fichas.';
        return state;
    }

    state.handNumber = (state.handNumber || 0) + 1;
    state.deck = newDeck();
    state.community = [];
    state.pot = 0;
    state.currentBet = 0;
    state.lastRaise = cfg.bigBlind;
    state.winnerText = '';
    state.handResult = [];
    state.finishedAt = null;
    state.privateHands = {};
    state.players.forEach(p => {
        p.folded = false;
        p.roundBet = 0;
        p.contribution = 0;
        p.acted = false;
        p.allIn = false;
        p.isDealer = false;
        p.isSB = false;
        p.isBB = false;
    });

    let dealer = nextSeat(state, state.dealerIndex, p => !p.left && p.chips > 0);
    if (dealer < 0) dealer = state.players.findIndex(p => !p.left && p.chips > 0);
    state.dealerIndex = dealer;
    state.players[dealer].isDealer = true;

    const sbIndex = state.players.filter(p => !p.left && p.chips > 0).length === 2
        ? dealer
        : nextSeat(state, dealer, p => !p.left && p.chips > 0);
    const bbIndex = nextSeat(state, sbIndex, p => !p.left && p.chips > 0);
    state.players[sbIndex].isSB = true;
    state.players[bbIndex].isBB = true;

    postBlind(state, sbIndex, cfg.smallBlind);
    postBlind(state, bbIndex, cfg.bigBlind);
    state.currentBet = Math.max(state.players[sbIndex].roundBet, state.players[bbIndex].roundBet);

    const seats = state.players.map((p, i) => ({ p, i })).filter(x => !x.p.left && x.p.chips > 0 || !x.p.left && x.p.roundBet > 0);
    for (const { p } of seats) state.privateHands[p.id] = [state.deck.pop(), state.deck.pop()];

    state.phase = 'preflop';
    const first = state.players.length === 2
        ? (state.players[dealer].chips > 0 ? dealer : nextSeat(state, dealer, p => !p.left && !p.folded && p.chips > 0))
        : nextSeat(state, bbIndex, p => !p.left && !p.folded && p.chips > 0);
    state.currentPlayerId = first >= 0 ? state.players[first].id : null;
    state.message = `Mano ${state.handNumber}: ciegas ${cfg.smallBlind}/${cfg.bigBlind}.`;
    updatePot(state);
    return state;
}

function postBlind(state, index, amount) {
    const p = state.players[index];
    const paid = Math.min(amount, p.chips);
    p.chips -= paid;
    p.roundBet += paid;
    p.contribution += paid;
    p.allIn = p.chips === 0;
}

function updatePot(state) {
    state.pot = state.players.reduce((sum, p) => sum + (Number(p.contribution) || 0), 0);
}

function nextSeat(state, startIndex, predicate) {
    const len = state.players.length;
    if (!len) return -1;
    for (let step = 1; step <= len; step++) {
        const i = (startIndex + step + len) % len;
        if (predicate(state.players[i], i)) return i;
    }
    return -1;
}

function active(state) {
    return state.players.filter(p => !p.left && !p.folded);
}

function actionable(state) {
    return state.players.filter(p => !p.left && !p.folded && p.chips > 0);
}

function currentCall(state, p) {
    return Math.max(0, state.currentBet - (p.roundBet || 0));
}

function allMatched(state) {
    const players = actionable(state);
    if (players.length <= 1) return true;
    return players.every(p => p.acted && (p.roundBet || 0) === state.currentBet);
}

export function applyAction(state, playerId, action, amount = 0) {
    if (!state || !['preflop','flop','turn','river'].includes(state.phase)) return { ok: false, reason: 'La mano no está en una ronda de apuestas.' };
    if (state.currentPlayerId !== playerId) return { ok: false, reason: 'No es tu turno.' };
    const p = state.players.find(x => x.id === playerId);
    if (!p || p.left || p.folded || p.chips <= 0) return { ok: false, reason: 'Jugador no disponible.' };

    const index = state.players.findIndex(x => x.id === playerId);
    const call = currentCall(state, p);
    const put = n => {
        const paid = Math.max(0, Math.min(Number(n) || 0, p.chips));
        p.chips -= paid;
        p.roundBet += paid;
        p.contribution += paid;
        p.allIn = p.chips === 0;
        return paid;
    };

    if (action === 'fold') {
        p.folded = true;
        p.acted = true;
        state.message = `${p.name} se retiró.`;
        finishAfterAction(state, index);
        return { ok: true };
    }
    if (action === 'check') {
        if (call !== 0) return { ok: false, reason: `Debes igualar ${call.toLocaleString('en-US')} o retirarte.` };
        p.acted = true;
        state.message = `${p.name} hizo check.`;
        finishAfterAction(state, index);
        return { ok: true };
    }
    if (action === 'call') {
        const paid = put(call);
        p.acted = true;
        state.message = `${p.name} igualó ${paid.toLocaleString('en-US')}.`;
        finishAfterAction(state, index);
        return { ok: true };
    }
    if (action === 'allin') {
        const before = state.currentBet;
        const allInAmount = p.chips;

        const paid = put(allInAmount);

        p.acted = true;

        if (p.roundBet > before) {
            state.currentBet = p.roundBet;

            state.lastRaise = Math.max(
                state.lastRaise,
                p.roundBet - before
            );

            state.players.forEach(x => {
                if (
                    x.id !== p.id &&
                    !x.folded &&
                    !x.left &&
                    x.chips > 0
                ) {
                    x.acted = false;
                }
            });
        }

        state.message =
            `${p.name} hizo ALL-IN (${paid.toLocaleString('en-US')}).`;

        finishAfterAction(state, index);

        return { ok: true };
    }
    if (action === 'raise') {
        const desired = Math.floor(Number(amount));
        const maxTotal = p.roundBet + p.chips;
        const minTotal = state.currentBet + Math.max(state.lastRaise, 1);
        if (!Number.isFinite(desired) || desired <= state.currentBet) return { ok: false, reason: 'La subida no es válida.' };
        if (desired < minTotal && desired < maxTotal) return { ok: false, reason: `La subida mínima es ${minTotal.toLocaleString('en-US')}.` };
        const target = Math.min(desired, maxTotal);
        const added = target - p.roundBet;
        if (added <= call) return { ok: false, reason: 'La cantidad de subida debe superar el call.' };
        const old = state.currentBet;
        put(added);
        p.acted = true;
        state.currentBet = p.roundBet;
        state.lastRaise = Math.max(state.config.bigBlind, state.currentBet - old);
        state.players.forEach(x => { if (x.id !== p.id && !x.folded && !x.left && x.chips > 0) x.acted = false; });
        state.message = `${p.name} subió a ${state.currentBet.toLocaleString('en-US')}.`;
        finishAfterAction(state, index);
        return { ok: true };
    }
    return { ok: false, reason: 'Acción no válida.' };
}

function finishAfterAction(state, playerIndex) {
    updatePot(state);
    if (active(state).length === 1) return awardFoldWin(state);
    if (allMatched(state)) return advanceStreet(state);
    const next = nextSeat(state, playerIndex, p => !p.left && !p.folded && p.chips > 0 && (!p.acted || p.roundBet < state.currentBet));
    state.currentPlayerId = next >= 0 ? state.players[next].id : null;
}

function advanceStreet(state) {
    // Protección contra estados antiguos o incompletos
    if (!Array.isArray(state.community)) {
        state.community = [];
    }

    if (!Array.isArray(state.deck)) {
        state.deck = [];
    }

    if (!Array.isArray(state.players)) {
        state.players = [];
    }

    if (active(state).length <= 1) {
        return awardFoldWin(state);
    }

    if (state.phase === 'preflop') {
        state.phase = 'flop';
    } else if (state.phase === 'flop') {
        state.phase = 'turn';
    } else if (state.phase === 'turn') {
        state.phase = 'river';
    } else if (state.phase === 'river') {
        return showdown(state);
    }

    // Comprobar que todavía existen cartas suficientes
    if (state.phase === 'flop') {
        if (state.deck.length < 3) {
            state.message = 'Error: no quedan suficientes cartas para el flop.';
            state.phase = 'showdown';
            return showdown(state);
        }

        state.community.push(
            state.deck.pop(),
            state.deck.pop(),
            state.deck.pop()
        );
    } else {
        if (state.deck.length < 1) {
            state.message = 'Error: no quedan cartas.';
            state.phase = 'showdown';
            return showdown(state);
        }

        state.community.push(state.deck.pop());
    }

    state.currentBet = 0;
    state.lastRaise = state.config.bigBlind;

    state.players.forEach(p => {
        p.roundBet = 0;
        p.acted = false;
    });

    const first = nextSeat(
        state,
        state.dealerIndex,
        p => !p.left && !p.folded && p.chips > 0
    );

    state.currentPlayerId =
        first >= 0
            ? state.players[first].id
            : null;

    updatePot(state);

    // Si todos están all-in, no podemos esperar una acción.
    if (!actionable(state).length) {
        advanceStreet(state);
    }

    return state;
}

function awardFoldWin(state) {
    const winner = active(state)[0];
    if (!winner) {
        state.phase = 'gameover';
        state.finishedAt = Date.now();
        state.currentPlayerId = null;
        return;
    }
    updatePot(state);
    const pot = state.pot;
    winner.chips += pot;
    state.handResult = [{ id: winner.id, name: winner.name, hand: 'Ganador por fold', amount: pot }];
    state.winnerText = `${winner.name} gana ${pot.toLocaleString('en-US')} fichas.`;
    state.pot = 0;
    state.phase = 'showdown';
    state.currentPlayerId = null;
}

function showdown(state) {
    updatePot(state);
    const eligible = state.players.filter(p => !p.left && !p.folded && (p.contribution || 0) > 0);
    const results = eligible.map(p => {
        const cards = [...(state.privateHands?.[p.id] || []), ...(state.community || [])];
        const score = evaluate(cards);
        return { id: p.id, name: p.name, score, hand: handName(score), contribution: p.contribution || 0 };
    });
    const levels = [...new Set(state.players.map(p => p.contribution || 0).filter(Boolean))].sort((a, b) => a - b);
    const payouts = {};
    let previous = 0;
    for (const level of levels) {
        const layer = (level - previous) * state.players.filter(p => (p.contribution || 0) >= level).length;
        const eligibleForLayer = results.filter(r => r.contribution >= level);
        if (layer > 0 && eligibleForLayer.length) {
            eligibleForLayer.sort((a, b) => compareScores(b.score, a.score));
            const best = eligibleForLayer[0];
            const tied = eligibleForLayer.filter(r => compareScores(r.score, best.score) === 0);
            const share = Math.floor(layer / tied.length);
            let remainder = layer - share * tied.length;
            for (const r of tied) {
                payouts[r.id] = (payouts[r.id] || 0) + share + (remainder-- > 0 ? 1 : 0);
            }
        }
        previous = level;
    }
    for (const p of state.players) if (payouts[p.id]) p.chips += payouts[p.id];
    results.sort((a, b) => compareScores(b.score, a.score));
    state.handResult = results.map(r => ({ id: r.id, name: r.name, hand: r.hand, amount: payouts[r.id] || 0 }));
    const winners = state.handResult.filter(r => r.amount > 0).map(r => r.name);
    state.winnerText = winners.length ? `Ganador: ${[...new Set(winners)].join(', ')}.` : 'Showdown completado.';
    state.pot = 0;
    state.phase = 'showdown';
    state.currentPlayerId = null;
}

export function handlePlayerLeave(state, playerId) {
    const p = state.players.find(x => x.id === playerId);
    if (!p) return state;
    const wasTurn = state.currentPlayerId === playerId;
    p.left = true;
    p.folded = true;
    p.chips = 0;
    if (active(state).length <= 1) return awardFoldWin(state);
    if (wasTurn) {
        const index = state.players.findIndex(x => x.id === playerId);
        const next = nextSeat(state, index, x => !x.left && !x.folded && x.chips > 0);
        state.currentPlayerId = next >= 0 ? state.players[next].id : null;
    }
    updatePot(state);
    return state;
}

export function prepareNewHand(state) {
    const eligible = state.players.filter(p => !p.left && p.chips > 0);
    if (eligible.length < 2) {
        state.phase = 'gameover';
        state.finishedAt = Date.now();
        state.currentPlayerId = null;
        state.message = 'La partida terminó: no hay suficientes jugadores con fichas.';
        return state;
    }
    return startNewHand(state);
}

export function validateStartedState(state) {
    return !!state &&
        Array.isArray(state.players) &&
        Array.isArray(state.deck) &&
        Array.isArray(state.community) &&
        state.privateHands &&
        typeof state.privateHands === 'object' &&
        state.config &&
        typeof state.config === 'object';
}

export function validateRoomConfig(config, count) {
    return validateConfig(config, count);
}
