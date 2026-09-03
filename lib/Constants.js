export const COLORS = {
  navy: "#0E2A52",
  royal: "#1D5FA8",
  sky: "#4FA8DC",
  paper: "#F6F7FB",
  ink: "#16213A",
  slate: "#5B6B84",
  live: "#2F8F5B",
  alert: "#B34A4A",
  hair: "rgba(14,42,82,0.12)",
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
