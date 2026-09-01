import type { TFunction } from "i18next";
export type RatedFilter = `all` | `rated` | `unrated`;

export const ratedFilterOptions: readonly {
    value: RatedFilter;
    label: (t: TFunction) => string;
}[] = [
    { value: `all`, label: (t) => t("ratedFilterAll", `All`) },
    { value: `rated`, label: (t) => t("ratedFilterRated", `Rated`) },
    { value: `unrated`, label: (t) => t("ratedFilterUnrated", `Unrated`) },
];
