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

const expectedPhotos = [
  "day-10-after-defense.jpg",
  "day-10-andrey-city-lens.jpg",
  "day-10-dmitry-presentation.jpg",
  "day-10-roza-archi-helper.jpg",
  "day-10-tatyana-com-play.jpg",
  "day-10-tatyana-interview-01.jpg",
  "day-10-tatyana-interview-02.jpg",
  "day-10-tatyana-outdoor-01.jpg",
  "day-10-tatyana-outdoor-02.jpg",
];
const expectedDayTenVideos = [
  "andrey-polushin-interview.jpg",
  "andrey-polushin-interview.mp4",
  "dmitry-sakharov-interview.jpg",
  "dmitry-sakharov-interview.mp4",
  "tatyana-ovchinnikova-interview.jpg",
  "tatyana-ovchinnikova-interview.mp4",
];
const removedMaterials = [
  "assets/materials/domo-architoys-intro-cards.pdf",
  "assets/materials/architoys-day-01-slides-2026-07-20.pdf",
];

const siteData = JSON.parse(fs.readFileSync(path.join(source, "_data", "site.json"), "utf8"));
const studentProjects = JSON.parse(fs.readFileSync(path.join(source, "_data", "studentProjects.json"), "utf8"));
assert(studentProjects.projects?.length === 6, `На странице учеников должно быть шесть проектов, найдено ${studentProjects.projects?.length || 0}.`);
const studentProjectUrls = new Set();
for (const [index, project] of (studentProjects.projects || []).entries()) {
  const expectedOrder = String(index + 1).padStart(2, "0");
  assert(project.order === expectedOrder, `У проекта ${project.title || expectedOrder} неверный порядковый номер.`);
  assert(typeof project.author === "string" && project.author.trim().length >= 3, `У проекта ${expectedOrder} не указан автор.`);
  assert(typeof project.title === "string" && project.title.trim().length >= 3, `У проекта ${expectedOrder} отсутствует название.`);
  assert(typeof project.description === "string" && project.description.trim().length >= 80, `У проекта ${project.title || expectedOrder} слишком короткое описание.`);
  assert(/^https:\/\//.test(project.url || ""), `У проекта ${project.title || expectedOrder} отсутствует публичная HTTPS-ссылка.`);
  assert(!studentProjectUrls.has(project.url), `Ссылка ${project.url} повторяется на странице учеников.`);
  studentProjectUrls.add(project.url);
  const screenshotPath = path.join(source, String(project.screenshot || "").replace(/^\//, ""));
  assert(fs.existsSync(screenshotPath), `У проекта ${project.title || expectedOrder} не найден скриншот ${project.screenshot}.`);
  assert(typeof project.screenshotAlt === "string" && project.screenshotAlt.trim().length >= 30, `У проекта ${project.title || expectedOrder} отсутствует описание скриншота.`);
  assert(Array.isArray(project.tags) && project.tags.length >= 3, `У проекта ${project.title || expectedOrder} должно быть не меньше трёх меток.`);
}
const adminConfigPath = path.join(source, "admin", "config.yml");
const adminConfig = YAML.parse(fs.readFileSync(adminConfigPath, "utf8"));
assert(adminConfig.backend?.name === "github", "Админка должна использовать прямой GitHub backend.");
assert(adminConfig.backend?.name !== "git-gateway", "Устаревший Git Gateway не должен использоваться.");
assert(adminConfig.media_folder === "src/assets/photos/uploads", "Папка загрузки фотографий в CMS настроена неверно.");
const daysCollection = adminConfig.collections?.find((collection) => collection.name === "days");
assert(Boolean(daysCollection), "В CMS отсутствует коллекция дней.");
assert(daysCollection?.fields?.some((field) => field.name === "gallery"), "В CMS отсутствует редактор галереи.");
assert(daysCollection?.fields?.some((field) => field.name === "interviews"), "В CMS отсутствует редактор интервью.");
const longreadsCollection = adminConfig.collections?.find((collection) => collection.name === "longreads");
assert(Boolean(longreadsCollection), "В CMS отсутствует раздел полных текстов.");
assert(longreadsCollection?.files?.some((file) => file.name === "day_01_full"), "В CMS отсутствует полный текст первого дня.");
assert(longreadsCollection?.files?.some((file) => file.name === "day_02_full"), "В CMS отсутствует полный текст второго дня.");
assert(longreadsCollection?.files?.some((file) => file.name === "day_03_full"), "В CMS отсутствует методический материал третьего дня.");
assert(longreadsCollection?.files?.some((file) => file.name === "day_04_full"), "В CMS отсутствует каталог инструментов четвёртого дня.");
assert(longreadsCollection?.files?.some((file) => file.name === "day_05_full"), "В CMS отсутствует методика MVP пятого дня.");
assert(longreadsCollection?.files?.some((file) => file.name === "day_08_full"), "В CMS отсутствует методика SPACE//TIME восьмого дня.");
const glossaryCollection = adminConfig.collections?.find((collection) => collection.name === "glossary");
assert(Boolean(glossaryCollection), "В CMS отсутствует IT-словарь.");
assert(glossaryCollection?.folder === "src/glossary", "В CMS неверно настроена папка IT-словаря.");
assert(glossaryCollection?.create === true, "В CMS должно быть разрешено добавление терминов.");
assert(glossaryCollection?.delete === false, "Базовые термины словаря не должны удаляться через CMS.");
assert(glossaryCollection?.fields?.some((field) => field.name === "architecture_analogy"), "В редакторе IT-словаря отсутствует поле архитектурной аналогии.");
assert(glossaryCollection?.fields?.some((field) => field.name === "memory_hook"), "В редакторе IT-словаря отсутствует поле подсказки для памяти.");
assert(glossaryCollection?.fields?.some((field) => field.name === "sources"), "В IT-словаре отсутствует поле источников и документации.");
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

const dayFour = dayEntries[3].data;
assert(dayFour.published === true, "Четвёртый день должен быть опубликован.");
assert(dayFour.date === "2026-07-23", "У четвёртого дня неверная дата.");
assert(dayFour.title === "Браузер как архитектурная лаборатория", "У четвёртого дня неверный заголовок.");
assert(dayFour.projects?.length === 6, "В четвёртом дне должно быть шесть наборов инструментов.");
assert(dayFour.gallery?.length === 0, "В четвёртом дне пока не должно быть фотографий.");
assert(dayFour.full_report_url === "/day-04/full/", "В четвёртом дне отсутствует ссылка на каталог инструментов.");

const dayFive = dayEntries[4].data;
assert(dayFive.published === true, "Пятый день должен быть опубликован.");
assert(dayFive.date === "2026-07-24", "У пятого дня неверная дата.");
assert(dayFive.title === "От идеи к MVP", "У пятого дня неверный заголовок.");
assert(dayFive.projects?.length === 6, "В пятом дне должно быть шесть проектных MVP-срезов.");
assert(dayFive.projects?.[4]?.title === "Archi Helper", "В пятом дне неверно назван проект Розы.");
assert(dayFive.projects?.[5]?.author === "Татьяна Овчинникова", "В пятом дне отсутствует новый проект Татьяны Овчинниковой.");
assert(dayFive.projects?.[5]?.title.includes("ОПК Lab"), "В пятом дне неверно назван проект Татьяны.");
assert(dayFive.gallery?.length === 0, "В пятом дне пока не должно быть фотографий.");
assert(dayFive.full_report_url === "/day-05/full/", "В пятом дне отсутствует ссылка на методику MVP.");
assert(dayFive.projects_eyebrow === "Предлагаемое сужение задачи", "В пятом дне не отделено проектное задание от отчёта.");

const dayEight = dayEntries[7].data;
assert(dayEight.published === true, "Восьмой день должен быть опубликован.");
assert(dayEight.date === "2026-07-28", "У восьмого дня неверная дата.");
assert(dayEight.title === "Пространство во времени", "У восьмого дня неверный заголовок.");
assert(dayEight.projects?.length === 6, "В восьмом дне должно быть шесть временных моделей.");
assert(dayEight.full_report_url === "/day-08/full/", "В восьмом дне отсутствует ссылка на методику SPACE//TIME.");

const dayTen = dayEntries[9].data;
assert(dayTen.published === true, "Десятый день должен быть опубликован.");
assert(dayTen.date === "2026-07-30", "У десятого дня неверная дата.");
assert(dayTen.gallery?.length === 8, "В фотоотчёте десятого дня должно быть восемь фотографий.");
assert(dayTen.interviews?.length === 3, "В десятом дне должно быть три интервью.");
assert(dayTen.interviews?.every((item) => item.video && item.poster), "У каждого интервью десятого дня должны быть видео и обложка.");

const glossaryDirectory = path.join(source, "glossary");
const glossaryFiles = fs.readdirSync(glossaryDirectory)
  .filter((name) => name.endsWith(".md"))
  .sort();
assert(glossaryFiles.length >= 40, `В IT-словаре должно быть не меньше 40 базовых терминов, найдено ${glossaryFiles.length}.`);
const glossaryCategories = new Set(["product", "geometry", "web3d", "data-ai", "publish"]);
const glossaryEntries = glossaryFiles.map((file) => ({ file, data: matter.read(path.join(glossaryDirectory, file)).data }));
const glossaryOrders = new Set();
const glossarySlugs = new Set();
glossaryEntries.forEach(({ file, data }) => {
  assert(Number.isInteger(data.order) && data.order >= 1, `${file}: неверный порядковый номер.`);
  assert(!glossaryOrders.has(data.order), `${file}: порядковый номер ${data.order} повторяется.`);
  glossaryOrders.add(data.order);
  assert(typeof data.title === "string" && data.title.trim().length > 1, `${file}: отсутствует русский термин.`);
  assert(typeof data.english === "string" && data.english.trim().length > 1, `${file}: отсутствует английский эквивалент.`);
  assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug || ""), `${file}: неверный slug.`);
  assert(!glossarySlugs.has(data.slug), `${file}: slug ${data.slug} повторяется.`);
  glossarySlugs.add(data.slug);
  assert(glossaryCategories.has(data.category), `${file}: неизвестная категория ${data.category}.`);
  assert(typeof data.definition === "string" && data.definition.length >= 40, `${file}: определение слишком короткое.`);
  assert(typeof data.architecture_analogy === "string" && data.architecture_analogy.length >= 40, `${file}: отсутствует перевод на язык архитектора.`);
  assert(typeof data.architecture_example === "string" && data.architecture_example.length >= 30, `${file}: отсутствует архитектурный пример.`);
  assert(typeof data.memory_hook === "string" && data.memory_hook.length >= 20, `${file}: отсутствует подсказка для памяти.`);
  assert(Array.isArray(data.sources) && data.sources.length >= 1, `${file}: отсутствует источник или документация.`);
  for (const item of data.sources || []) {
    assert(typeof item.label === "string" && item.label.trim().length > 3, `${file}: источник не подписан.`);
    assert(/^https:\/\//.test(item.url || ""), `${file}: ссылка на источник должна начинаться с https://.`);
  }
});

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

const dayFourLongreadPath = path.join(source, "longreads", "day-04-full.md");
assert(fs.existsSync(dayFourLongreadPath), "В исходниках отсутствует каталог инструментов четвёртого дня.");
const dayFourLongread = fs.existsSync(dayFourLongreadPath) ? matter.read(dayFourLongreadPath) : { data: {}, content: "" };
assert(dayFourLongread.data.permalink === "day-04/full/index.html", "У каталога инструментов четвёртого дня неверный адрес.");
assert(dayFourLongread.content.includes("## Карта ролей"), "В каталоге четвёртого дня отсутствует карта ролей.");
assert(dayFourLongread.content.includes("## 12. Что соединить в проектах школы"), "В каталоге четвёртого дня отсутствуют связки для проектов школы.");

const dayFiveLongreadPath = path.join(source, "longreads", "day-05-full.md");
assert(fs.existsSync(dayFiveLongreadPath), "В исходниках отсутствует методика MVP пятого дня.");
const dayFiveLongread = fs.existsSync(dayFiveLongreadPath) ? matter.read(dayFiveLongreadPath) : { data: {}, content: "" };
assert(dayFiveLongread.data.permalink === "day-05/full/index.html", "У методики MVP пятого дня неверный адрес.");
assert(dayFiveLongread.content.includes("## Как запускается проект в DØMO ARCHITOYS"), "В методике пятого дня отсутствует общий маршрут запуска проекта.");
assert(dayFiveLongread.content.includes("## Шесть проектных MVP-срезов"), "В методике пятого дня отсутствуют MVP-срезы проектов.");
assert(dayFiveLongread.content.includes("### 06. Татьяна Овчинникова — «ОПК Lab»"), "В методике пятого дня отсутствует кейс Татьяны Овчинниковой.");
assert(dayFiveLongread.content.includes("## Паспорт MVP"), "В методике пятого дня отсутствует паспорт MVP.");
assert(dayFiveLongread.content.includes("## Методическая рамка и источники"), "В методике пятого дня отсутствуют проверяемые источники.");

const dayEightLongreadPath = path.join(source, "longreads", "day-08-full.md");
assert(fs.existsSync(dayEightLongreadPath), "В исходниках отсутствует методика SPACE//TIME восьмого дня.");
const dayEightLongread = fs.existsSync(dayEightLongreadPath) ? matter.read(dayEightLongreadPath) : { data: {}, content: "" };
assert(dayEightLongread.data.permalink === "day-08/full/index.html", "У методики SPACE//TIME неверный адрес.");
assert(dayEightLongread.content.includes("## Паспорт сценария"), "В методике SPACE//TIME отсутствует паспорт сценария.");
assert(dayEightLongread.content.includes("## Взаимная проверка"), "В методике SPACE//TIME отсутствует взаимная проверка.");

const photoDirectory = path.join(source, "assets", "photos", "uploads");
const sourcePhotos = fs.readdirSync(photoDirectory).filter((name) => /\.jpe?g$/i.test(name)).sort();
assert(JSON.stringify(sourcePhotos) === JSON.stringify(expectedPhotos), "Набор фотографий десятого дня в исходниках отличается от утверждённого.");

const requiredBuildFiles = ["index.html", "projects/index.html", "it-symbols/index.html", "galaxy/index.html", "day-01/index.html", "day-01/full/index.html", "day-02/index.html", "day-02/full/index.html", "day-03/index.html", "day-03/full/index.html", "day-04/index.html", "day-04/full/index.html", "day-05/index.html", "day-05/full/index.html", "day-08/index.html", "day-08/full/index.html", "day-10/index.html", "admin/index.html", "admin/config.yml", "admin/decap-cms.js", "404.html"];
for (const file of requiredBuildFiles) assert(fs.existsSync(path.join(output, file)), `В сборке отсутствует ${file}.`);
for (const file of removedMaterials) assert(!fs.existsSync(path.join(output, file)), `Удалённый материал всё ещё попал в сборку: ${file}.`);

const homeHtml = fs.readFileSync(path.join(output, "index.html"), "utf8");
assert(homeHtml.includes('href="/galaxy/"'), "В навигации отсутствует внутренняя ссылка на галактику инструментов.");
assert(homeHtml.includes("Галактика инструментов"), "В навигации отсутствует пункт «Галактика инструментов».");

const htmlFiles = ["index.html", "projects/index.html", "it-symbols/index.html", "galaxy/index.html", "day-01/index.html", "day-01/full/index.html", "day-02/index.html", "day-02/full/index.html", "day-03/index.html", "day-03/full/index.html", "day-04/index.html", "day-04/full/index.html", "day-05/index.html", "day-05/full/index.html", "day-08/index.html", "day-08/full/index.html", "day-10/index.html", "admin/index.html", "404.html"].map((file) => path.join(output, file));
let dayCardCount = 0;
let galleryItemCount = 0;
let glossaryCardCount = 0;
let studentProjectCardCount = 0;
let interviewCardCount = 0;
let videoElementCount = 0;
let galaxyCardCount = 0;

for (const htmlFile of htmlFiles) {
  const html = fs.readFileSync(htmlFile, "utf8");
  assert(!html.includes("IMG_2707.MOV"), `${path.relative(output, htmlFile)}: видео не должно публиковаться.`);
  const document = parse5.parse(html);

  walk(document, (node) => {
    const attrs = attributes(node);
    const classes = String(attrs.class || "").split(/\s+/).filter(Boolean);
    if (classes.includes("day-card")) dayCardCount += 1;
    if (classes.includes("photo-item")) galleryItemCount += 1;
    if (classes.includes("student-project-card")) studentProjectCardCount += 1;
    if (classes.includes("interview-card")) interviewCardCount += 1;
    if (classes.includes("galaxy-card")) galaxyCardCount += 1;
    if (classes.includes("glossary-card")) {
      glossaryCardCount += 1;
      assert(String(attrs["data-search"] || "").length >= 20, `${path.relative(output, htmlFile)}: у карточки словаря отсутствует управляемый поисковый индекс.`);
    }

    if (node.nodeName === "img") {
      assert(typeof attrs.alt === "string", `${path.relative(output, htmlFile)}: у изображения отсутствует alt.`);
    }
    if (node.nodeName === "video") {
      videoElementCount += 1;
      assert(Object.hasOwn(attrs, "controls"), `${path.relative(output, htmlFile)}: у интервью отсутствуют элементы управления.`);
      assert(attrs.preload === "metadata", `${path.relative(output, htmlFile)}: интервью должно загружать только метаданные до запуска.`);
      assert(typeof attrs.poster === "string" && attrs.poster.length > 0, `${path.relative(output, htmlFile)}: у интервью отсутствует обложка.`);
    }

    for (const attribute of ["src", "href", "data-full", "poster"]) {
      const target = resolveLocalTarget(htmlFile, attrs[attribute]);
      if (target) assert(fs.existsSync(target), `${path.relative(output, htmlFile)}: не найден ресурс ${attrs[attribute]}.`);
    }
  });
}

assert(dayCardCount === 10, `На главной должно быть 10 карточек дней, найдено ${dayCardCount}.`);
assert(galleryItemCount === 8, `В фотоотчёте десятого дня должно быть восемь карточек, найдено: ${galleryItemCount}.`);
assert(glossaryCardCount === glossaryEntries.length, `Число карточек словаря (${glossaryCardCount}) не совпадает с числом терминов (${glossaryEntries.length}).`);
assert(studentProjectCardCount === studentProjects.projects.length, `Число карточек проектов (${studentProjectCardCount}) не совпадает с данными (${studentProjects.projects.length}).`);
assert(interviewCardCount === 3, `На странице десятого дня должно быть три карточки интервью, найдено: ${interviewCardCount}.`);
assert(videoElementCount === 3, `На странице десятого дня должно быть три видеоплеера, найдено: ${videoElementCount}.`);
assert(galaxyCardCount === 42, `В галактике должно быть 42 сигнала, найдено: ${galaxyCardCount}.`);

const builtHome = fs.readFileSync(path.join(output, "index.html"), "utf8");
const builtProjects = fs.readFileSync(path.join(output, "projects", "index.html"), "utf8");
const builtGlossary = fs.readFileSync(path.join(output, "it-symbols", "index.html"), "utf8");
const builtGalaxy = fs.readFileSync(path.join(output, "galaxy", "index.html"), "utf8");
const assetVersion = String(siteData.assetVersion || "").trim();
assert(/^\d{8}-\d+$/.test(assetVersion), "Версия CSS и JavaScript отсутствует или имеет неверный формат.");
for (const html of [builtHome, builtProjects, builtGlossary, builtGalaxy]) {
  assert(html.includes(`/assets/styles.css?v=${assetVersion}`), "CSS подключён без актуальной версии для сброса кэша.");
  assert(html.includes(`/assets/script.js?v=${assetVersion}`), "JavaScript подключён без актуальной версии для сброса кэша.");
}
assert(builtHome.includes('href="/it-symbols/"'), "На главной отсутствует ссылка на IT-словарь.");
assert(builtHome.includes('href="/projects/"'), "На главной отсутствует ссылка на страницу учеников.");
assert(builtGalaxy.includes("Вопрос 42"), "В галактике отсутствует связующий сигнал «Вопрос 42».");
assert(builtGalaxy.includes("data-galaxy-search"), "В галактике отсутствует поиск.");
assert(builtGalaxy.includes("data-galaxy-random"), "В галактике отсутствует случайный скачок.");
assert(builtGalaxy.includes("Михаил Корси"), "В галактике отсутствует авторство Михаила Корси.");
assert(!builtGalaxy.includes("Линия вдохновения"), "В паспортах галактики остался служебный блок источников.");
const galaxyPassports = builtGalaxy.match(/<div class="galaxy-passport"[\s\S]*?<\/template>/g) || [];
assert(galaxyPassports.length === 42, `В сборке должно быть 42 паспорта инструментов, найдено: ${galaxyPassports.length}.`);
assert(galaxyPassports.every((passport) => !/<a\b/i.test(passport)), "В паспортах галактики остались внешние ссылки.");
assert(builtHome.includes("Архитекторы проектируют и создают цифровые инструменты"), "На главной отсутствует манифест IT-словаря.");
assert(builtHome.includes("Восемь этапов разработки проекта в школе"), "На главной отсутствует общий маршрут разработки проекта.");
assert(builtProjects.includes("Ученики<br><em>и их</em><br>проекты"), "На странице учеников отсутствует главный заголовок.");
assert(builtProjects.includes("Татьяна Овчинникова"), "На странице проектов отсутствует COM-PLAY Татьяны Овчинниковой.");
assert(builtProjects.includes("Антон Христов"), "На странице проектов отсутствует RUIN MAKER Антона Христова.");
assert(builtProjects.includes("Дмитрий Сахаров"), "На странице проектов отсутствует проект Дмитрия Сахарова.");
assert(builtProjects.includes("Андрей Полушин"), "На странице проектов отсутствует CITY//LENS Андрея Полушина.");
assert(builtProjects.includes("Варвара Безрукова"), "На странице проектов отсутствует FORMA AI Варвары Безруковой.");
assert(builtProjects.includes("roza-ai-d0mo.netlify.app"), "На странице проектов отсутствует подробная версия проекта Розы.");
assert(builtProjects.includes("aria-current=\"page\">Ученики</a>"), "В навигации страницы учеников отсутствует активное состояние.");
assert(builtGlossary.includes("data-glossary-search"), "В IT-словаре отсутствует поиск.");
assert(builtGlossary.includes("Авторство и атрибуция"), "IT-словарь выглядит неполным.");
assert(builtGlossary.includes("Основные символы кода"), "В IT-словаре отсутствует раздел символов кода.");
assert(builtGlossary.includes("Поисковые слова"), "В карточках словаря не выводятся поисковые слова и сокращения.");
assert(builtGlossary.includes("На языке архитектора"), "В карточках словаря отсутствуют архитектурные аналогии.");
assert(builtGlossary.includes("В реальном проекте"), "В карточках словаря отсутствуют практические примеры.");
assert(builtGlossary.includes("финал_последний_правда"), "В словаре отсутствуют подсказки для памяти с лёгким профессиональным юмором.");
assert(builtGlossary.includes(">MVP<"), "Поиск словаря не сможет найти распространённое сокращение MVP.");

const builtDayOne = fs.readFileSync(path.join(output, "day-01", "index.html"), "utf8");
const builtLongread = fs.readFileSync(path.join(output, "day-01", "full", "index.html"), "utf8");
assert(builtDayOne.includes('href="/day-01/full/"'), "На странице первого дня отсутствует кнопка полного отчёта.");
assert(!builtDayOne.includes("domo-architoys-intro-cards.pdf"), "На странице первого дня осталась ссылка на подготовительную презентацию.");
assert(!builtDayOne.includes("architoys-day-01-slides-2026-07-20.pdf"), "На странице первого дня осталась ссылка на презентацию занятия.");
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

const builtDayFour = fs.readFileSync(path.join(output, "day-04", "index.html"), "utf8");
const builtDayFourLongread = fs.readFileSync(path.join(output, "day-04", "full", "index.html"), "utf8");
assert(builtDayFour.includes('href="/day-04/full/"'), "На странице четвёртого дня отсутствует кнопка каталога инструментов.");
assert(builtDayFour.includes("Шесть наборов деталей"), "На странице четвёртого дня отсутствует структура инструментов.");
assert(builtDayFourLongread.includes("JavaScript-конструктор архитектора"), "На странице каталога четвёртого дня отсутствует заголовок.");
assert(builtDayFourLongread.includes("Практическое задание четвёртого дня"), "На странице каталога четвёртого дня отсутствует практическое задание.");

const builtDayFive = fs.readFileSync(path.join(output, "day-05", "index.html"), "utf8");
const builtDayFiveLongread = fs.readFileSync(path.join(output, "day-05", "full", "index.html"), "utf8");
assert(builtDayFive.includes('href="/day-05/full/"'), "На странице пятого дня отсутствует кнопка методики MVP.");
assert(builtDayFive.includes("Предлагаемое сужение задачи"), "Пятый день выглядит как отчёт о ещё не состоявшихся результатах.");
assert(builtDayFive.includes("Результат дня"), "В пятом дне отсутствует раздел с результатом занятия.");
assert(builtDayFive.includes("Татьяна Овчинникова"), "На странице пятого дня отсутствует новый проект Татьяны.");
assert(builtDayFiveLongread.includes("От идеи к MVP: как остановить разрастание прототипа"), "На странице методики пятого дня отсутствует заголовок.");
assert(builtDayFiveLongread.includes("Как запускается проект в DØMO ARCHITOYS"), "В методике пятого дня отсутствует общее объяснение процесса школы.");
assert(builtDayFiveLongread.includes("ОПК Lab"), "В методике пятого дня отсутствует подробный кейс Татьяны.");
assert(builtDayFiveLongread.includes("Взаимное тестирование"), "В методике пятого дня отсутствует сценарий проверки.");

const builtDayEight = fs.readFileSync(path.join(output, "day-08", "index.html"), "utf8");
const builtDayEightLongread = fs.readFileSync(path.join(output, "day-08", "full", "index.html"), "utf8");
assert(builtDayEight.includes('href="/day-08/full/"'), "На странице восьмого дня отсутствует кнопка методики SPACE//TIME.");
assert(builtDayEight.includes("Шесть временных моделей"), "На странице восьмого дня отсутствует конструктор времени.");
assert(builtDayEightLongread.includes("SPACE//TIME: пространство как последовательность состояний"), "На странице методики восьмого дня отсутствует заголовок.");
assert(builtDayEightLongread.includes("Паспорт сценария"), "На странице методики восьмого дня отсутствует паспорт сценария.");

const builtDayTen = fs.readFileSync(path.join(output, "day-10", "index.html"), "utf8");
assert(builtDayTen.includes("Защиты проектов первого набора"), "На странице десятого дня отсутствует фотоотчёт о защитах.");
assert(builtDayTen.includes("Интервью после защиты"), "На странице десятого дня отсутствует раздел интервью.");
assert(builtDayTen.includes("Андрей Полушин — после защиты CITY//LENS"), "На странице десятого дня отсутствует интервью Андрея Полушина.");
assert(builtDayTen.includes("Дмитрий Сахаров — после защиты"), "На странице десятого дня отсутствует интервью Дмитрия Сахарова.");
assert(builtDayTen.includes("Татьяна Овчинникова — после защиты COM-PLAY"), "На странице десятого дня отсутствует интервью Татьяны Овчинниковой.");
assert(builtDayTen.includes("Скоро · следующий набор →"), "Внизу десятого дня отсутствует переход к следующему набору.");
assert(builtDayTen.includes(">Зарегистрироваться на следующий набор</b>"), "Внизу десятого дня отсутствует призыв к регистрации.");
assert(builtDayTen.includes(`href="${siteData.registrationUrl}"`), "Ссылка на регистрацию внизу десятого дня отличается от общей ссылки сайта.");

const builtPhotos = fs.readdirSync(path.join(output, "assets", "photos", "uploads"))
  .filter((name) => /\.jpe?g$/i.test(name))
  .sort();
assert(JSON.stringify(builtPhotos) === JSON.stringify(expectedPhotos), "Набор фотографий в публичной сборке отличается от утверждённого.");

const builtDayTenVideos = fs.readdirSync(path.join(output, "assets", "videos", "day-10")).sort();
assert(JSON.stringify(builtDayTenVideos) === JSON.stringify(expectedDayTenVideos), "Набор интервью десятого дня в публичной сборке отличается от утверждённого.");

if (errors.length) {
  console.error(`QA: найдено ошибок — ${errors.length}`);
  errors.forEach((message) => console.error(`- ${message}`));
  process.exitCode = 1;
} else {
  console.log("QA: сборка, контент, ссылки, фотоотчёт и интервью десятого дня проверены.");
  warnings.forEach((message) => console.log(`Внимание: ${message}`));
}
