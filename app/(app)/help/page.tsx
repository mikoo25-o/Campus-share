import Link from "next/link";

export const metadata = { title: "Help & food safety" };

const SECTIONS: { title: string; items: string[] }[] = [
  { title: "Food safety for donors", items: [
    "Only share food that is fresh, was stored properly and is safe to eat.",
    "Keep hot food hot and cold food cold until it is collected. Do not leave cooked food out for more than two hours.",
    "List every allergen you know about. If you are not sure what is in a dish, say so.",
    "Never donate food that smells off, looks mouldy, is past its use-by date or has damaged packaging.",
  ] },
  { title: "Food safety for receivers", items: [
    "Check the food when you collect it. If anything seems wrong, do not take it.",
    "Eat or refrigerate cooked food soon after collecting. Reheat until steaming hot.",
    "CampusShare does not inspect food. Donors are responsible for what they share.",
  ] },
  { title: "Staying safe when you meet", items: [
    "Collect during daylight where you can, and tell someone where you are going.",
    "Your exact pickup address is shown only after you reserve. Your phone number is never shown publicly.",
    "Only give the 6-digit code to the donor when you are standing in front of them and have the food.",
    "Report anything that makes you uncomfortable using the Report button on a listing.",
  ] },
  { title: "Farmer market", items: [
    "CampusShare doesn't process payments. Agree price and handover directly with the farmer.",
    "Check produce before paying. Meet in a public place where possible.",
  ] },
  { title: "Credits and advertising", items: [
    "You earn credits when a donor confirms a collection with the receiver's code.",
    "Credits can only be spent on advertising campaigns. They have no cash value.",
    "Sponsored content is always labelled and reviewed by a moderator before it runs.",
  ] },
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="text-3xl font-bold sm:text-4xl">Help &amp; food safety</h1>
        <p className="mt-2 text-brand-muted">Simple rules that keep sharing food safe for everyone.</p>
      </header>
      {SECTIONS.map((s) => (
        <section key={s.title} className="space-y-2">
          <h2 className="text-xl font-bold">{s.title}</h2>
          <ul className="list-disc space-y-1.5 pl-5">{s.items.map((i) => <li key={i}>{i}</li>)}</ul>
        </section>
      ))}
      <p className="text-sm text-brand-muted">Need something else? Use the Report button on any listing, or <Link href="/login" className="underline">log in</Link> to contact a moderator through a report.</p>
    </div>
  );
}
