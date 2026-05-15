export type RatedFilter = `all` | `rated` | `unrated`;

export const ratedFilterOptions: readonly { value: RatedFilter; label: string }[] = [
    { value: `all`, label: `All` },
    { value: `rated`, label: `Rated` },
    { value: `unrated`, label: `Unrated` },
];
