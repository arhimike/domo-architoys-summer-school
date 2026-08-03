import markdownIt from "markdown-it";
import fs from "node:fs";
import path from "node:path";

const markdown = markdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: false,
});

const monthNames = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

const glossaryCategories = {
  product: "Продукт и интерфейс",
  geometry: "Параметры и геометрия",
  web3d: "Цифровые модели и веб",
  "data-ai": "Данные и ИИ",
  publish: "Публикация и авторство",
};

const imageDimensionCache = new Map();
const sourceRoot = path.resolve("src");

const readImageDimensions = (value = "") => {
  const source = String(value).split(/[?#]/, 1)[0];
  if (!source.startsWith("/assets/")) return null;
  if (imageDimensionCache.has(source)) return imageDimensionCache.get(source);

  const filePath = path.resolve(sourceRoot, source.replace(/^\/+/, ""));
  if (!filePath.startsWith(`${sourceRoot}${path.sep}`) || !fs.existsSync(filePath)) return null;

  const buffer = fs.readFileSync(filePath);
  let dimensions = null;

  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    dimensions = { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  } else if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    const startOfFrameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
    let offset = 2;

    while (offset + 8 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }

      const marker = buffer[offset + 1];
      offset += 2;
      if (marker === 0xd8 || marker === 0xd9) continue;
      if (offset + 2 > buffer.length) break;

      const segmentLength = buffer.readUInt16BE(offset);
      if (segmentLength < 2 || offset + segmentLength > buffer.length) break;
      if (startOfFrameMarkers.has(marker)) {
        dimensions = { width: buffer.readUInt16BE(offset + 5), height: buffer.readUInt16BE(offset + 3) };
        break;
      }
      offset += segmentLength;
    }
  }

  imageDimensionCache.set(source, dimensions);
  return dimensions;
};

const normalizeDate = (value) => {
  if (value instanceof Date) return value;
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
};

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/admin": "admin" });
  eleventyConfig.addPassthroughCopy({ "node_modules/decap-cms/dist/decap-cms.js": "admin/decap-cms.js" });

  eleventyConfig.addFilter("markdown", (value = "") => markdown.render(String(value)));
  eleventyConfig.addFilter("inlineMarkdown", (value = "") => markdown.renderInline(String(value)));
  eleventyConfig.addFilter("imageDimensions", readImageDimensions);
  eleventyConfig.addFilter("visiblePhotos", (items = []) => items.filter((item) => item?.visible !== false));
  eleventyConfig.addFilter("sortedDays", (items = []) => [...items].sort((a, b) => String(a.data.day_number).localeCompare(String(b.data.day_number), "ru", { numeric: true })));
  eleventyConfig.addFilter("publishedDays", (items = []) => [...items]
    .filter((item) => item?.data?.published)
    .sort((a, b) => String(a.data.day_number).localeCompare(String(b.data.day_number), "ru", { numeric: true })));
  eleventyConfig.addFilter("latestPublishedDay", (items = []) => {
    const sorted = [...items].sort((a, b) => String(a.data.day_number).localeCompare(String(b.data.day_number), "ru", { numeric: true }));
    return [...sorted].reverse().find((item) => item?.data?.published) || sorted[0] || null;
  });
  eleventyConfig.addFilter("sortedGlossary", (items = []) => [...items].sort((a, b) => {
    const orderDifference = Number(a?.data?.order || 0) - Number(b?.data?.order || 0);
    return orderDifference || String(a?.data?.title || "").localeCompare(String(b?.data?.title || ""), "ru");
  }));
  eleventyConfig.addFilter("glossaryCategoryLabel", (value = "") => glossaryCategories[value] || String(value));
  eleventyConfig.addFilter("dayNavigation", (items = [], currentDay = "") => {
    const sorted = [...items]
      .filter((item) => item?.data?.published)
      .sort((a, b) => String(a.data.day_number).localeCompare(String(b.data.day_number), "ru", { numeric: true }));
    const index = sorted.findIndex((item) => String(item.data.day_number) === String(currentDay));
    return {
      previous: index > 0 ? sorted[index - 1].data : null,
      next: index >= 0 && index < sorted.length - 1 ? sorted[index + 1].data : null,
    };
  });
  eleventyConfig.addFilter("pad2", (value) => String(value).padStart(2, "0"));
  eleventyConfig.addFilter("roman", (value) => ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][Number(value) - 1] || String(value));
  eleventyConfig.addFilter("dateRu", (value) => {
    const date = normalizeDate(value);
    if (!date) return "—";
    return `${date.getUTCDate()} ${monthNames[date.getUTCMonth()]}`;
  });
  eleventyConfig.addFilter("dateIso", (value) => {
    const date = normalizeDate(value);
    return date ? date.toISOString().slice(0, 10) : "";
  });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "_site",
    },
    templateFormats: ["njk", "md", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
