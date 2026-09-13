const CARD_IMAGES = {
    "2S": "../assets/cards/2_PICAS.png",
    "3S": "../assets/cards/3_PICAS.png",
    "4S": "../assets/cards/4_PICAS.png",
    "5S": "../assets/cards/5_PICAS.png",
    "6S": "../assets/cards/6_PICAS.png",
    "7S": "../assets/cards/7_PICAS.png",
    "8S": "../assets/cards/8_PICAS.png",
    "9S": "../assets/cards/9_PICAS.png",
    "TS": "../assets/cards/10_PICAS.png",
    "JS": "../assets/cards/J_PICAS.png",
    "QS": "../assets/cards/Q_PICAS.png",
    "KS": "../assets/cards/K_PICAS.png",
    "AS": "../assets/cards/AS_PICAS.png"
};

export function getCardImage(card) {
    return CARD_IMAGES[card] || null;
}