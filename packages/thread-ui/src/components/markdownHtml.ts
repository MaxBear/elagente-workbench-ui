import rehypeRaw from 'rehype-raw';
import type { PluggableList } from 'unified';
import rehypeSanitize, { defaultSchema, type Options } from 'rehype-sanitize';

// Parse README HTML into the same React tree as Markdown, so local links and
// images still use our adapters. Sanitize before KaTeX adds its trusted markup.
const schema: Options = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] ?? []).filter(attribute => attribute !== 'align'), ['align', 'left', 'center', 'right']],
    code: [['className', /^language-./, 'math-inline', 'math-display']],
    details: [...(defaultSchema.attributes?.details ?? []), 'open'],
  },
  strip: [...(defaultSchema.strip ?? []), 'style', 'iframe', 'object', 'embed'],
  protocols: {
    ...defaultSchema.protocols,
    // Preserve adapter links and Windows drive paths; the URL transform still
    // rejects non-file drive schemes before any browser anchor is created.
    href: [...(defaultSchema.protocols?.href ?? []), 'file', 'workspace-auto', ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'],
  },
};

export const markdownHtmlPlugins: PluggableList = [rehypeRaw, [rehypeSanitize, schema]];
