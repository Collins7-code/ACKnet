export const COLORS = {
  navy: "var(--c-navy)",
  royal: "var(--c-royal)",
  sky: "var(--c-sky)",
  paper: "var(--c-paper)",
  ink: "var(--c-ink)",
  slate: "var(--c-slate)",
  live: "var(--c-live)",
  alert: "var(--c-alert)",
  hair: "var(--c-hair)",
};

export const SERIF = "Georgia, 'Iowan Old Style', Palatino, 'Palatino Linotype', serif";
export const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif";

export const PROGRAMMES = [
  { id: "science", name: "General Science", color: "#1D5FA8", blurb: "Biology, Chemistry, Physics & Elective Maths" },
  { id: "business", name: "Business", color: "#0E2A52", blurb: "Accounting, Costing, Business Management & Economics" },
  { id: "arts", name: "General Arts", color: "#4FA8DC", blurb: "Literature, Government, History & Christian Religious Studies" },
  { id: "visual", name: "Visual Arts", color: "#7B5EA7", blurb: "Graphic Design, Picture Making, Sculpture & Ceramics" },
  { id: "homeec", name: "Home Economics", color: "#B3792F", blurb: "Foods & Nutrition, Management in Living, Textiles" },
];

export function findProgramme(id) {
  return PROGRAMMES.find((p) => p.id === id) || null;
}
