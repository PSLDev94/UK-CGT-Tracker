import {
  decodePDFRawStream,
  PDFArray,
  PDFDocument,
  PDFRawStream,
} from "pdf-lib";

/** Read selectable Helvetica text from the rendered pages, excluding PDF metadata. */
export function reportPageText(document: PDFDocument): string {
  const decodeText = new TextDecoder("windows-1252");
  return document
    .getPages()
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
          commands.matchAll(/<([A-Fa-f0-9]*)>\s*Tj/g),
          (match) => decodeText.decode(Buffer.from(match[1]!, "hex")),
        );
      });
    })
    .join("\n");
}
