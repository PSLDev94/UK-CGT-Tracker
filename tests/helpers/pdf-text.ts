import {
  decodePDFRawStream,
  PDFArray,
  PDFDocument,
  PDFRawStream,
} from "pdf-lib";

/** Read selectable Helvetica text from the rendered pages, excluding PDF metadata. */
export function reportPageText(
  document: PDFDocument,
  pageIndex?: number,
  actualText = false,
): string {
  const decodeText = new TextDecoder("windows-1252");
  return document
    .getPages()
    .filter((_, index) => pageIndex === undefined || index === pageIndex)
    .flatMap((page) => {
      const contents = page.node.Contents();
      const streams =
        contents instanceof PDFArray ? contents.asArray() : [contents];
      return streams.flatMap((entry) => {
        const stream = document.context.lookup(entry);
        if (!(stream instanceof PDFRawStream))
          throw new Error("Expected a rendered PDF content stream.");
        const commands = Buffer.from(
          decodePDFRawStream(stream).decode(),
        ).toString("ascii");
        return Array.from(
          commands.matchAll(actualText ? /\/Span\s+<<\s*\/MCID \d+\s+\/ActualText <FEFF([A-Fa-f0-9]*)>/gi : /<([A-Fa-f0-9]*)>\s*Tj/g),
          (match) => (actualText ? new TextDecoder("utf-16be") : decodeText).decode(Buffer.from(match[1]!, "hex")),
        );
      });
    })
    .join("\n");
}
