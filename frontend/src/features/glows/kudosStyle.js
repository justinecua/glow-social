const TILTS = [-1.2, 0.8, -0.5, 1.1, -0.9, 0.4];

export const KUDOS_TINT = "var(--button-color-bg)";

export const noteTilt = (index) => TILTS[index % TILTS.length];

export const tintedBg = (amount = 14) => `color-mix(in srgb, ${KUDOS_TINT} ${amount}%, var(--home-card))`;
