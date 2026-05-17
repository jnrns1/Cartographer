/**
 * Minimal Atlassian Document Format builders (brief 12.2, 17.3). Pure data;
 * shared by the Jira issue creator and the Confluence publisher. Code blocks
 * use the `cfml` language hint; renderers that do not know it fall back to
 * plain text, which is acceptable (DECISIONS.md).
 */
export interface AdfNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: AdfNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

export interface AdfDoc {
  version: 1;
  type: "doc";
  content: AdfNode[];
}

export const text = (s: string): AdfNode => ({ type: "text", text: s });

export const strong = (s: string): AdfNode => ({
  type: "text",
  text: s,
  marks: [{ type: "strong" }],
});

export const link = (s: string, href: string): AdfNode => ({
  type: "text",
  text: s,
  marks: [{ type: "link", attrs: { href } }],
});

export const paragraph = (...inline: AdfNode[]): AdfNode => ({
  type: "paragraph",
  content: inline.length ? inline : [text("")],
});

export const heading = (level: number, s: string): AdfNode => ({
  type: "heading",
  attrs: { level },
  content: [text(s)],
});

export const codeBlock = (language: string, code: string): AdfNode => ({
  type: "codeBlock",
  attrs: { language },
  content: [text(code)],
});

export const bulletList = (items: AdfNode[][]): AdfNode => ({
  type: "bulletList",
  content: items.map((inline) => ({
    type: "listItem",
    content: [paragraph(...inline)],
  })),
});

function cell(kind: "tableHeader" | "tableCell", s: string): AdfNode {
  return { type: kind, content: [paragraph(text(s))] };
}

export const table = (headers: string[], rows: string[][]): AdfNode => ({
  type: "table",
  attrs: { isNumberColumnEnabled: false, layout: "default" },
  content: [
    {
      type: "tableRow",
      content: headers.map((h) => cell("tableHeader", h)),
    },
    ...rows.map((r) => ({
      type: "tableRow",
      content: r.map((c) => cell("tableCell", c)),
    })),
  ],
});

export const doc = (...content: AdfNode[]): AdfDoc => ({
  version: 1,
  type: "doc",
  content,
});
