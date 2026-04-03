const fs = require("fs-extra");
const glob = require("glob");

// On scanne tout le dossier src pour être sûr de ne rien rater
const files = glob.sync("src/**/*.{js,jsx,ts,tsx}");

const translations = {};

// Regex améliorée pour capturer le texte entre balises, les placeholders, titres, etc.
const textRegex = />\s*([^<>{}]+?)\s*</g;
const attrRegex = /(placeholder|title|label|value|aria-label)=["']([^"']+)["']/g;

function sanitizeKey(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

files.forEach((file) => {
  const content = fs.readFileSync(file, "utf8");

  let match;

  // 1. Extraire le texte entre balises HTML/React
  while ((match = textRegex.exec(content))) {
    const text = match[1].trim();
    // Filtres pour éviter de capturer du code, des nombres seuls ou des symboles
    if (
      text.length > 1 &&
      !text.match(/^[0-9.,\s%€$:\-\/]+$/) && 
      !text.includes("import ") &&
      !text.includes("export ") &&
      !text.includes("const ") &&
      !text.includes("=>")
    ) {
      const key = sanitizeKey(text);
      if (key && key.length > 1) {
        translations[key] = text;
      }
    }
  }

  // 2. Extraire le texte des attributs (placeholders, labels, etc.)
  while ((match = attrRegex.exec(content))) {
    const text = match[2].trim();
    if (text.length > 1 && !text.match(/^[0-9.,\s%€$:\-\/]+$/)) {
      const key = sanitizeKey(text);
      if (key && key.length > 1) {
        translations[key] = text;
      }
    }
  }
});

const locales = ["fr", "en", "ar"];

locales.forEach((lang) => {
  const dir = `public/locales/${lang}`;
  fs.ensureDirSync(dir);
  const filePath = `${dir}/common.json`;
  
  let existing = {};
  if (fs.existsSync(filePath)) {
    try {
      existing = fs.readJSONSync(filePath);
    } catch (e) {
      existing = {};
    }
  }

  // Fusionner les nouvelles traductions avec les existantes (priorité aux existantes si déjà traduites)
  const merged = { ...translations, ...existing };
  
  // Trier par clé pour plus de lisibilité
  const sorted = Object.keys(merged)
    .sort()
    .reduce((acc, key) => {
      acc[key] = merged[key];
      return acc;
    }, {});

  fs.writeJSONSync(filePath, sorted, { spaces: 2 });
});

console.log(`✅ Extraction terminée : ${Object.keys(translations).length} textes trouvés.`);
console.log("✅ Fichiers mis à jour dans public/locales/{fr,en,ar}/common.json");