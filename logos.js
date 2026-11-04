// Every option on the ballot. `id` is what gets stored as a vote, so keep it
// in sync with the allowed list in firestore.rules.
export const SETS = [
  { key: "themed", title: "Themed set", note: "Original colors and backgrounds with glow and texture" },
  { key: "contrast", title: "High contrast", note: "Plain backgrounds, outlined emblem, colored frame" },
  { key: "clean", title: "No outline", note: "High contrast with no outline and no frame" },
];

export const KEEP = { id: "keep", name: "Keep the current logo", set: "current" };

const names = [
  "Crimson Blood", "Royal Gold", "Toxic Venom", "Void Nebula", "Frost Shard",
  "Inferno", "Chrome Shadow", "Cyber Neon", "Holy Light", "Storm Lightning",
  "Blood Moon", "Gold on Black", "Black on Gold", "Venom Lime", "Royal Purple",
  "Deep Ice", "Solar Flare", "Red on White", "Navy on Sky", "Cyan on Magenta",
  "Blood Moon", "Gold on Black", "Black on Gold", "Venom Lime", "Royal Purple",
  "Deep Ice", "Solar Flare", "Red on White", "Navy on Sky", "Cyan on Magenta",
];

export const LOGOS = names.map((name, i) => ({
  id: String(i + 1).padStart(2, "0"),
  name,
  set: SETS[Math.floor(i / 10)].key,
}));

export const ALL = [KEEP, ...LOGOS];
