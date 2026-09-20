import { describe, it, expect } from 'vitest';
import {
  markdownToTextile,
  textileToMarkdown,
} from '../../src/utils/textileConverter.js';

describe('Textile <-> Markdown Converter', () => {
  describe('markdownToTextile', () => {
    describe('Headings', () => {
      it('should convert Markdown headings (# to ######) to Textile (h1. to h6.)', () => {
        const md = [
          '# Heading 1',
          '## Heading 2',
          '### Heading 3',
          '#### Heading 4',
          '##### Heading 5',
          '###### Heading 6',
        ].join('\n');

        const expected = [
          'h1. Heading 1',
          'h2. Heading 2',
          'h3. Heading 3',
          'h4. Heading 4',
          'h5. Heading 5',
          'h6. Heading 6',
        ].join('\n');

        expect(markdownToTextile(md)).toBe(expected);
      });

      it('should not convert # in the middle of a line', () => {
        const md = 'This is issue #123 on tracker';
        expect(markdownToTextile(md)).toBe('This is issue #123 on tracker');
      });
    });

    describe('Text Formatting', () => {
      it('should convert bold (**text** or __text__) to Textile (*text*)', () => {
        expect(markdownToTextile('**bold text**')).toBe('*bold text*');
        expect(markdownToTextile('__bold text__')).toBe('*bold text*');
      });

      it('should convert italics (*text*) to Textile (_text_)', () => {
        expect(markdownToTextile('*italic text*')).toBe('_italic text_');
      });

      it('should convert strikethrough (~~text~~) to Textile (-text-)', () => {
        expect(markdownToTextile('~~deleted text~~')).toBe('-deleted text-');
      });

      it('should handle mixed formatting in a single paragraph', () => {
        const md = 'This has **bold**, *italic*, and ~~strike~~ in one line.';
        const expected = 'This has *bold*, _italic_, and -strike- in one line.';
        expect(markdownToTextile(md)).toBe(expected);
      });

      it('should not break snake_case identifiers as italics', () => {
        const md = 'Check variable user_profile_id and account_balance';
        expect(markdownToTextile(md)).toBe('Check variable user_profile_id and account_balance');
      });
    });

    describe('Code Blocks and Inline Code', () => {
      it('should convert inline code (`code`) to Textile (@code@)', () => {
        expect(markdownToTextile('Use `npm test` to run tests')).toBe(
          'Use @npm test@ to run tests'
        );
      });

      it('should convert fenced code blocks with language to Textile pre/code', () => {
        const md = [
          '```typescript',
          'const x: number = 42;',
          '# comment',
          '```',
        ].join('\n');
        const expected = [
          '<pre><code class="typescript">',
          'const x: number = 42;',
          '# comment',
          '</code></pre>',
        ].join('\n');
        expect(markdownToTextile(md)).toBe(expected);
      });

      it('should convert fenced code blocks without language to Textile pre/code', () => {
        const md = [
          '```',
          'plain code block',
          '```',
        ].join('\n');
        const expected = [
          '<pre><code>',
          'plain code block',
          '</code></pre>',
        ].join('\n');
        expect(markdownToTextile(md)).toBe(expected);
      });

      it('should preserve markdown syntax inside code blocks without converting', () => {
        const md = [
          '```markdown',
          '# Heading inside code',
          '**not bold**',
          '[link](http://test)',
          '```',
        ].join('\n');
        const expected = [
          '<pre><code class="markdown">',
          '# Heading inside code',
          '**not bold**',
          '[link](http://test)',
          '</code></pre>',
        ].join('\n');
        expect(markdownToTextile(md)).toBe(expected);
      });

      it('should preserve markdown syntax inside inline code', () => {
        const md = 'Use `# Not A Heading` and `**not bold**` inline';
        expect(markdownToTextile(md)).toBe(
          'Use @# Not A Heading@ and @**not bold**@ inline'
        );
      });
    });

    describe('Links', () => {
      it('should convert Markdown links [text](url) to Textile "text":url', () => {
        expect(markdownToTextile('[Redmine](https://www.redmine.org)')).toBe(
          '"Redmine":https://www.redmine.org'
        );
      });

      it('should convert relative links', () => {
        expect(markdownToTextile('[Issue 123](/issues/123)')).toBe(
          '"Issue 123":/issues/123'
        );
      });

      it('should preserve URLs with underscores in Markdown', () => {
        const md = '[API Documentation](https://example.com/api_v1_reference)';
        expect(markdownToTextile(md)).toBe('"API Documentation":https://example.com/api_v1_reference');
      });
    });

    describe('Lists', () => {
      it('should convert unordered lists (*, -, +) to Textile * item', () => {
        const md = [
          '* Item A',
          '* Item B',
          '- Item C',
          '+ Item D',
        ].join('\n');
        const expected = [
          '* Item A',
          '* Item B',
          '* Item C',
          '* Item D',
        ].join('\n');
        expect(markdownToTextile(md)).toBe(expected);
      });

      it('should convert nested unordered lists to Textile ** item', () => {
        const md = [
          '* Parent',
          '  * Child',
          '    * Grandchild',
        ].join('\n');
        const expected = [
          '* Parent',
          '** Child',
          '*** Grandchild',
        ].join('\n');
        expect(markdownToTextile(md)).toBe(expected);
      });

      it('should convert ordered lists (1. item) to Textile # item', () => {
        const md = [
          '1. Step one',
          '2. Step two',
          '3. Step three',
        ].join('\n');
        const expected = [
          '# Step one',
          '# Step two',
          '# Step three',
        ].join('\n');
        expect(markdownToTextile(md)).toBe(expected);
      });

      it('should convert nested ordered lists to Textile ## item', () => {
        const md = [
          '1. First',
          '   1. Sub first',
          '   2. Sub second',
        ].join('\n');
        const expected = [
          '# First',
          '## Sub first',
          '## Sub second',
        ].join('\n');
        expect(markdownToTextile(md)).toBe(expected);
      });
    });

    describe('Blockquotes', () => {
      it('should convert Markdown blockquotes (> text) to Textile (bq. text)', () => {
        expect(markdownToTextile('> Important note')).toBe('bq. Important note');
      });

      it('should convert multiple blockquote lines', () => {
        const md = [
          '> Line 1',
          '> Line 2',
        ].join('\n');
        const expected = [
          'bq. Line 1',
          'bq. Line 2',
        ].join('\n');
        expect(markdownToTextile(md)).toBe(expected);
      });
    });

    describe('Edge cases', () => {
      it('should handle empty or whitespace string', () => {
        expect(markdownToTextile('')).toBe('');
        expect(markdownToTextile('   ')).toBe('   ');
      });

      it('should handle undefined or non-string input gracefully', () => {
        // @ts-expect-error testing invalid inputs
        expect(markdownToTextile(null)).toBe('');
        // @ts-expect-error testing invalid inputs
        expect(markdownToTextile(undefined)).toBe('');
      });
    });
  });

  describe('textileToMarkdown', () => {
    describe('Headings', () => {
      it('should convert Textile headings (h1. to h6.) to Markdown (# to ######)', () => {
        const textile = [
          'h1. Heading 1',
          'h2. Heading 2',
          'h3. Heading 3',
          'h4. Heading 4',
          'h5. Heading 5',
          'h6. Heading 6',
        ].join('\n');

        const expected = [
          '# Heading 1',
          '## Heading 2',
          '### Heading 3',
          '#### Heading 4',
          '##### Heading 5',
          '###### Heading 6',
        ].join('\n');

        expect(textileToMarkdown(textile)).toBe(expected);
      });
    });

    describe('Text Formatting', () => {
      it('should convert bold (*text*) to Markdown (**text**)', () => {
        expect(textileToMarkdown('*bold text*')).toBe('**bold text**');
      });

      it('should convert italics (_text_) to Markdown (*text*)', () => {
        expect(textileToMarkdown('_italic text_')).toBe('*italic text*');
      });

      it('should convert strikethrough (-text-) to Markdown (~~text~~)', () => {
        expect(textileToMarkdown('-deleted text-')).toBe('~~deleted text~~');
      });

      it('should handle mixed formatting in a single paragraph', () => {
        const textile = 'This has *bold*, _italic_, and -strike- in one line.';
        const expected = 'This has **bold**, *italic*, and ~~strike~~ in one line.';
        expect(textileToMarkdown(textile)).toBe(expected);
      });

      it('should not confuse list item * with bold text', () => {
        const textile = '* List item with *bold* text';
        const expected = '* List item with **bold** text';
        expect(textileToMarkdown(textile)).toBe(expected);
      });

      it('should not break snake_case identifiers as italics', () => {
        const textile = 'Check variable user_profile_id and account_balance';
        expect(textileToMarkdown(textile)).toBe('Check variable user_profile_id and account_balance');
      });
    });

    describe('Code Blocks and Inline Code', () => {
      it('should convert inline code (@code@) to Markdown (`code`)', () => {
        expect(textileToMarkdown('Use @npm test@ to run tests')).toBe(
          'Use `npm test` to run tests'
        );
      });

      it('should convert <pre><code class="typescript">...</code></pre> to fenced code blocks', () => {
        const textile = [
          '<pre><code class="typescript">',
          'const x: number = 42;',
          'h1. Not heading',
          '</code></pre>',
        ].join('\n');
        const expected = [
          '```typescript',
          'const x: number = 42;',
          'h1. Not heading',
          '```',
        ].join('\n');
        expect(textileToMarkdown(textile)).toBe(expected);
      });

      it('should convert <pre><code>...</code></pre> to fenced code blocks', () => {
        const textile = [
          '<pre><code>',
          'plain code block',
          '</code></pre>',
        ].join('\n');
        const expected = [
          '```',
          'plain code block',
          '```',
        ].join('\n');
        expect(textileToMarkdown(textile)).toBe(expected);
      });

      it('should convert <pre>...</pre> to fenced code blocks', () => {
        const textile = [
          '<pre>',
          'plain pre block',
          '</pre>',
        ].join('\n');
        const expected = [
          '```',
          'plain pre block',
          '```',
        ].join('\n');
        expect(textileToMarkdown(textile)).toBe(expected);
      });

      it('should preserve Textile syntax inside code blocks without converting', () => {
        const textile = [
          '<pre><code class="textile">',
          'h1. Heading inside code',
          '*not bold*',
          '"link":http://test',
          '</code></pre>',
        ].join('\n');
        const expected = [
          '```textile',
          'h1. Heading inside code',
          '*not bold*',
          '"link":http://test',
          '```',
        ].join('\n');
        expect(textileToMarkdown(textile)).toBe(expected);
      });

      it('should preserve Textile syntax inside inline code', () => {
        const textile = 'Use @h1. Not Heading@ and @*not bold*@ inline';
        expect(textileToMarkdown(textile)).toBe(
          'Use `h1. Not Heading` and `*not bold*` inline'
        );
      });
    });

    describe('Links', () => {
      it('should convert Textile links "text":url to Markdown [text](url)', () => {
        expect(textileToMarkdown('"Redmine":https://www.redmine.org')).toBe(
          '[Redmine](https://www.redmine.org)'
        );
      });

      it('should convert relative links', () => {
        expect(textileToMarkdown('"Issue 123":/issues/123')).toBe(
          '[Issue 123](/issues/123)'
        );
      });

      it('should preserve URLs with underscores in Textile', () => {
        const textile = '"API Documentation":https://example.com/api_v1_reference';
        expect(textileToMarkdown(textile)).toBe('[API Documentation](https://example.com/api_v1_reference)');
      });
    });

    describe('Lists', () => {
      it('should convert single level unordered list (* item) to Markdown * item', () => {
        const textile = [
          '* Item A',
          '* Item B',
        ].join('\n');
        const expected = [
          '* Item A',
          '* Item B',
        ].join('\n');
        expect(textileToMarkdown(textile)).toBe(expected);
      });

      it('should convert nested unordered lists (** item) to indented Markdown lists', () => {
        const textile = [
          '* Parent',
          '** Child',
          '*** Grandchild',
        ].join('\n');
        const expected = [
          '* Parent',
          '  * Child',
          '    * Grandchild',
        ].join('\n');
        expect(textileToMarkdown(textile)).toBe(expected);
      });

      it('should convert single level ordered lists (# item) to Markdown 1. item', () => {
        const textile = [
          '# Step one',
          '# Step two',
          '# Step three',
        ].join('\n');
        const expected = [
          '1. Step one',
          '1. Step two',
          '1. Step three',
        ].join('\n');
        expect(textileToMarkdown(textile)).toBe(expected);
      });

      it('should convert nested ordered lists (## item) to indented Markdown lists', () => {
        const textile = [
          '# First',
          '## Sub first',
          '## Sub second',
        ].join('\n');
        const expected = [
          '1. First',
          '   1. Sub first',
          '   1. Sub second',
        ].join('\n');
        expect(textileToMarkdown(textile)).toBe(expected);
      });
    });

    describe('Blockquotes', () => {
      it('should convert Textile blockquotes (bq. text) to Markdown (> text)', () => {
        expect(textileToMarkdown('bq. Important note')).toBe('> Important note');
      });

      it('should convert multiple blockquote lines', () => {
        const textile = [
          'bq. Line 1',
          'bq. Line 2',
        ].join('\n');
        const expected = [
          '> Line 1',
          '> Line 2',
        ].join('\n');
        expect(textileToMarkdown(textile)).toBe(expected);
      });
    });

    describe('Edge cases', () => {
      it('should handle empty or whitespace string', () => {
        expect(textileToMarkdown('')).toBe('');
        expect(textileToMarkdown('   ')).toBe('   ');
      });

      it('should handle undefined or non-string input gracefully', () => {
        // @ts-expect-error testing invalid inputs
        expect(textileToMarkdown(null)).toBe('');
        // @ts-expect-error testing invalid inputs
        expect(textileToMarkdown(undefined)).toBe('');
      });
    });
  });
});
