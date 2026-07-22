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
const longreadsCollection = adminConfig.collections?.find((collection) => collection.name === "longreads");
assert(Boolean(longreadsCollection), "В CMS отсутствует раздел полных текстов.");
assert(longreadsCollection?.files?.some((file) => file.name === "day_01_full"), "В CMS отсутствует полный текст первого дня.");
assert(longreadsCollection?.files?.some((file) => file.name === "day_02_full"), "В CMS отсутствует полный текст второго дня.");
assert(longreadsCollection?.files?.some((file) => file.name === "day_03_full"), "В CMS отсутствует методический материал третьего дня.");
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
assert(dayOne.full_report_url === "/day-01/full/", "В первом дне отсутствует ссылка на полный отчёт.");

const dayTwo = dayEntries[1].data;
assert(dayTwo.published === true, "Второй день должен быть опубликован.");
assert(dayTwo.date === "2026-07-21", "У второго дня неверная дата.");
assert(dayTwo.projects?.length === 5, "Во втором дне должно быть пять проектных направлений.");
assert(dayTwo.projects?.[4]?.author === "Роза", "Автор проекта 05 второго дня должен быть указан как Роза.");
assert(dayTwo.projects?.[4]?.title === "Archi Helper", "Проект Розы второго дня должен называться Archi Helper.");
assert(dayTwo.projects?.[4]?.links?.length === 2, "У Archi Helper должны быть ссылки на две опубликованные версии.");
assert(dayTwo.projects?.[4]?.links?.[1]?.url === "https://6a60b3d192d2f4e27a9f55f2--precious-madeleine-6aa387.netlify.app/#home", "У Archi Helper неверная ссылка на детализируемую версию.");
assert(dayTwo.gallery?.length === 0, "Во втором дне пока не должно быть фотографий.");
assert(dayTwo.full_report_url === "/day-02/full/", "Во втором дне отсутствует ссылка на пошаговый разбор.");

const dayThree = dayEntries[2].data;
assert(dayThree.published === true, "Третий день должен быть опубликован.");
assert(dayThree.date === "2026-07-22", "У третьего дня неверная дата.");
assert(dayThree.title === "Архитектура цифрового инструмента", "У третьего дня неверный заголовок.");
assert(dayThree.projects?.length === 5, "В третьем дне должно быть пять методических слоёв.");
assert(dayThree.gallery?.length === 0, "В третьем дне пока не должно быть фотографий.");
assert(dayThree.full_report_url === "/day-03/full/", "В третьем дне отсутствует ссылка на методический материал.");

const longreadPath = path.join(source, "longreads", "day-01-full.md");
assert(fs.existsSync(longreadPath), "В исходниках отсутствует полный текст первого дня.");
const longread = fs.existsSync(longreadPath) ? matter.read(longreadPath) : { data: {}, content: "" };
assert(longread.data.permalink === "day-01/full/index.html", "У полного текста первого дня неверный адрес.");
assert(longread.content.includes("## Главный итог"), "Полный текст первого дня выглядит неполным.");

const dayTwoLongreadPath = path.join(source, "longreads", "day-02-full.md");
assert(fs.existsSync(dayTwoLongreadPath), "В исходниках отсутствует полный текст второго дня.");
const dayTwoLongread = fs.existsSync(dayTwoLongreadPath) ? matter.read(dayTwoLongreadPath) : { data: {}, content: "" };
assert(dayTwoLongread.data.permalink === "day-02/full/index.html", "У полного текста второго дня неверный адрес.");
assert(dayTwoLongread.content.includes("## Пошаговая логика пяти инструментов"), "В полном тексте второго дня отсутствуют пошаговые маршруты.");
assert(dayTwoLongread.content.includes("### 05. Роза — Archi Helper"), "В полном тексте второго дня неверно назван проект Розы.");

const dayThreeLongreadPath = path.join(source, "longreads", "day-03-full.md");
assert(fs.existsSync(dayThreeLongreadPath), "В исходниках отсутствует методический материал третьего дня.");
const dayThreeLongread = fs.existsSync(dayThreeLongreadPath) ? matter.read(dayThreeLongreadPath) : { data: {}, content: "" };
assert(dayThreeLongread.data.permalink === "day-03/full/index.html", "У методического материала третьего дня неверный адрес.");
assert(dayThreeLongread.content.includes("## Шаг 4. Составить техническое задание"), "В материале третьего дня отсутствует структура технического задания.");
assert(dayThreeLongread.content.includes("## Возможности и статус функций"), "В материале третьего дня не разделены готовые и перспективные функции.");

const photoDirectory = path.join(source, "assets", "photos", "uploads");
const sourcePhotos = fs.readdirSync(photoDirectory).filter((name) => /\.jpe?g$/i.test(name)).sort();
assert(JSON.stringify(sourcePhotos) === JSON.stringify(expectedPhotos), "В исходниках пока не должно быть фотографий.");

const requiredBuildFiles = ["index.html", "day-01/index.html", "day-01/full/index.html", "day-02/index.html", "day-02/full/index.html", "day-03/index.html", "day-03/full/index.html", "admin/index.html", "admin/config.yml", "admin/decap-cms.js", "404.html"];
for (const file of requiredBuildFiles) assert(fs.existsSync(path.join(output, file)), `В сборке отсутствует ${file}.`);
assert(!fs.existsSync(path.join(output, "day-04", "index.html")), "Черновик четвёртого дня не должен быть опубликован.");

const htmlFiles = ["index.html", "day-01/index.html", "day-01/full/index.html", "day-02/index.html", "day-02/full/index.html", "day-03/index.html", "day-03/full/index.html", "admin/index.html", "404.html"].map((file) => path.join(output, file));
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

const builtDayOne = fs.readFileSync(path.join(output, "day-01", "index.html"), "utf8");
const builtLongread = fs.readFileSync(path.join(output, "day-01", "full", "index.html"), "utf8");
assert(builtDayOne.includes('href="/day-01/full/"'), "На странице первого дня отсутствует кнопка полного отчёта.");
assert(builtLongread.includes("От архитектурной идеи к первой рабочей механике"), "На странице полного отчёта отсутствует заголовок.");

const builtDayTwo = fs.readFileSync(path.join(output, "day-02", "index.html"), "utf8");
const builtDayTwoLongread = fs.readFileSync(path.join(output, "day-02", "full", "index.html"), "utf8");
assert(builtDayTwo.includes('href="/day-02/full/"'), "На странице второго дня отсутствует кнопка пошагового разбора.");
assert(builtDayTwo.includes("Archi Helper"), "На странице второго дня отсутствует новое название проекта Розы.");
assert(builtDayTwo.includes("https://archihelper.netlify.app/"), "На странице второго дня отсутствует ссылка на первый вариант Archi Helper.");
assert(builtDayTwoLongread.includes("Самостоятельная работа: от идеи к пользовательскому сценарию"), "На странице полного текста второго дня отсутствует заголовок.");

const builtDayThree = fs.readFileSync(path.join(output, "day-03", "index.html"), "utf8");
const builtDayThreeLongread = fs.readFileSync(path.join(output, "day-03", "full", "index.html"), "utf8");
assert(builtDayThree.includes('href="/day-03/full/"'), "На странице третьего дня отсутствует кнопка методического материала.");
assert(builtDayThree.includes("Пять составляющих архитектуры инструмента"), "На странице третьего дня отсутствует методическая структура.");
assert(builtDayThreeLongread.includes("Архитектура цифрового инструмента: от исследования к браузерному прототипу"), "На странице методического материала третьего дня отсутствует заголовок.");
assert(builtDayThreeLongread.includes("Чек-лист первой рабочей версии"), "На странице методического материала третьего дня отсутствует чек-лист.");

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
