import { useState } from "react";
import { extractTextFromPdf, parseReceiptText } from "../utils/pdfParser";
import { supabase } from "../lib/supabaseClient";

export default function ReceiptUpload({ groupId, onUploaded }) {
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");

  async function handleFileChange(e) {
    setError("");
    const f = e.target.files[0];
    if (!f) return;
    if (!f.type.includes("pdf")) {
      setError("Please upload a PDF file.");
      return;
    }
    setFile(f);
  }

  async function uploadAndParse() {
    if (!file) return setError("No file chosen.");
    setParsing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const text = await extractTextFromPdf(arrayBuffer);
      const parsed = parseReceiptText(text);
      setPreview(parsed);

      // store file in Supabase Storage
      const path = `${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("receipts")
        .upload(path, file, { upsert: false });

      if (upErr) throw upErr;

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // insert receipt row
      const { data, error: insertErr } = await supabase
        .from("receipts")
        .insert([
          {
            group_id: groupId,
            uploader_user_id: user?.id,
            filename: path,
            parsed_json: parsed,
            subtotal: parsed.subtotal,
            tax_total: parsed.tax_total,
            tip_total: parsed.tip_total,
            total: parsed.total,
            status: "open",
          },
        ])
        .select()
        .single();

      if (insertErr) throw insertErr;

      // insert items
      for (const it of parsed.items) {
        await supabase.from("items").insert([
          {
            receipt_id: data.id,
            name: it.name,
            quantity: it.quantity || 1,
            unit_price: it.unit_price,
            total_price: it.total_price,
            claimed_by: null,
            status: it.status || "Available",
            available: it.available !== false, // Default to true unless explicitly false
          },
        ]);
      }

      setParsing(false);
      setFile(null);
      setPreview(null);
      if (onUploaded) onUploaded();
    } catch (err) {
      console.error(err);
      setError(err.message || "Upload failed.");
      setParsing(false);
    }
  }

  return (
    <div className="p-4 border rounded bg-white">
      <h3 className="font-semibold mb-2">Upload Walmart+ PDF receipt</h3>
      <input type="file" accept="application/pdf" onChange={handleFileChange} />
      <div className="mt-3 flex gap-2">
        <button
          onClick={uploadAndParse}
          className="px-3 py-2 bg-green-600 text-white rounded"
          disabled={!file || parsing}
        >
          {parsing ? "Parsing & uploading..." : "Upload & parse"}
        </button>
      </div>
      {error && <p className="text-red-600 mt-2">{error}</p>}
      {preview && (
        <div className="mt-3 text-sm text-gray-700">
          <strong>Preview</strong>
          <div>Items: {preview.items.length}</div>
          <div>Subtotal: ${preview.subtotal}</div>
          <div>Tax: ${preview.tax_total}</div>
          <div>Tip: ${preview.tip_total}</div>
          <div>Total: ${preview.total}</div>

          {preview.items.length > 0 && (
            <div className="mt-2">
              <strong>Items found:</strong>
              {preview.items.map((item, i) => (
                <div key={i} className="ml-2">
                  • {item.name} - ${item.total_price}
                </div>
              ))}
            </div>
          )}

          <details className="mt-2">
            <summary className="cursor-pointer font-medium">
              Raw PDF Text (for debugging)
            </summary>
            <pre className="bg-gray-100 p-2 mt-2 text-xs max-h-40 overflow-y-auto whitespace-pre-wrap">
              {preview.raw_text_sample}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
