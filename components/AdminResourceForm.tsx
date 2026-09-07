"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { buildWatermarkedPreview, isPdf } from "@/lib/pdfPreview";
import { GRADE_LEVELS, SUBJECTS, TERMS } from "@/lib/curriculum";

const RESOURCE_TYPES = [
  "SCHEME_OF_WORK", "LESSON_PLAN", "STUDY_NOTES", "REVISION_MATERIAL", "REVISION_QUESTIONS",
  "EXAMINATION", "ASSESSMENT_PAPER", "MARKING_SCHEME", "WORKSHEET", "TEACHING_ACTIVITY",
  "PRESENTATION", "EBOOK", "PAST_PAPER", "DIGITAL_QUIZ", "EDUCATIONAL_VIDEO", "OTHER",
];

async function uploadToStorage(file: Blob, filename: string, contentType: string, slug: string): Promise<string> {
  const urlRes = await fetch("/api/admin/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, slug }),
  });
  if (!urlRes.ok) throw new Error("Couldn't get an upload URL.");
  const { path, token, fileKey, bucket } = await urlRes.json();

  // Supabase's signed-upload flow: the token from createSignedUploadUrl()
  // (minted server-side) is what actually authorizes this write against
  // an otherwise-private bucket — the anon key alone can't do this.
  const { error } = await supabaseBrowser.storage.from(bucket).uploadToSignedUrl(path, token, file);
  if (error) throw new Error(`Upload to storage failed: ${error.message}`);
  return fileKey;
}

export default function AdminResourceForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [resourceType, setResourceType] = useState(RESOURCE_TYPES[0]);
  const [subject, setSubject] = useState<string>(SUBJECTS[0]);
  const [gradeLevel, setGradeLevel] = useState<string>(GRADE_LEVELS[0]);
  const [term, setTerm] = useState("");
  const [priceKsh, setPriceKsh] = useState(150);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const tempSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "resource";

    let fileKey: string | undefined;
    let previewFileKey: string | undefined;

    try {
      if (file) {
        setStatus("Uploading file…");
        fileKey = await uploadToStorage(file, file.name, file.type, tempSlug);

        // Preview generation only applies to PDFs — pptx/docx files are
        // skipped silently rather than erroring, since not every resource
        // needs (or can easily get) a preview at this stage.
        if (isPdf(file)) {
          setStatus("Generating watermarked preview…");
          try {
            const previewBytes = await buildWatermarkedPreview(await file.arrayBuffer());
            const previewBlob = new Blob([new Uint8Array(previewBytes)], { type: "application/pdf" });
            previewFileKey = await uploadToStorage(previewBlob, "preview.pdf", "application/pdf", `${tempSlug}-preview`);
          } catch (err) {
            // Don't block resource creation if preview generation fails
            // (e.g. a malformed or encrypted PDF) — just skip the preview.
            console.warn("Preview generation failed, continuing without one:", err);
          }
        }
      }

      setStatus("Creating resource…");
      const res = await fetch("/api/admin/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, description, resourceType, subject, gradeLevel,
          term: term || undefined, priceKsh: Number(priceKsh), isBundle: false, fileKey, previewFileKey,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        return setStatus(data.error ?? "Something went wrong.");
      }
      setStatus(previewFileKey ? "Created as draft, with a preview. Publish it below when ready." : "Created as draft. Publish it below when ready.");
      router.refresh();
      setTitle(""); setDescription(""); setTerm(""); setFile(null);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-sand rounded-lg bg-white p-5 space-y-3">
      <h3 className="font-medium text-ink">Add a resource</h3>
      <input required placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-md border border-sand px-3 py-2 text-sm" />
      <textarea required placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-md border border-sand px-3 py-2 text-sm" rows={3} />
      <div className="grid grid-cols-2 gap-3">
        <select value={resourceType} onChange={(e) => setResourceType(e.target.value)} className="rounded-md border border-sand px-3 py-2 text-sm">
          {RESOURCE_TYPES.map((t) => <option key={t} value={t}>{t.replaceAll("_", " ")}</option>)}
        </select>
        <input required placeholder="Price (KSh)" type="number" value={priceKsh} onChange={(e) => setPriceKsh(Number(e.target.value))} className="rounded-md border border-sand px-3 py-2 text-sm" />
        <select required value={subject} onChange={(e) => setSubject(e.target.value)} className="rounded-md border border-sand px-3 py-2 text-sm">
          {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select required value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} className="rounded-md border border-sand px-3 py-2 text-sm">
          {GRADE_LEVELS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={term} onChange={(e) => setTerm(e.target.value)} className="rounded-md border border-sand px-3 py-2 text-sm col-span-2">
          <option value="">No term (not term-specific)</option>
          {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
        <p className="text-xs text-ink/40 mt-1">PDF uploads automatically get a watermarked first-page preview customers can view before buying.</p>
      </div>
      <button type="submit" className="rounded-md bg-moss text-white font-medium px-4 py-2 text-sm">Save as draft</button>
      {status && <p className="text-sm text-ink/60">{status}</p>}
    </form>
  );
}
