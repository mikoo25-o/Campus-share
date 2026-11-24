export type Role = "donor" | "receiver";

export const ROLES: {
  value: Role;
  title: string;
  summary: string;
  detail: string;
}[] = [
  {
    value: "donor",
    title: "I'm a Donor",
    summary: "I have food to share with people who need it.",
    detail:
      "Restaurants, farmers, shops, institutions and individuals can donate surplus food and earn eligible promotional benefits.",
  },
  {
    value: "receiver",
    title: "I'm a Receiver",
    summary: "I want to discover and collect available food.",
    detail: "Find nearby food donations, check availability, reserve food and receive collection updates.",
  },
];

/** Safe parse of a role coming from a URL. Anything unexpected becomes the default. */
export function parseRole(value: string | string[] | undefined): Role {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "receiver" ? "receiver" : "donor";
}
