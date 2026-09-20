/**
 * Redmine Textile <-> Markdown Converter
 *
 * Provides safe bi-directional conversion between Markdown and Textile formatting
 * for Redmine issue descriptions and journal notes without external heavy dependencies.
 */

export function markdownToTextile(md: string): string {
  if (!md || typeof md !== 'string') {
    return md ?? '';
  }

  const codeBlocks: string[] = [];
  const inlineCodes: string[] = [];

  let result = md;

  // 1. Protect code blocks
  result = result.replace(
    /```([a-zA-Z0-9_+-]*)\r?\n([\s\S]*?)\r?\n```/g,
    (_, lang, code) => {
      const langAttr = lang ? ` class="${lang}"` : '';
      const textileBlock = `<pre><code${langAttr}>\n${code}\n</code></pre>`;
      const index = codeBlocks.length;
      codeBlocks.push(textileBlock);
      return `%%CODEBLOCK_${index}%%`;
    }
  );

  // 2. Protect inline code
  result = result.replace(/`([^`\n]+)`/g, (_, code) => {
    const textileInline = `@${code}@`;
    const index = inlineCodes.length;
    inlineCodes.push(textileInline);
    return `%%INLINECODE_${index}%%`;
  });

  // 3. Process line by line for block-level elements
  const lines = result.split('\n');
  const convertedLines = lines.map((line) => {
    // 3.1 Headings (# to ######)
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      return `h${level}. ${convertInlineMarkdown(text)}`;
    }

    // 3.2 Blockquotes (> text)
    const bqMatch = line.match(/^>\s?(.*)$/);
    if (bqMatch) {
      const text = bqMatch[1];
      return `bq. ${convertInlineMarkdown(text)}`;
    }

    // 3.3 Ordered list (1. item)
    const olMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (olMatch) {
      const indentLen = olMatch[1].length;
      const depth = indentLen === 0 ? 1 : Math.floor(indentLen / 2) + 1;
      const text = olMatch[2];
      return `${'#'.repeat(depth)} ${convertInlineMarkdown(text)}`;
    }

    // 3.4 Unordered list (*, -, + item)
    const ulMatch = line.match(/^(\s*)[*+-]\s+(.*)$/);
    if (ulMatch) {
      const indentLen = ulMatch[1].length;
      const depth = indentLen === 0 ? 1 : Math.floor(indentLen / 2) + 1;
      const text = ulMatch[2];
      return `${'*'.repeat(depth)} ${convertInlineMarkdown(text)}`;
    }

    // Normal line
    return convertInlineMarkdown(line);
  });

  result = convertedLines.join('\n');

  // 4. Restore inline code
  result = result.replace(/%%INLINECODE_(\d+)%%/g, (_, idx) => {
    return inlineCodes[Number(idx)];
  });

  // 5. Restore code blocks
  result = result.replace(/%%CODEBLOCK_(\d+)%%/g, (_, idx) => {
    return codeBlocks[Number(idx)];
  });

  return result;
}

function convertInlineMarkdown(text: string): string {
  let str = text;

  // Links: [text](url) -> "text":url
  str = str.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '"$1":$2');

  // Bold: **text** or __text__ -> placeholder
  const boldMatches: string[] = [];
  str = str.replace(/(\*\*|__)(.*?)\1/g, (_, __, content) => {
    const idx = boldMatches.length;
    boldMatches.push(content);
    return `%%BOLD_${idx}%%`;
  });

  // Italics: *text* -> _text_ (must not be part of snake_case like user_id)
  str = str.replace(/(?<=\s|^|[^\w*])\*([^\s*](?:.*?[^\s*])?)\*(?=\s|[^\w*]|$)/g, '_$1_');

  // Strikethrough: ~~text~~ -> -text-
  str = str.replace(/~~(.*?)~~/g, '-$1-');

  // Restore bold to Textile *text*
  str = str.replace(/%%BOLD_(\d+)%%/g, (_, idx) => {
    return `*${boldMatches[Number(idx)]}*`;
  });

  return str;
}

export function textileToMarkdown(textile: string): string {
  if (!textile || typeof textile !== 'string') {
    return textile ?? '';
  }

  const codeBlocks: string[] = [];
  const inlineCodes: string[] = [];

  let result = textile;

  // 1. Protect code blocks: <pre><code class="lang">...</code></pre> or <pre><code>...</code></pre> or <pre>...</pre>
  result = result.replace(
    /<pre><code(?:\s+class="([a-zA-Z0-9_+-]+)")?>\r?\n?([\s\S]*?)\r?\n?<\/code><\/pre>/g,
    (_, lang, code) => {
      const fenceLang = lang || '';
      const mdBlock = `\`\`\`${fenceLang}\n${code}\n\`\`\``;
      const index = codeBlocks.length;
      codeBlocks.push(mdBlock);
      return `%%CODEBLOCK_${index}%%`;
    }
  );

  result = result.replace(
    /<pre>\r?\n?([\s\S]*?)\r?\n?<\/pre>/g,
    (_, code) => {
      const mdBlock = `\`\`\`\n${code}\n\`\`\``;
      const index = codeBlocks.length;
      codeBlocks.push(mdBlock);
      return `%%CODEBLOCK_${index}%%`;
    }
  );

  // 2. Protect inline code: @code@
  result = result.replace(/@([^@\n]+)@/g, (_, code) => {
    const mdInline = `\`${code}\``;
    const index = inlineCodes.length;
    inlineCodes.push(mdInline);
    return `%%INLINECODE_${index}%%`;
  });

  // 3. Process line by line for block-level elements
  const lines = result.split('\n');
  const convertedLines = lines.map((line) => {
    // 3.1 Headings (h1. to h6.)
    const headingMatch = line.match(/^h([1-6])\.\s+(.*)$/);
    if (headingMatch) {
      const level = Number(headingMatch[1]);
      const text = headingMatch[2];
      return `${'#'.repeat(level)} ${convertInlineTextile(text)}`;
    }

    // 3.2 Blockquotes (bq. text)
    const bqMatch = line.match(/^bq\.\s+(.*)$/);
    if (bqMatch) {
      const text = bqMatch[1];
      return `> ${convertInlineTextile(text)}`;
    }

    // 3.3 Ordered list (# item, ## sub)
    const olMatch = line.match(/^(#+)\s+(.*)$/);
    if (olMatch) {
      const depth = olMatch[1].length;
      const indent = ' '.repeat((depth - 1) * 3);
      const text = olMatch[2];
      return `${indent}1. ${convertInlineTextile(text)}`;
    }

    // 3.4 Unordered list (* item, ** sub)
    const ulMatch = line.match(/^(\*+)\s+(.*)$/);
    if (ulMatch) {
      const depth = ulMatch[1].length;
      const indent = ' '.repeat((depth - 1) * 2);
      const text = ulMatch[2];
      return `${indent}* ${convertInlineTextile(text)}`;
    }

    // Normal line
    return convertInlineTextile(line);
  });

  result = convertedLines.join('\n');

  // 4. Restore inline code
  result = result.replace(/%%INLINECODE_(\d+)%%/g, (_, idx) => {
    return inlineCodes[Number(idx)];
  });

  // 5. Restore code blocks
  result = result.replace(/%%CODEBLOCK_(\d+)%%/g, (_, idx) => {
    return codeBlocks[Number(idx)];
  });

  return result;
}

function convertInlineTextile(text: string): string {
  let str = text;

  // Links: "text":url -> [text](url)
  str = str.replace(/"([^"\n]+)":(https?:\/\/[^\s<]+|[^\s<]+)/g, '[$1]($2)');

  // Bold: *text* -> placeholder
  const boldMatches: string[] = [];
  str = str.replace(/(?<=\s|^|[^\w*])\*([^\s*](?:.*?[^\s*])?)\*(?=\s|[^\w*]|$)/g, (_, content) => {
    const idx = boldMatches.length;
    boldMatches.push(content);
    return `%%BOLD_${idx}%%`;
  });

  // Italics: _text_ -> *text* (must not be part of snake_case like user_id)
  str = str.replace(/(?<=\s|^|[^\w_])_([^\s_](?:.*?[^\s_])?)_(?=\s|[^\w_]|$)/g, '*$1*');

  // Strikethrough: -text- -> ~~text~~
  str = str.replace(/(?<=\s|^|[^\w-])-([^\s-](?:.*?[^\s-])?)-(?=\s|[^\w-]|$)/g, '~~$1~~');

  // Restore bold to Markdown **text**
  str = str.replace(/%%BOLD_(\d+)%%/g, (_, idx) => {
    return `**${boldMatches[Number(idx)]}**`;
  });

  return str;
}
