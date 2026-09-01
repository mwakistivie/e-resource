"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseClient";

const RESOURCE_TYPES = [
  "SCHEME_OF_WORK", "LESSON_PLAN", "STUDY_NOTES", "REVISION_MATERIAL", "REVISION_QUESTIONS",
  "EXAMINATION", "ASSESSMENT_PAPER", "MARKING_SCHEME", "WORKSHEET", "TEACHING_ACTIVITY",
  "PRESENTATION", "EBOOK", "PAST_PAPER", "DIGITAL_QUIZ", "EDUCATIONAL_VIDEO", "OTHER",
];

export default function AdminResourceForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [resourceType, setResourceType] = useState(RESOURCE_TYPES[0]);
  const [subject, setSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [term, setTerm] = useState("");
  const [priceKsh, setPriceKsh] = useState(150);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Uploading file…");

    let fileKey: string | undefined;
    const tempSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "resource";

    if (file) {
      const urlRes = await fetch("/api/admin/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, slug: tempSlug }),
      });
      if (!urlRes.ok) return setStatus("Couldn't get an upload URL.");
      const { path, token, fileKey: key, bucket } = await urlRes.json();

      // Supabase's signed-upload flow: the token from createSignedUploadUrl()
      // (minted server-side) is what actually authorizes this write against
      // an otherwise-private bucket — the anon key alone can't do this.
      const { error } = await supabaseBrowser.storage.from(bucket).uploadToSignedUrl(path, token, file);
      if (error) return setStatus(`File upload to storage failed: ${error.message}`);
      fileKey = key;
    }

    setStatus("Creating resource…");
    const res = await fetch("/api/admin/resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title, description, resourceType, subject, gradeLevel,
        term: term || undefined, priceKsh: Number(priceKsh), isBundle: false, fileKey,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      return setStatus(data.error ?? "Something went wrong.");
    }
    setStatus("Created as draft. Publish it below when ready.");
    router.refresh();
    setTitle(""); setDescription(""); setSubject(""); setGradeLevel(""); setTerm(""); setFile(null);
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
        <input required placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="rounded-md border border-sand px-3 py-2 text-sm" />
        <input required placeholder="Grade level" value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} className="rounded-md border border-sand px-3 py-2 text-sm" />
        <input placeholder="Term (optional)" value={term} onChange={(e) => setTerm(e.target.value)} className="rounded-md border border-sand px-3 py-2 text-sm col-span-2" />
      </div>
      <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
      <button type="submit" className="rounded-md bg-moss text-white font-medium px-4 py-2 text-sm">Save as draft</button>
      {status && <p className="text-sm text-ink/60">{status}</p>}
    </form>
  );
}
