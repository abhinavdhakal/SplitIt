/**
 * Extract plain text from PDF ArrayBuffer using dynamic import
 */
export async function extractTextFromPdf(arrayBuffer) {
  // Dynamic import to avoid SSR issues
  const pdfjsLib = await import("pdfjs-dist");

  // Set worker source
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(" ");
    fullText += pageText + "\n";
  }

  return fullText;
}

/**
 * SUPER SIMPLE PARSER: Just look for the most basic patterns
 */
export function parseReceiptText(text) {
  console.log("=== SIMPLE PARSER STARTING ===");
  console.log("Text length:", text.length);
  console.log("First 300 chars:", text.slice(0, 300));

  const items = [];
  let subtotal = null;
  let tax_total = 0;
  let tip_total = 0;
  let total = null;

  // Clean text: remove extra spaces and normalize
  const cleanText = text.replace(/\s+/g, " ").trim();

  console.log("=== LOOKING FOR TOTALS ===");

  // Find subtotal
  const subtotalMatch = cleanText.match(/subtotal[:\s]*\$?([0-9]+\.[0-9]{2})/i);
  if (subtotalMatch) {
    subtotal = parseFloat(subtotalMatch[1]);
    console.log("✅ Subtotal:", subtotal);
  }

  // Find tax
  const taxMatch = cleanText.match(/tax[:\s]*\$?([0-9]+\.[0-9]{2})/i);
  if (taxMatch) {
    tax_total = parseFloat(taxMatch[1]);
    console.log("✅ Tax:", tax_total);
  }

  // Find total
  const totalMatch = cleanText.match(
    /(?:^|\s)total[:\s]*\$?([0-9]+\.[0-9]{2})/i
  );
  if (totalMatch) {
    total = parseFloat(totalMatch[1]);
    console.log("✅ Total:", total);
  }

  console.log("=== LOOKING FOR ITEMS ===");

  // STRATEGY 1: Look for the exact Walmart pattern with better name extraction
  console.log("Strategy 1: Walmart format with status words");

  // Try to split the text into lines first and look for patterns
  const lines = cleanText.split(/\n+/);
  console.log("Number of lines:", lines.length);

  // Look for lines with the Walmart pattern
  for (let line of lines) {
    line = line.trim();
    if (!line || line.length < 10) continue;

    // Match: ItemName Status Qty N $Price
    const walmartMatch = line.match(
      /^(.+?)\s+(Shopped|Unavailable|Available)\s+Qty\s+(\d+)\s+\$([0-9]+\.[0-9]{2})/i
    );

    if (walmartMatch) {
      let name = walmartMatch[1].trim();
      const status = walmartMatch[2];
      const qty = parseInt(walmartMatch[3]);
      const price = parseFloat(walmartMatch[4]);

      // Clean up name - sometimes it gets cut off at the beginning
      // Remove any leading numbers, spaces, or special chars that aren't part of the name
      name = name.replace(/^[\d\s\-_.,]*/, "");
      name = name.replace(/\s+/g, " ").trim();

      console.log("🎯 Walmart line match:", {
        originalLine: line.substring(0, 100),
        name,
        status,
        qty,
        price,
      });

      if (
        name &&
        name.length >= 3 &&
        !/(total|tax|tip|subtotal|fee|order|charge)/i.test(name)
      ) {
        items.push({
          name: name,
          quantity: qty,
          unit_price: price,
          total_price: price,
        });
        console.log("✅ Added item:", name, `$${price}`);
      }
    }
  }

  // Fallback: original regex approach if no items found from line-by-line
  if (items.length === 0) {
    const walmartPattern =
      /([A-Za-z][^$\n]{2,60}?)\s+(Shopped|Unavailable|Available)\s+Qty\s+(\d+)\s+\$([0-9]+\.[0-9]{2})/gi;

    let match;
    while ((match = walmartPattern.exec(cleanText)) !== null) {
      let name = match[1].trim();

      // Better name cleaning
      name = name.replace(/^[^A-Za-z]*/, ""); // Remove leading non-letters
      name = name.replace(/\s+/g, " ").trim();

      const status = match[2];
      const qty = parseInt(match[3]);
      const price = parseFloat(match[4]);

      console.log("🎯 Fallback Walmart pattern match:", {
        name,
        status,
        qty,
        price,
      });

      if (
        name &&
        name.length >= 3 &&
        !/(total|tax|tip|subtotal|fee|order|charge)/i.test(name)
      ) {
        items.push({
          name: name,
          quantity: qty,
          unit_price: price,
          total_price: price,
        });
        console.log("✅ Added item:", name, `$${price}`);
      }
    }
  }

  // STRATEGY 2: If no items found, try simpler pattern
  if (items.length === 0) {
    console.log("Strategy 2: Simple Qty + Price pattern");
    const simplePattern =
      /([^$\n]{5,40}?)\s+Qty\s+(\d+)\s+\$([0-9]+\.[0-9]{2})/gi;

    while ((match = simplePattern.exec(cleanText)) !== null) {
      const name = match[1].trim().replace(/\s+/g, " ");
      const qty = parseInt(match[2]);
      const price = parseFloat(match[3]);

      console.log("🎯 Simple pattern match:", { name, qty, price });

      if (name && !/(total|tax|tip|subtotal|fee)/i.test(name) && price > 0) {
        items.push({
          name: name,
          quantity: qty,
          unit_price: price,
          total_price: price,
        });
        console.log("✅ Added item:", name, `$${price}`);
      }
    }
  }

  // STRATEGY 3: If still no items, look for ANY price with context
  if (items.length === 0) {
    console.log("Strategy 3: Any price with context");

    // Find all $X.XX patterns and look at the text before them
    const allPrices = [
      ...cleanText.matchAll(/([^$]{10,50}?)\$([0-9]+\.[0-9]{2})/g),
    ];

    console.log("Found", allPrices.length, "price contexts");

    allPrices.forEach((match, idx) => {
      const context = match[1];
      const price = parseFloat(match[2]);

      // Look for quantity in the context
      const qtyMatch = context.match(/qty\s+(\d+)/i);

      if (qtyMatch && price > 0.5 && price < 100) {
        const qty = parseInt(qtyMatch[1]);
        // Extract potential item name (everything before "Qty")
        let name = context.replace(/qty\s+\d+/i, "").trim();
        name = name.replace(/\s+/g, " ");

        // Clean up the name
        if (name.length < 3) name = `Item ${idx + 1}`;

        console.log("🎯 Context match:", {
          context: context.slice(-30),
          name,
          qty,
          price,
        });

        if (!/(total|tax|tip|subtotal|fee)/i.test(name)) {
          items.push({
            name: name,
            quantity: qty,
            unit_price: price,
            total_price: price,
          });
          console.log("✅ Added context item:", name, `$${price}`);
        }
      }
    });
  }

  console.log("=== FINAL RESULTS ===");
  console.log("Items found:", items.length);
  console.log("Subtotal:", subtotal);
  console.log("Tax:", tax_total);
  console.log("Total:", total);

  return {
    items,
    subtotal,
    tax_total,
    tip_total,
    total,
  };
}
