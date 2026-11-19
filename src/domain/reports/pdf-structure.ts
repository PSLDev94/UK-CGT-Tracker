import {
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFOperator,
  PDFOperatorNames,
  beginMarkedContent,
  endMarkedContent,
  type PDFArray,
  type PDFPage,
  type PDFRef,
} from "pdf-lib";

type Role =
  "Document" | "H1" | "H2" | "H3" | "P" | "Table" | "TR" | "TH" | "TD";
interface Element {
  role: Role;
  ref: PDFRef;
  children: PDFArray;
}

/** Connect the logical reading order to the actual marked text on each PDF page. */
export function reportStructure(doc: PDFDocument) {
  const ctx = doc.context;
  const tree = ctx.obj({ Type: "StructTreeRoot" });
  const treeRef = ctx.register(tree);
  const byPage = new Map<PDFPage, PDFArray>();
  const bookmarks: { title: string; page: PDFPage; y: number }[] = [];
  doc.catalog.set(PDFName.of("StructTreeRoot"), treeRef);
  doc.catalog.set(PDFName.of("MarkInfo"), ctx.obj({ Marked: true }));

  function element(role: Role, parent?: Element): Element {
    const children = ctx.obj([]);
    const dict = ctx.obj({
      Type: "StructElem",
      S: role,
      P: parent?.ref ?? treeRef,
      K: children,
      A: role === "TH" ? ctx.obj({ O: "Table", Scope: "Column" }) : undefined,
    });
    const ref = ctx.register(dict);
    if (parent) parent.children.push(ref);
    else tree.set(PDFName.of("K"), ref);
    return { role, ref, children };
  }
  const document = element("Document");

  function mark(page: PDFPage, item: Element, draw: () => void, actualText?: string) {
    let parents = byPage.get(page);
    if (!parents) {
      parents = ctx.obj([]);
      page.node.set(PDFName.of("StructParents"), PDFNumber.of(byPage.size));
      page.node.set(PDFName.of("Tabs"), PDFName.of("S"));
      byPage.set(page, parents);
    }
    const id = parents.size();
    parents.push(item.ref);
    item.children.push(ctx.obj({ Type: "MCR", Pg: page.ref, MCID: id }));
    page.pushOperators(
      PDFOperator.of(PDFOperatorNames.BeginMarkedContentSequence, [
        PDFName.of(actualText === undefined ? item.role : "Span"),
        `<< /MCID ${id}${actualText === undefined ? "" : " /ActualText " + PDFHexString.fromText(actualText).toString()} >>`,
      ]),
    );
    draw();
    page.pushOperators(endMarkedContent());
  }

  function artifact(page: PDFPage, draw: () => void) {
    page.pushOperators(beginMarkedContent("Artifact"));
    draw();
    page.pushOperators(endMarkedContent());
  }

  function bookmark(title: string, page: PDFPage, y: number) {
    bookmarks.push({ title, page, y });
  }

  function finish() {
    const numbers = ctx.obj([]);
    for (const parents of byPage.values()) {
      numbers.push(PDFNumber.of(numbers.size() / 2));
      numbers.push(ctx.register(parents));
    }
    tree.set(
      PDFName.of("ParentTree"),
      ctx.register(ctx.obj({ Nums: numbers })),
    );
    tree.set(PDFName.of("ParentTreeNextKey"), PDFNumber.of(byPage.size));

    if (!bookmarks.length) return;
    const outline = ctx.nextRef();
    const refs = bookmarks.map(() => ctx.nextRef());
    bookmarks.forEach(({ title, page, y }, i) => {
      ctx.assign(
        refs[i]!,
        ctx.obj({
          Title: PDFHexString.fromText(title),
          Parent: outline,
          Prev: refs[i - 1],
          Next: refs[i + 1],
          Dest: [page.ref, "XYZ", null, y, null],
        }),
      );
    });
    ctx.assign(
      outline,
      ctx.obj({
        Type: "Outlines",
        First: refs[0],
        Last: refs.at(-1),
        Count: refs.length,
      }),
    );
    doc.catalog.set(PDFName.of("Outlines"), outline);
  }

  return { document, element, mark, artifact, bookmark, finish };
}
