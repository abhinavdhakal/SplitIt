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

    // Better text reconstruction to preserve line structure
    const pageLines = [];
    let currentLine = "";
    let lastY = null;

    for (const item of textContent.items) {
      // If Y position changed significantly, it's a new line
      if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
        if (currentLine.trim()) {
          pageLines.push(currentLine.trim());
        }
        currentLine = item.str;
      } else {
        currentLine += item.str;
      }
      lastY = item.transform[5];
    }

    // Don't forget the last line
    if (currentLine.trim()) {
      pageLines.push(currentLine.trim());
    }

    fullText += pageLines.join("\n") + "\n";
  }

  console.log("=== PDF TEXT EXTRACTION ===");
  console.log("Extracted text length:", fullText.length);
  console.log("Number of lines:", fullText.split("\n").length);
  
  return fullText;
}

/**
 * SUPER SIMPLE PARSER: Just look for the most basic patterns
 */
export function parseReceiptText(text) {
  console.log("=== PDF PARSER STARTING ===");
  console.log("Text length:", text.length);
  console.log("First 500 chars:", text.slice(0, 500));
  console.log("Last 300 chars:", text.slice(-300));

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

  // Find tip - multiple patterns
  const tipPatterns = [
    /tip[:\s]*\$?([0-9]+\.[0-9]{2})/i,
    /driver['\s]*s?\s*tip[:\s]*\$?([0-9]+\.[0-9]{2})/i,
    /delivery\s*tip[:\s]*\$?([0-9]+\.[0-9]{2})/i,
    /gratuity[:\s]*\$?([0-9]+\.[0-9]{2})/i,
  ];

  for (const pattern of tipPatterns) {
    const tipMatch = cleanText.match(pattern);
    if (tipMatch) {
      tip_total = parseFloat(tipMatch[1]);
      console.log("✅ Tip:", tip_total, "- found with pattern:", pattern);
      break;
    }
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
  const lines = text.split(/\n+/);
  console.log("Number of lines:", lines.length);

  // Debug: show first few lines
  console.log("First 10 lines:");
  lines.slice(0, 10).forEach((line, i) => {
    console.log(`Line ${i + 1}: "${line}"`);
  });

  // SPECIAL DEBUG: Look for the coffee item specifically
  console.log("\n=== COFFEE DEBUG ===");
  const coffeeLines = lines.filter((line) =>
    /NESCAF|coffee|instant|clásico|clasico/i.test(line)
  );
  console.log("Lines containing coffee-related words:", coffeeLines.length);
  coffeeLines.forEach((line, i) => {
    console.log(`Coffee line ${i + 1}: "${line}"`);
  });

  // Look for lines with the Walmart pattern
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    let line = lines[lineIndex].trim();
    if (!line || line.length < 10) continue;

    console.log(
      `\n--- Processing Line ${lineIndex + 1}: "${line.substring(
        0,
        80
      )}..." ---`
    );

    // Multiple patterns to try:

    // Pattern 1: ItemName Status Qty N $Price - more flexible for special characters
    const walmartMatch = line.match(
      /^(.+?)\s+(Shopped|Unavailable|Available)\s+Qty\s+(\d+)\s+\$([0-9]+\.[0-9]{2})/iu
    );

    // Pattern 2: ItemName Qty N $Price (without status) - more flexible
    const simpleMatch = line.match(
      /^(.+?)\s+Qty\s+(\d+)\s+\$([0-9]+\.[0-9]{2})/iu
    );

    // Pattern 3: $Price at the end with Qty somewhere - more flexible
    const priceEndMatch = line.match(
      /^(.+?)\s+.*Qty\s+(\d+).*\$([0-9]+\.[0-9]{2})$/iu
    );

    // Pattern 4: More lenient - anywhere in line with status and price
    const lenientMatch = line.match(
      /(.+?)\s+(Shopped|Unavailable|Available)\s+.*Qty\s+(\d+)\s+.*\$([0-9]+\.[0-9]{2})/iu
    );

    // SPECIAL DEBUG for coffee item
    if (/NESCAF|coffee|instant|clásico|clasico/i.test(line)) {
      console.log(`🔍 COFFEE LINE DEBUG: "${line}"`);
      console.log("Walmart match:", walmartMatch);
      console.log("Simple match:", simpleMatch);
      console.log("Price end match:", priceEndMatch);
      console.log("Lenient match:", lenientMatch);
    }

    let matchResult = null;
    let patternUsed = "";

    if (walmartMatch) {
      matchResult = {
        name: walmartMatch[1].trim(),
        qty: parseInt(walmartMatch[3]),
        price: parseFloat(walmartMatch[4]),
        status: walmartMatch[2],
      };
      patternUsed = "Walmart (with status)";
    } else if (simpleMatch) {
      matchResult = {
        name: simpleMatch[1].trim(),
        qty: parseInt(simpleMatch[2]),
        price: parseFloat(simpleMatch[3]),
        status: "unknown",
      };
      patternUsed = "Simple (no status)";
    } else if (priceEndMatch) {
      matchResult = {
        name: priceEndMatch[1].trim(),
        qty: parseInt(priceEndMatch[2]),
        price: parseFloat(priceEndMatch[3]),
        status: "unknown",
      };
      patternUsed = "Price at end";
    } else if (lenientMatch) {
      matchResult = {
        name: lenientMatch[1].trim(),
        qty: parseInt(lenientMatch[3]),
        price: parseFloat(lenientMatch[4]),
        status: lenientMatch[2],
      };
      patternUsed = "Lenient (flexible)";
    }

    if (matchResult) {
      let name = matchResult.name;

      // Clean up name - remove leading junk
      name = name.replace(/^[\d\s\-_.,#]*/, "");
      name = name.replace(/\s+/g, " ").trim();

      console.log(`🎯 ${patternUsed} match:`, {
        originalLine: line.substring(0, 100),
        cleanedName: name,
        qty: matchResult.qty,
        price: matchResult.price,
        status: matchResult.status,
      });

      // DEBUG: Check each validation condition
      const hasName = !!name;
      const lengthOk = name && name.length >= 3;
      const exclusionMatch =
        /\b(total|tax|tip|subtotal|fee|order|charge|delivery|pickup)\b/i.test(
          name
        );

      console.log(`🔍 Validation debug for "${name}":`, {
        hasName,
        length: name ? name.length : 0,
        lengthOk,
        exclusionMatch,
        exclusionPattern: exclusionMatch
          ? name.match(
              /\b(total|tax|tip|subtotal|fee|order|charge|delivery|pickup)\b/i
            )
          : null,
      });

      if (hasName && lengthOk && !exclusionMatch) {
        items.push({
          name: name,
          quantity: matchResult.qty,
          unit_price: matchResult.price / matchResult.qty,
          total_price: matchResult.price,
          status: matchResult.status,
          available: matchResult.status !== "Unavailable", // Mark unavailable items as false
        });
        console.log(
          `✅ Added item: "${name}" Qty:${matchResult.qty} $${matchResult.price}`
        );
      } else {
        console.log(
          `❌ Rejected: hasName=${hasName}, lengthOk=${lengthOk}, exclusionMatch=${exclusionMatch}`
        );
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
        !/\b(total|tax|tip|subtotal|fee|order|charge)\b/i.test(name)
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
