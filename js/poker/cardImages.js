const CARD_IMAGES = {

    // =========================
    // PICAS
    // =========================
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
    "AS": "../assets/cards/AS_PICAS.png",

    // =========================
    // CORAZONES
    // =========================
    "2H": "../assets/cards/2_CORAZONES.png",
    "3H": "../assets/cards/3_CORAZONES.png",
    "4H": "../assets/cards/4_CORAZONES.png",
    "5H": "../assets/cards/5_CORAZONES.png",
    "6H": "../assets/cards/6_CORAZONES.png",
    "7H": "../assets/cards/7_CORAZONES.png",
    "8H": "../assets/cards/8_CORAZONES.png",
    "9H": "../assets/cards/9_CORAZONES.png",
    "TH": "../assets/cards/10_CORAZONES.png",
    "JH": "../assets/cards/J_CORAZONES.png",
    "QH": "../assets/cards/Q_CORAZONES.png",
    "KH": "../assets/cards/K_CORAZONES.png",
    "AH": "../assets/cards/AS_CORAZONES.png",

    // =========================
    // TREBOLES
    // =========================
    "2C": "../assets/cards/2_TREBOLES.png",
    "3C": "../assets/cards/3_TREBOLES.png",
    "4C": "../assets/cards/4_TREBOLES.png",
    "5C": "../assets/cards/5_TREBOLES.png",
    "6C": "../assets/cards/6_TREBOLES.png",
    "7C": "../assets/cards/7_TREBOLES.png",
    "8C": "../assets/cards/8_TREBOLES.png",
    "9C": "../assets/cards/9_TREBOLES.png",
    "TC": "../assets/cards/10_TREBOLES.png",
    "JC": "../assets/cards/J_TREBOLES.png",
    "QC": "../assets/cards/Q_TREBOLES.png",
    "KC": "../assets/cards/K_TREBOLES.png",
    "AC": "../assets/cards/AS_TREBOLES.png",

    // =========================
    // DIAMANTES
    // =========================
    "2D": "../assets/cards/2_DIAMANTES.png",
    "3D": "../assets/cards/3_DIAMANTES.png",
    "4D": "../assets/cards/4_DIAMANTES.png",
    "5D": "../assets/cards/5_DIAMANTES.png",
    "6D": "../assets/cards/6_DIAMANTES.png",
    "7D": "../assets/cards/7_DIAMANTES.png",
    "8D": "../assets/cards/8_DIAMANTES.png",
    "9D": "../assets/cards/9_DIAMANTES.png",
    "TD": "../assets/cards/10_DIAMANTES.png",
    "JD": "../assets/cards/J_DIAMANTES.png",
    "QD": "../assets/cards/Q_DIAMANTES.png",
    "KD": "../assets/cards/K_DIAMANTES.png",
    "AD": "../assets/cards/AS_DIAMANTES.png",
};


export function getCardImage(card) {
    return CARD_IMAGES[card] || null;
}