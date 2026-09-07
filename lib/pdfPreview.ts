import { PDFDocument, rgb, degrees, StandardFonts } from "pdf-lib";

/**
 * Extracts the first page of a PDF and tiles a diagonal watermark across it,
 * returning a new standalone one-page PDF. Runs entirely client-side in the
 * admin's browser before upload — deliberately avoids any server-side PDF
 * rasterization (e.g. pdf-to-image libraries), which typically depend on
 * native binaries that are unreliable on Vercel's serverless functions.
 * pdf-lib is pure JS and works identically in the browser or Node.
 *
 * The output is a real PDF page (selectable text, not a flattened image),
 * which is fine for a preview: the watermark makes it unusable as a
 * substitute for the paid file, and it's only ever the first page.
 */
export async function buildWatermarkedPreview(fileBytes: ArrayBuffer): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(fileBytes);
  const previewDoc = await PDFDocument.create();
  const [firstPage] = await previewDoc.copyPages(srcDoc, [0]);
  previewDoc.addPage(firstPage);

  const font = await previewDoc.embedFont(StandardFonts.HelveticaBold);
  const page = previewDoc.getPage(0);
  const { width, height } = page.getSize();

  const watermarkText = "PREVIEW — SOMA RESOURCES";
  const fontSize = 22;

  // Tile diagonally across the whole page so no clean crop removes it.
  for (let y = -height * 0.5; y < height * 1.5; y += 130) {
    for (let x = -width * 0.5; x < width * 1.5; x += 240) {
      page.drawText(watermarkText, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(0.77, 0.38, 0.18), // brand clay
        opacity: 0.18,
        rotate: degrees(-30),
      });
    }
  }

  return previewDoc.save();
}

/** True if a File/filename looks like a PDF — previews are only generated for PDFs. */
export function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}
