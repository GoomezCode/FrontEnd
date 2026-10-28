import { escapeAttr, escapeHtml } from "./utils.js";

const CODE_MARK = "\u0000";

function sanitizeUrl(url) {
  const value = String(url ?? "").trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (/^mailto:/i.test(value)) return value;
  if (value.startsWith("#")) return value;
  return null;
}

function inline(raw) {
  let text = escapeHtml(raw);
  const codes = [];

  text = text.replace(/`([^`]+)`/g, (_match, code) => {
    codes.push(code);
    return `${CODE_MARK}${codes.length - 1}${CODE_MARK}`;
  });

  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label, url) => {
    const safe = sanitizeUrl(url);
    if (!safe) return label;
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });

  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  text = text.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  text = text.replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>");
  text = text.replace(/~~([^~]+)~~/g, "<del>$1</del>");

  text = text.replace(new RegExp(`${CODE_MARK}(\\d+)${CODE_MARK}`, "g"), (_match, index) => {
    return `<code>${codes[Number(index)]}</code>`;
  });

  return text;
}

function isBlockStart(line) {
  return (
    /^\s*```/.test(line) ||
    /^(#{1,6})\s+/.test(line) ||
    /^\s*([-*_])(\s*\1){2,}\s*$/.test(line) ||
    /^\s*>\s?/.test(line) ||
    /^\s*[-*+]\s+/.test(line) ||
    /^\s*\d+[.)]\s+/.test(line)
  );
}

function splitRow(line) {
  let text = String(line).trim();
  if (text.startsWith("|")) text = text.slice(1);
  if (text.endsWith("|")) text = text.slice(0, -1);
  return text.split("|").map((cell) => cell.trim());
}

function isTableStart(lines, index) {
  const head = lines[index] ?? "";
  const separator = lines[index + 1] ?? "";
  if (!head.includes("|")) return false;
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(separator);
}

function tableToHtml(header, alignments, rows) {
  const alignFor = (index) => alignments[index] || "left";
  const head = header
    .map((cell, index) => `<th style="text-align:${alignFor(index)}">${inline(cell)}</th>`)
    .join("");
  const body = rows
    .map(
      (row) =>
        `<tr>${header
          .map(
            (_cell, index) =>
              `<td style="text-align:${alignFor(index)}">${inline(row[index] ?? "")}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");

  return (
    `<div class="table-wrap"><table><thead><tr>${head}</tr></thead>` +
    (body ? `<tbody>${body}</tbody>` : "") +
    `</table></div>`
  );
}

function alignmentsFrom(separatorCells) {
  return separatorCells.map((cell) => {
    const value = cell.trim();
    const left = value.startsWith(":");
    const right = value.endsWith(":");
    if (left && right) return "center";
    if (right) return "right";
    return "left";
  });
}

export function renderMarkdown(source) {
  const text = String(source ?? "").replace(/\r\n?/g, "\n");
  const lines = text.split("\n");
  const html = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    const fence = /^\s*```(.*)$/.exec(line);
    if (fence) {
      const language = fence[1].trim();
      const codeLines = [];
      index += 1;
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      index = Math.min(index + 1, lines.length);

      const code = codeLines.join("\n");
      html.push(
        `<div class="code-block">` +
          `<div class="code-block__head"><span>${escapeHtml(language || "código")}</span>` +
          `<button type="button" class="code-copy" data-code="${escapeAttr(code)}">Copiar</button></div>` +
          `<pre><code${language ? ` class="language-${escapeAttr(language)}"` : ""}>${escapeHtml(code)}</code></pre>` +
          `</div>`,
      );
      continue;
    }

    if (/^\s*$/.test(line)) {
      index += 1;
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = Math.min(6, heading[1].length + 2);
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      html.push("<hr>");
      index += 1;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quote = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^\s*>\s?/, ""));
        index += 1;
      }
      html.push(`<blockquote>${quote.map((item) => `<p>${inline(item)}</p>`).join("")}</blockquote>`);
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*+]\s+/, ""));
        index += 1;
      }
      html.push(`<ul>${items.map((item) => `<li>${inline(item)}</li>`).join("")}</ul>`);
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+[.)]\s+/, ""));
        index += 1;
      }
      html.push(`<ol>${items.map((item) => `<li>${inline(item)}</li>`).join("")}</ol>`);
      continue;
    }

    if (isTableStart(lines, index)) {
      const header = splitRow(lines[index]);
      const alignments = alignmentsFrom(splitRow(lines[index + 1]));
      index += 2;

      const rows = [];
      while (index < lines.length && !/^\s*$/.test(lines[index]) && lines[index].includes("|")) {
        rows.push(splitRow(lines[index]));
        index += 1;
      }

      html.push(tableToHtml(header, alignments, rows));
      continue;
    }

    const paragraph = [];
    while (index < lines.length && !/^\s*$/.test(lines[index]) && !isBlockStart(lines[index])) {
      paragraph.push(lines[index]);
      index += 1;
    }

    if (paragraph.length) {
      html.push(`<p>${paragraph.map(inline).join("<br>")}</p>`);
    }
  }

  return html.join("\n");
}
