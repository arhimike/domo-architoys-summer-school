const fs = require("node:fs");
const path = require("node:path");
const matter = require("gray-matter");
const parse5 = require("parse5");
const YAML = require("yaml");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "_site");
const source = path.join(root, "src");
const errors = [];
const warnings = [];

const assert = (condition, message) => {
  if (!condition) errors.push(message);
};

const walk = (node, callback) => {
  callback(node);
  for (const child of node.childNodes || []) walk(child, callback);
  if (node.content) walk(node.content, callback);
};

const attributes = (node) => Object.fromEntries((node.attrs || []).map(({ name, value }) => [name, value]));

const resolveLocalTarget = (htmlFile, rawUrl) => {
  if (!rawUrl || /^(?:[a-z]+:|\/\/|#)/i.test(rawUrl)) return null;
  const cleanUrl = rawUrl.split("#")[0].split("?")[0];
  if (!cleanUrl) return null;
  let target = cleanUrl.startsWith("/")
    ? path.join(output, cleanUrl.slice(1))
    : path.resolve(path.dirname(htmlFile), cleanUrl);
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, "index.html");
  if (!fs.existsSync(target) && path.extname(target) === "") target = path.join(target, "index.html");
  return target;
};

const expectedPhotos = [];

const adminConfigPath = path.join(source, "admin", "config.yml");
const adminConfig = YAML.parse(fs.readFileSync(adminConfigPath, "utf8"));
assert(adminConfig.backend?.name === "github", "Админка должна использовать прямой GitHub backend.");
assert(adminConfig.backend?.name !== "git-gateway", "Устаревший Git Gateway не должен использоваться.");
assert(adminConfig.media_folder === "src/assets/photos/uploads", "Папка загрузки фотографий в CMS настроена неверно.");
const daysCollection = adminConfig.collections?.find((collection) => collection.name === "days");
assert(Boolean(daysCollection), "В CMS отсутствует коллекция дней.");
assert(daysCollection?.fields?.some((field) => field.name === "gallery"), "В CMS отсутствует редактор галереи.");
if (String(adminConfig.backend?.repo || "").includes("REPLACE_WITH_GITHUB_OWNER")) {
  warnings.push("GitHub-репозиторий ещё не указан — это последний шаг перед включением входа в /admin/.");
}

const dayFiles = fs.readdirSync(path.join(source, "days"))
  .filter((name) => /^day-\d{2}\.md$/.test(name))
  .sort();
assert(dayFiles.length === 10, `Ожидалось 10 файлов дней, найдено ${dayFiles.length}.`);

const dayEntries = dayFiles.map((file) => ({ file, data: matter.read(path.join(source, "days", file)).data }));
dayEntries.forEach(({ file, data }, index) => {
  const number = String(index + 1).padStart(2, "0");
  assert(data.day_number === number, `${file}: неверный номер дня.`);
  assert(data.slug === `day-${number}`, `${file}: неверный адрес страницы.`);
});

const dayOne = dayEntries[0].data;
assert(dayOne.published === true, "Первый день должен быть опубликован.");
assert(dayOne.projects?.[0]?.author === "Коллективная идея", "Проект 01 должен быть подписан «Коллективная идея».");
assert(dayOne.projects?.[4]?.author === "Роза", "Автор проекта 05 должен быть указан как Роза.");
assert(dayOne.projects?.[4]?.title === "Метр на метр", "Проект 05 должен называться «Метр на метр».");
assert(dayOne.gallery?.length === 0, "В первом дне пока не должно быть фотографий.");

const photoDirectory = path.join(source, "assets", "photos", "uploads");
const sourcePhotos = fs.readdirSync(photoDirectory).filter((name) => /\.jpe?g$/i.test(name)).sort();
assert(JSON.stringify(sourcePhotos) === JSON.stringify(expectedPhotos), "В исходниках пока не должно быть фотографий.");

const requiredBuildFiles = ["index.html", "day-01/index.html", "admin/index.html", "admin/config.yml", "admin/decap-cms.js", "404.html"];
for (const file of requiredBuildFiles) assert(fs.existsSync(path.join(output, file)), `В сборке отсутствует ${file}.`);
assert(!fs.existsSync(path.join(output, "day-02", "index.html")), "Черновик второго дня не должен быть опубликован.");

const htmlFiles = ["index.html", "day-01/index.html", "admin/index.html", "404.html"].map((file) => path.join(output, file));
let dayCardCount = 0;
let galleryItemCount = 0;

for (const htmlFile of htmlFiles) {
  const html = fs.readFileSync(htmlFile, "utf8");
  assert(!html.includes("IMG_2707.MOV"), `${path.relative(output, htmlFile)}: видео не должно публиковаться.`);
  const document = parse5.parse(html);

  walk(document, (node) => {
    const attrs = attributes(node);
    const classes = String(attrs.class || "").split(/\s+/).filter(Boolean);
    if (classes.includes("day-card")) dayCardCount += 1;
    if (classes.includes("photo-item")) galleryItemCount += 1;

    if (node.nodeName === "img") {
      assert(typeof attrs.alt === "string", `${path.relative(output, htmlFile)}: у изображения отсутствует alt.`);
    }

    for (const attribute of ["src", "href", "data-full"]) {
      const target = resolveLocalTarget(htmlFile, attrs[attribute]);
      if (target) assert(fs.existsSync(target), `${path.relative(output, htmlFile)}: не найден ресурс ${attrs[attribute]}.`);
    }
  });
}

assert(dayCardCount === 10, `На главной должно быть 10 карточек дней, найдено ${dayCardCount}.`);
assert(galleryItemCount === 0, `Фотоотчёт должен быть пустым, найдено карточек: ${galleryItemCount}.`);

const builtPhotos = fs.readdirSync(path.join(output, "assets", "photos", "uploads"))
  .filter((name) => /\.jpe?g$/i.test(name))
  .sort();
assert(JSON.stringify(builtPhotos) === JSON.stringify(expectedPhotos), "В публичную сборку не должны попадать фотографии.");

if (errors.length) {
  console.error(`QA: найдено ошибок — ${errors.length}`);
  errors.forEach((message) => console.error(`- ${message}`));
  process.exitCode = 1;
} else {
  console.log("QA: сборка, контент, ссылки и отсутствие фотографий проверены.");
  warnings.forEach((message) => console.log(`Внимание: ${message}`));
}
