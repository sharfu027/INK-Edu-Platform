// Minimal markdown to HTML for chat rendering (no external dep).
export function mdToHtml(md = "") {
  let html = md;

  // Escape HTML
  html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Code fences ```lang\n...\n```
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (_m, _l, code) => {
    return `<pre><code>${code.replace(/\n$/, "")}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");

  // Headings
  html = html.replace(/^### (.*)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.*)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.*)$/gm, "<h2>$1</h2>");

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Italic
  html = html.replace(/(^|\s)\*(?!\s)([^*\n]+?)\*/g, "$1<em>$2</em>");

  // Lists
  html = html.replace(/(^|\n)([-*] .+(?:\n[-*] .+)*)/g, (_m, pre, block) => {
    const items = block
      .split("\n")
      .map((l) => l.replace(/^[-*] /, "").trim())
      .map((t) => `<li>${t}</li>`)
      .join("");
    return `${pre}<ul>${items}</ul>`;
  });
  html = html.replace(/(^|\n)(\d+\. .+(?:\n\d+\. .+)*)/g, (_m, pre, block) => {
    const items = block
      .split("\n")
      .map((l) => l.replace(/^\d+\. /, "").trim())
      .map((t) => `<li>${t}</li>`)
      .join("");
    return `${pre}<ol>${items}</ol>`;
  });

  // Paragraphs (split by double newline)
  html = html
    .split(/\n{2,}/)
    .map((p) => {
      if (/^\s*<(h\d|ul|ol|pre)/.test(p)) return p;
      return `<p>${p.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("\n");

  return html;
}
