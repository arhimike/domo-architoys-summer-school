import markdownIt from "markdown-it";

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
  web3d: "3D и веб",
  "data-ai": "Данные и ИИ",
  publish: "Публикация и авторство",
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
