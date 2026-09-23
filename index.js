var fs = require("fs");
var path = require("path");
var Handlebars = require("handlebars");
var moment = require("moment");
var lookup = require("country-code-lookup");

var FONT_MIME = {
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

/**
 * Load Font Awesome CSS and rewrite woff/woff2 font urls to data URIs so
 * rendered HTML works offline (including Puppeteer PDF exports). Legacy
 * eot/ttf/svg formats are dropped — Chromium does not need them.
 */
function loadFontAwesomeCss() {
  var assetsDir = path.join(__dirname, "assets", "font-awesome");
  var fontsDir = path.join(assetsDir, "fonts");
  var css = fs.readFileSync(
    path.join(assetsDir, "font-awesome.min.css"),
    "utf-8"
  );

  // Drop the IE-only first src and legacy format clauses.
  css = css
    .replace(
      /src:url\('\.\.\/fonts\/fontawesome-webfont\.eot\?v=4\.7\.0'\);/,
      ""
    )
    .replace(
      /url\('\.\.\/fonts\/fontawesome-webfont\.eot\?#iefix&v=4\.7\.0'\) format\('embedded-opentype'\),/,
      ""
    )
    .replace(
      /,url\('\.\.\/fonts\/fontawesome-webfont\.ttf\?v=4\.7\.0'\) format\('truetype'\)/,
      ""
    )
    .replace(
      /,url\('\.\.\/fonts\/fontawesome-webfont\.svg\?v=4\.7\.0#fontawesomeregular'\) format\('svg'\)/,
      ""
    );

  return css.replace(
    /url\('\.\.\/fonts\/([^'?#]+)([^']*)'\)/g,
    function (_match, fileName, query) {
      var ext = path.extname(fileName).toLowerCase();
      var mime = FONT_MIME[ext];
      var fontPath = path.join(fontsDir, fileName);
      if (!mime || !fs.existsSync(fontPath)) {
        throw new Error("Missing Font Awesome font file: " + fileName);
      }
      var data = fs.readFileSync(fontPath).toString("base64");
      return "url('data:" + mime + ";base64," + data + query + "')";
    }
  );
}

var render = (resume) => {
  var main_css = fs.readFileSync(__dirname + "/main.css", "utf-8");
  var fontAwesomeCss = loadFontAwesomeCss();
  var tpl = fs.readFileSync(__dirname + "/resume.hbs", "utf-8");

  return Handlebars.compile(tpl)({
    css: main_css,
    fontAwesomeCss: fontAwesomeCss,
    resume: resume,
  });
};

module.exports = {
  render: render,
};

/* HANDLEBARS HELPERS */
Handlebars.registerHelper("paragraphSplit", function (plaintext) {
  var lines = plaintext.split(/\r\n|\r|\n/g);
  var output = "";
  var i;

  for (i = 0; i < lines.length; i += 1) {
    if (lines[i]) {
      output += "<p>" + lines[i] + "</p>";
    }
  }
  return new Handlebars.SafeString(output);
});

Handlebars.registerHelper("toLowerCase", function (str) {
  return str.toLowerCase();
});

Handlebars.registerHelper("spaceToDash", function (str) {
  return str.replace(/\s/g, "-").toLowerCase();
});

Handlebars.registerHelper("toCountryFull", function (countryCode) {
  var result = lookup.byIso(countryCode);

  if (result.country != undefined) {
    return result.country;
  }

  return countryCode;
});

Handlebars.registerHelper("MY", function (date) {
  var d = date.toString();
  return moment(d).format("MMMM YYYY");
});

Handlebars.registerHelper("Y", function (date) {
  var d = date.toString();
  return moment(d).format("YYYY");
});

Handlebars.registerHelper("DMY", function (date) {
  var d = date.toString();
  return moment(d).format("D MMMM YYYY");
});

var humanReadableDuration = (seconds) => {
  var formatUnit = (num, unit) => {
    if (num > 0) {
      return `${num} ${num > 1 ? unit + "s" : unit}`;
    }
    return "";
  };

  var numYears = Math.floor(seconds / 31536000);
  var numDays = Math.floor((seconds % 31536000) / 86400);
  var numMonths = Math.ceil(numDays / 31);
  var yearOutput = formatUnit(numYears, "Year");

  if (yearOutput.length == 0) {
    return formatUnit(numMonths, "Month");
  } else {
    return (
      yearOutput + (numMonths > 0 ? ", " + formatUnit(numMonths, "Month") : "")
    );
  }
};

Handlebars.registerHelper(
  "periodToNow",
  function (startDate, endDate, present) {
    if (present == true) endDate = moment.now();
    var duration = moment.duration(
      moment(moment(endDate)).diff(startDate.toString())
    );
    return humanReadableDuration(duration.asSeconds());
  }
);
