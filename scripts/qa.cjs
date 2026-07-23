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
const removedMaterials = [
  "assets/materials/domo-architoys-intro-cards.pdf",
  "assets/materials/architoys-day-01-slides-2026-07-20.pdf",
];

const siteData = JSON.parse(fs.readFileSync(path.join(source, "_data", "site.json"), "utf8"));
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
assert(longreadsCollection?.files?.some((file) => file.name === "day_04_full"), "В CMS отсутствует каталог инструментов четвёртого дня.");
assert(longreadsCollection?.files?.some((file) => file.name === "day_05_full"), "В CMS отсутствует методика MVP пятого дня.");
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
assert(dayFive.projects?.length === 5, "В пятом дне должно быть пять проектных MVP-срезов.");
assert(dayFive.projects?.[4]?.title === "Archi Helper", "В пятом дне неверно назван проект Розы.");
assert(dayFive.gallery?.length === 0, "В пятом дне пока не должно быть фотографий.");
assert(dayFive.full_report_url === "/day-05/full/", "В пятом дне отсутствует ссылка на методику MVP.");
assert(dayFive.projects_eyebrow === "Предлагаемое сужение задачи", "В пятом дне не отделено проектное задание от отчёта.");

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
assert(dayFiveLongread.content.includes("## Пять проектных MVP-срезов"), "В методике пятого дня отсутствуют MVP-срезы проектов.");
assert(dayFiveLongread.content.includes("## Паспорт MVP"), "В методике пятого дня отсутствует паспорт MVP.");
assert(dayFiveLongread.content.includes("## Методическая рамка и источники"), "В методике пятого дня отсутствуют проверяемые источники.");

const photoDirectory = path.join(source, "assets", "photos", "uploads");
const sourcePhotos = fs.readdirSync(photoDirectory).filter((name) => /\.jpe?g$/i.test(name)).sort();
assert(JSON.stringify(sourcePhotos) === JSON.stringify(expectedPhotos), "В исходниках пока не должно быть фотографий.");

const requiredBuildFiles = ["index.html", "it-symbols/index.html", "day-01/index.html", "day-01/full/index.html", "day-02/index.html", "day-02/full/index.html", "day-03/index.html", "day-03/full/index.html", "day-04/index.html", "day-04/full/index.html", "day-05/index.html", "day-05/full/index.html", "admin/index.html", "admin/config.yml", "admin/decap-cms.js", "404.html"];
for (const file of requiredBuildFiles) assert(fs.existsSync(path.join(output, file)), `В сборке отсутствует ${file}.`);
for (const file of removedMaterials) assert(!fs.existsSync(path.join(output, file)), `Удалённый материал всё ещё попал в сборку: ${file}.`);

const htmlFiles = ["index.html", "it-symbols/index.html", "day-01/index.html", "day-01/full/index.html", "day-02/index.html", "day-02/full/index.html", "day-03/index.html", "day-03/full/index.html", "day-04/index.html", "day-04/full/index.html", "day-05/index.html", "day-05/full/index.html", "admin/index.html", "404.html"].map((file) => path.join(output, file));
let dayCardCount = 0;
let galleryItemCount = 0;
let glossaryCardCount = 0;

for (const htmlFile of htmlFiles) {
  const html = fs.readFileSync(htmlFile, "utf8");
  assert(!html.includes("IMG_2707.MOV"), `${path.relative(output, htmlFile)}: видео не должно публиковаться.`);
  const document = parse5.parse(html);

  walk(document, (node) => {
    const attrs = attributes(node);
    const classes = String(attrs.class || "").split(/\s+/).filter(Boolean);
    if (classes.includes("day-card")) dayCardCount += 1;
    if (classes.includes("photo-item")) galleryItemCount += 1;
    if (classes.includes("glossary-card")) {
      glossaryCardCount += 1;
      assert(String(attrs["data-search"] || "").length >= 20, `${path.relative(output, htmlFile)}: у карточки словаря отсутствует управляемый поисковый индекс.`);
    }

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
assert(glossaryCardCount === glossaryEntries.length, `Число карточек словаря (${glossaryCardCount}) не совпадает с числом терминов (${glossaryEntries.length}).`);

const builtHome = fs.readFileSync(path.join(output, "index.html"), "utf8");
const builtGlossary = fs.readFileSync(path.join(output, "it-symbols", "index.html"), "utf8");
const assetVersion = String(siteData.assetVersion || "").trim();
assert(/^\d{8}-\d+$/.test(assetVersion), "Версия CSS и JavaScript отсутствует или имеет неверный формат.");
for (const html of [builtHome, builtGlossary]) {
  assert(html.includes(`/assets/styles.css?v=${assetVersion}`), "CSS подключён без актуальной версии для сброса кэша.");
  assert(html.includes(`/assets/script.js?v=${assetVersion}`), "JavaScript подключён без актуальной версии для сброса кэша.");
}
assert(builtHome.includes('href="/it-symbols/"'), "На главной отсутствует ссылка на IT-словарь.");
assert(builtHome.includes("Архитекторы проектируют и создают цифровые инструменты"), "На главной отсутствует манифест IT-словаря.");
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
assert(builtDayFive.includes("Планируемый результат"), "В пятом дне не обозначен планируемый характер итогов.");
assert(builtDayFiveLongread.includes("От идеи к MVP: как остановить разрастание прототипа"), "На странице методики пятого дня отсутствует заголовок.");
assert(builtDayFiveLongread.includes("Взаимное тестирование"), "В методике пятого дня отсутствует сценарий проверки.");

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
