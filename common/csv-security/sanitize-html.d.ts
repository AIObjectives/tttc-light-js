declare module "sanitize-html" {
  interface IOptions {
    allowedTags?: string[];
    allowedAttributes?: { [key: string]: string[] } | {};
    textFilter?: (text: string, tagName: string) => string;
  }

  function sanitizeHtml(html: string, options?: IOptions): string;
  export = sanitizeHtml;
}
