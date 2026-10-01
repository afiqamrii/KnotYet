export type Choice = 0 | 1;
export interface ChoiceRound {
  roundId: string;
  ids: string[];
  index: number;
  picks: [Choice | null, Choice | null];
  matches: number;
}

export const isChoice = (value: unknown): value is Choice => value === 0 || value === 1;
export const isChoiceRound = (value: unknown, validIds: Set<string>): value is ChoiceRound => {
  const round = value as ChoiceRound | null;
  return !!round && typeof round.roundId === 'string' && round.roundId.length > 0 &&
    Array.isArray(round.ids) && round.ids.length > 0 && round.ids.length <= 8 &&
    new Set(round.ids).size === round.ids.length && round.ids.every(id => validIds.has(id)) &&
    Number.isInteger(round.index) && round.index >= 0 && round.index <= round.ids.length &&
    Number.isInteger(round.matches) && round.matches >= 0 && round.matches <= round.index &&
    Array.isArray(round.picks) && round.picks.length === 2 && round.picks.every(pick => pick === null || isChoice(pick));
};

export function choose(round: ChoiceRound, player: 0 | 1, choice: Choice, roundId: string): ChoiceRound {
  if (round.roundId !== roundId || round.index >= round.ids.length || round.picks[player] !== null || !isChoice(choice)) return round;
  const picks: ChoiceRound['picks'] = [...round.picks];
  picks[player] = choice;
  return { ...round, picks };
}

export function advanceChoice(round: ChoiceRound, solo: boolean): ChoiceRound {
  if (round.index >= round.ids.length || round.picks[0] === null || (!solo && round.picks[1] === null)) return round;
  return {
    ...round, roundId: crypto.randomUUID(), index: round.index + 1, picks: [null, null],
    matches: round.matches + (!solo && round.picks[0] === round.picks[1] ? 1 : 0),
  };
}
