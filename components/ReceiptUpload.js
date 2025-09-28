import { useState } from "react";
import { extractTextFromPdf, parseReceiptText } from "../utils/pdfParser";
import { supabase } from "../lib/supabaseClient";

export default function ReceiptUpload({ groupId, onUploaded }) {
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [receiptName, setReceiptName] = useState("");

  async function handleFileChange(e) {
    setError("");
    const f = e.target.files[0];
    if (!f) {
      setReceiptName("");
      return;
    }
    if (!f.type.includes("pdf")) {
      setError("Please upload a PDF file.");
      return;
    }
    setFile(f);

    // Auto-generate receipt name from filename
    const defaultName = f.name
      .replace(/\.[^/.]+$/, "") // Remove file extension
      .replace(/[_-]/g, " ") // Replace underscores and hyphens with spaces
      .replace(/\b\w/g, (l) => l.toUpperCase()); // Capitalize each word
    setReceiptName(defaultName);
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
            name: receiptName.trim() || "Untitled Receipt", // Use custom receipt name
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
      setReceiptName("");
      if (onUploaded) onUploaded();
    } catch (err) {
      console.error(err);
      setError(err.message || "Upload failed.");
      setParsing(false);
    }
  }

  return (
    <div className="p-6 bg-white rounded-2xl shadow-sm border">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
          <svg
            className="w-4 h-4 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Upload Receipt
          </h3>
          <p className="text-sm text-gray-500">
            Upload a PDF receipt to parse and split
          </p>
        </div>
      </div>
      {/* Receipt Name Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Receipt Name
        </label>
        <input
          type="text"
          value={receiptName}
          onChange={(e) => setReceiptName(e.target.value)}
          placeholder="Enter receipt name (auto-generated if empty)"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="text-xs text-gray-500 mt-1">
          Tip: Name will be auto-generated from filename if left empty
        </p>
      </div>
      {/* File Upload */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          PDF Receipt
        </label>
        <div className="relative">
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>
        {file && (
          <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            Selected: {file.name}
          </p>
        )}
      </div>
      {/* Upload Button */}
      <button
        type="submit"
        disabled={parsing || !file}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white p-3 rounded font-semibold"
      >
        {parsing ? "Processing..." : "Upload & Parse Receipt"}
      </button>{" "}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm flex items-center gap-2">
            <svg
              className="w-4 h-4 text-red-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            {error}
          </p>
        </div>
      )}
      {preview && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <svg
              className="w-5 h-5 text-blue-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            <strong className="text-blue-900">Preview - Ready to Upload</strong>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
            <div className="bg-white p-3 rounded-lg">
              <p className="text-gray-600 text-xs">Items Found</p>
              <p className="font-semibold text-gray-900">
                {preview.items.length}
              </p>
            </div>
            <div className="bg-white p-3 rounded-lg">
              <p className="text-gray-600 text-xs">Subtotal</p>
              <p className="font-semibold text-gray-900">${preview.subtotal}</p>
            </div>
            <div className="bg-white p-3 rounded-lg">
              <p className="text-gray-600 text-xs">Tax</p>
              <p className="font-semibold text-gray-900">
                ${preview.tax_total}
              </p>
            </div>
            <div className="bg-white p-3 rounded-lg">
              <p className="text-gray-600 text-xs">Total</p>
              <p className="font-semibold text-blue-700">${preview.total}</p>
            </div>
          </div>

          {preview.items.length > 0 && (
            <div className="mb-4">
              <p className="font-medium text-blue-900 mb-2">Items Detected:</p>
              <div className="bg-white rounded-lg p-3 max-h-32 overflow-y-auto">
                {preview.items.slice(0, 5).map((item, i) => (
                  <div key={i} className="flex justify-between text-sm py-1">
                    <span className="text-gray-700">• {item.name}</span>
                    <span className="font-medium">${item.total_price}</span>
                  </div>
                ))}
                {preview.items.length > 5 && (
                  <p className="text-xs text-gray-500 mt-2">
                    + {preview.items.length - 5} more items
                  </p>
                )}
              </div>
            </div>
          )}

          <details className="mt-2">
            <summary className="cursor-pointer font-medium text-blue-900 text-sm hover:text-blue-700">
              View Raw PDF Text (for debugging)
            </summary>
            <pre className="bg-gray-100 p-3 mt-2 text-xs max-h-40 overflow-y-auto whitespace-pre-wrap rounded border">
              {preview.raw_text_sample}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
