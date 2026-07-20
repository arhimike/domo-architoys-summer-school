export default {
  layout: "layouts/day.njk",
  tags: ["days"],
  eleventyComputed: {
    permalink: (data) => data.published ? `${data.slug}/index.html` : false,
  },
};
