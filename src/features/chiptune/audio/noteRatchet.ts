/** Maximum number of stutter retriggers a single note can carry. */
export const MAX_NOTE_RATCHET = 8;

/** Normalizes a note's optional ratchet value to an integer retrigger count (1 = no stutter). */
export const resolveRatchetCount = (ratchet: number | undefined): number => {
	if (ratchet === undefined || !Number.isFinite(ratchet)) {
		return 1;
	}
	return Math.max(1, Math.min(MAX_NOTE_RATCHET, Math.round(ratchet)));
};
