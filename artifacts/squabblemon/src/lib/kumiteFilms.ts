/** Editorial films only. This registry never grants cards or changes milestones. */
export interface KumiteFilm {
  key: string;
  cardId: string;
  name: string;
  label: string;
  description: string;
}

export const KUMITE_FILMS: readonly KumiteFilm[] = [
  { key: 'brown', cardId: 'bushedo-brown', name: 'Bushedo Brown', label: 'Kumite film', description: 'Bushedo Brown takes his stance in the tournament arena.' },
  { key: 'dragonfly', cardId: 'dragonfly-jones', name: 'Dragonfly Jones', label: 'Kumite film', description: 'Dragonfly Jones steps forward for his tournament introduction.' },
  { key: 'franklin', cardId: 'franklin-duke', name: 'Franklin Duke', label: 'Kumite film', description: 'Franklin Duke raises his guard for the Kumite.' },
  { key: 'undercova', cardId: 'undercova-brotha', name: 'Undercova Brotha', label: 'Kumite film', description: 'Undercova Brotha holds his phone pose, finished with a chrome accent.' },
  { key: 'shonuff', cardId: 'sho-nuff', name: 'Sho’Nuff', label: 'Kumite film', description: 'Sho’Nuff makes his tournament entrance.' },
  { key: 'leroy', cardId: 'leroy', name: 'Leroy', label: 'Kumite film', description: 'Leroy settles into his fighting stance.' },
  { key: 'glo', cardId: 'leroy', name: 'Leroy · The Glo', label: 'The Glo film', description: 'Leroy glows gold in a separate highlight of the same fighter.' },
  { key: 'chonk', cardId: 'chonk-lee', name: 'Chonk Lee', label: 'Kumite film', description: 'Chonk Lee prepares for his next opponent.' },
  { key: 'ptang', cardId: 'p-tang', name: 'P. Tang', label: 'Kumite film', description: 'P. Tang makes his arena introduction.' },
];

export function ownedKumiteFilms(cardId: string, ownedCardIds: readonly string[]): readonly KumiteFilm[] {
  if (!ownedCardIds.includes(cardId)) return [];
  return KUMITE_FILMS.filter(film => film.cardId === cardId);
}

export function kumiteFilmAsset(film: KumiteFilm, portrait: boolean, poster = false): string {
  const orientation = portrait ? 'portrait' : 'landscape';
  return `assets/kumite/films/v1/unlock-${film.key}-${orientation}.${poster ? 'webp' : 'mp4'}`;
}
