// Build ../../black-scholes.html (the gallery exhibit) from page.template.html.
// Typesets every data-tex element with KaTeX, embeds KaTeX's CSS and woff2 fonts,
// and inlines Chart.js and its annotation plugin, so the page needs no network.
// Usage (from anywhere): node src/black-scholes/build.cjs
const fs = require('node:fs');
const path = require('node:path');
const here = __dirname, vendor = file => path.join(here, 'vendor', file);
const output = path.join(here, '..', '..', 'black-scholes.html');
const katex = require(vendor('katex/katex.min.js'));

let html = fs.readFileSync(path.join(here, 'page.template.html'), 'utf8');
let mathCount = 0;
html = html.replace(/<(span|div)([^>]*\bdata-tex="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>/g, (_, tag, attrs, tex) => {
  mathCount++;
  const equation = tex.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
  const rendered = katex.renderToString(equation, { displayMode: attrs.includes('data-display="true"'), throwOnError: true, output: 'htmlAndMathml', strict: 'error', trust: false });
  return `<${tag}${attrs}>${rendered}</${tag}>`;
});

let css = fs.readFileSync(vendor('katex/katex.min.css'), 'utf8');
css = css.replace(/src:url\((fonts\/[^)]+\.woff2)\) format\("woff2"\)[^;}]*/g,
  (_, font) => `src:url(data:font/woff2;base64,${fs.readFileSync(vendor('katex/' + font)).toString('base64')}) format("woff2")`);
if (/url\(fonts\//.test(css)) throw new Error('A KaTeX font was not embedded');
html = html.replace('__KATEX_CSS__', () => css);

for (const [token, file] of [['__CHART_LIBRARY__', 'chart.umd.min.js'], ['__ANNOTATION_LIBRARY__', 'chartjs-plugin-annotation.min.js']])
  html = html.replace(token, () => fs.readFileSync(vendor(file), 'utf8').replaceAll('</script', '<\\/script'));
const license = fs.readFileSync(vendor('katex/LICENSE'), 'utf8');
html = html.replace('</body>', `<!-- KaTeX typesetting and font assets\n${license}\n-->\n</body>`);

const script = html.match(/<script id="dashboard-code">([\s\S]*?)<\/script>/)[1];
new (require('node:vm').Script)(script); // syntax check of the page's own code
fs.writeFileSync(output, html);
console.log(JSON.stringify({ output: path.relative(process.cwd(), output), bytes: Buffer.byteLength(html), typesetEquations: mathCount, embeddedFonts: (css.match(/data:font\/woff2/g) || []).length }));
