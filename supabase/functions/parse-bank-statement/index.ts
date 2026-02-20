import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { PDFDocument } from "https://esm.sh/@cantoo/pdf-lib@1.17.1";
import * as pdfjsLib from "https://esm.sh/pdfjs-dist@4.4.168/legacy/build/pdf.mjs";

// Disable worker for Deno edge runtime
pdfjsLib.GlobalWorkerOptions.workerSrc = "";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function updateStatus(
  supabase: ReturnType<typeof createClient>,
  importId: string,
  status: string,
  extra: Record<string, unknown> = {}
) {
  const { error } = await supabase
    .from('statement_imports')
    .update({ status, ...extra, updated_at: new Date().toISOString() })
    .eq('id', importId);
  if (error) console.error('[updateStatus] Failed:', error);
}

function detectEncryption(buffer: ArrayBuffer): boolean {
  const size = Math.min(buffer.byteLength, 16384);
  const header = new TextDecoder('latin1').decode(new Uint8Array(buffer.slice(0, size)));
  if (header.includes('/Encrypt')) return true;
  if (header.includes('/EncryptMetadata')) return true;
  if (buffer.byteLength > size) {
    const tail = new TextDecoder('latin1').decode(
      new Uint8Array(buffer.slice(Math.max(0, buffer.byteLength - 4096)))
    );
    if (tail.includes('/Encrypt')) return true;
  }
  return false;
}

async function hashFile(content: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', content);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function decryptPdf(fileBytes: Uint8Array, password: string): Promise<Uint8Array> {
  try {
    const pdfDoc = await PDFDocument.load(fileBytes, {
      password,
      updateMetadata: false,
      ignoreEncryption: false,
    });
    const decryptedBytes = await pdfDoc.save();
    return new Uint8Array(decryptedBytes);
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (
      msg.includes('password') ||
      msg.includes('decrypt') ||
      msg.includes('encrypted') ||
      msg.includes('Permission') ||
      msg.includes('Invalid')
    ) {
      throw new Error('WRONG_PASSWORD');
    }
    throw err;
  }
}

function parseJsonFromAI(content: string): any {
  try { return JSON.parse(content.trim()); } catch { /* continue */ }
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch { /* continue */ }
  }
  const jsonStart = content.indexOf('{');
  const jsonEnd = content.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    try { return JSON.parse(content.slice(jsonStart, jsonEnd + 1)); } catch { /* continue */ }
  }
  const arrStart = content.indexOf('[');
  const arrEnd = content.lastIndexOf(']');
  if (arrStart !== -1 && arrEnd > arrStart) {
    try { return { transactions: JSON.parse(content.slice(arrStart, arrEnd + 1)) }; } catch { /* continue */ }
  }
  throw new Error('Could not parse JSON from AI response');
}

async function splitPdfIntoChunks(pdfBytes: Uint8Array, pagesPerChunk: number): Promise<Uint8Array[]> {
  const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();
  
  if (totalPages <= pagesPerChunk) {
    return [pdfBytes];
  }

  const chunks: Uint8Array[] = [];
  for (let start = 0; start < totalPages; start += pagesPerChunk) {
    const end = Math.min(start + pagesPerChunk, totalPages);
    const chunkDoc = await PDFDocument.create();
    const pages = await chunkDoc.copyPages(srcDoc, Array.from({ length: end - start }, (_, i) => start + i));
    pages.forEach(p => chunkDoc.addPage(p));
    const chunkBytes = await chunkDoc.save();
    chunks.push(new Uint8Array(chunkBytes));
  }
  return chunks;
}

const SYSTEM_PROMPT = `You are a bank statement parser. Extract ALL transactions from the provided bank statement PDF.

For each transaction extract:
- date: Transaction date in YYYY-MM-DD format
- description: The narration/description
- amount: Numeric amount (positive number, no currency symbols)
- type: "debit" for expenses/money out, "credit" for income/money in
- balance: Balance after transaction if shown, otherwise null

Also identify:
- bankName: Bank name (e.g. SBI, HDFC, ICICI, Axis, Indian Bank, etc.)
- periodStart: Statement start date YYYY-MM-DD (or null)
- periodEnd: Statement end date YYYY-MM-DD (or null)

Return ONLY valid JSON, NO markdown fences, NO extra text:
{
  "bankName": "string",
  "periodStart": "YYYY-MM-DD or null",
  "periodEnd": "YYYY-MM-DD or null",
  "transactions": [
    { "date": "YYYY-MM-DD", "description": "string", "amount": 123.45, "type": "debit", "balance": null }
  ]
}

If no transactions found, return: {"error": "no_transactions", "transactions": []}
Include both debit and credit transactions. Extract EVERY transaction — do not skip any.`;

/**
 * Extract text from PDF using pdfjs-dist (legacy build, no worker needed).
 */
async function extractTextFromPDF(pdfBytes: Uint8Array): Promise<string> {
  try {
    const pdf = await pdfjsLib.getDocument({ data: pdfBytes, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }
    return fullText.trim();
  } catch (err) {
    console.error('[extractTextFromPDF] Error:', err);
    throw new Error('Failed to extract text from PDF');
  }
}

/**
 * Call AI with extracted PDF text.
 */
async function callAI(apiKey: string, pdfText: string, isChunk: boolean, retryCount = 0): Promise<any> {
  const userMsg = isChunk
    ? 'Extract ALL transactions from this page/section of the bank statement. Return them as JSON.'
    : 'Extract all transactions from this bank statement PDF.';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  try {
    const response = await fetch('https://api.bytez.com/models/v2/openai/gpt-4o', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `${userMsg}\n\n${pdfText}` },
        ],
        temperature: 0.1,
        max_tokens: 64000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown');
      console.error(`[callAI] HTTP ${response.status}:`, errText);
      if (response.status === 429 && retryCount < 2) {
        const waitMs = (retryCount + 1) * 5000;
        await new Promise(r => setTimeout(r, waitMs));
        return callAI(apiKey, pdfText, isChunk, retryCount + 1);
      }
      throw new Error(`AI_HTTP_${response.status}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    if (!content || content.trim().length === 0) {
      throw new Error('EMPTY_RESPONSE');
    }
    return parseJsonFromAI(content);
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === 'AbortError') {
      if (retryCount < 1) return callAI(apiKey, pdfText, isChunk, retryCount + 1);
      throw new Error('AI_TIMEOUT');
    }
    throw err;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let supabase: ReturnType<typeof createClient> | null = null;
  let importId: string | null = null;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ success: false, error: 'Authorization required' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    supabase = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return json({ success: false, error: 'Invalid authentication' }, 401);

    let body: { importId?: string; password?: string };
    try { body = await req.json(); } catch {
      return json({ success: false, error: 'Invalid JSON body' }, 400);
    }

    importId = body.importId || null;
    const password = body.password;
    if (!importId) return json({ success: false, error: 'importId is required' }, 400);

    if (password !== undefined && password !== null) {
      if (typeof password !== 'string' || password.length > 100) {
        return json({ success: false, error: 'Invalid password format' }, 400);
      }
    }

    console.log(`[parse] importId=${importId} hasPassword=${!!password}`);

    const { data: importRecord, error: importError } = await supabase
      .from('statement_imports')
      .select('*')
      .eq('id', importId)
      .eq('user_id', user.id)
      .single();

    if (importError || !importRecord) {
      return json({ success: false, error: 'Import not found' }, 404);
    }

    const { data: fileData, error: dlError } = await supabase.storage
      .from('bank-statements')
      .download(importRecord.file_path);

    if (dlError || !fileData) {
      console.error('[parse] Download failed:', dlError);
      await updateStatus(supabase, importId, 'failed', { error_message: 'Failed to download file from storage' });
      return json({ success: false, error: 'Failed to download file' }, 500);
    }

    const fileBuffer = await fileData.arrayBuffer();
    const fileHash = await hashFile(fileBuffer);
    const isEncrypted = detectEncryption(fileBuffer);

    console.log(`[parse] Encrypted=${isEncrypted}, fileSize=${fileBuffer.byteLength}`);

    // Encryption check
    if (isEncrypted && !password) {
      await updateStatus(supabase, importId, 'password_required', {
        file_hash: fileHash,
        error_message: 'This PDF is password protected. Please enter the password.',
      });
      return json({ success: false, passwordRequired: true, message: 'This PDF is password protected.' });
    }

    // Decrypt if needed
    let pdfBytes: Uint8Array;
    if (isEncrypted && password) {
      await updateStatus(supabase, importId, 'processing', { error_message: null });
      try {
        pdfBytes = await decryptPdf(new Uint8Array(fileBuffer), password);
        console.log(`[parse] Decrypted successfully, new size=${pdfBytes.byteLength}`);
      } catch (err: any) {
        if (err.message === 'WRONG_PASSWORD') {
          await updateStatus(supabase, importId, 'password_required', {
            file_hash: fileHash,
            error_message: 'Incorrect password. Please try again.',
          });
          return json({ success: false, passwordRequired: true, message: 'Incorrect password. Please try again.' });
        }
        await updateStatus(supabase, importId, 'password_required', {
          file_hash: fileHash,
          error_message: 'Failed to decrypt PDF. Please verify the password.',
        });
        return json({ success: false, passwordRequired: true, message: 'Failed to decrypt PDF.' });
      }
    } else {
      pdfBytes = new Uint8Array(fileBuffer);
    }

    // AI EXTRACTION
    await updateStatus(supabase, importId, 'processing', { file_hash: fileHash });

    // Duplicate check
    const { data: existingImport } = await supabase
      .from('statement_imports')
      .select('id, file_name, created_at')
      .eq('user_id', user.id)
      .eq('file_hash', fileHash)
      .eq('status', 'completed')
      .maybeSingle();

    if (existingImport && existingImport.id !== importId) {
      await updateStatus(supabase, importId, 'failed', {
        file_hash: fileHash,
        error_message: `This statement was already imported on ${new Date(existingImport.created_at).toLocaleDateString()}`,
      });
      return json({ success: false, error: 'Duplicate statement detected' }, 409);
    }

    const BYTEZ_API_KEY = Deno.env.get('BYTEZ_API_KEY');
    if (!BYTEZ_API_KEY) {
      await updateStatus(supabase, importId, 'failed', { error_message: 'AI service not configured' });
      return json({ success: false, error: 'AI service not configured' }, 500);
    }

    // Determine page count for chunking
    let totalPages = 1;
    try {
      const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      totalPages = srcDoc.getPageCount();
    } catch {
      totalPages = 1;
    }

    console.log(`[parse] PDF has ${totalPages} pages`);

    const PAGES_PER_CHUNK = 8;
    let allTransactions: any[] = [];
    let bankName: string | null = null;
    let periodStart: string | null = null;
    let periodEnd: string | null = null;

    if (totalPages <= PAGES_PER_CHUNK) {
      // Small PDF — extract text then send to AI
      try {
        const pdfText = await extractTextFromPDF(pdfBytes);
        if (!pdfText || pdfText.length === 0) {
          await updateStatus(supabase, importId, 'failed', { error_message: 'Could not extract text from PDF.' });
          return json({ success: false, error: 'Could not extract text from PDF' }, 400);
        }
        const parsed = await callAI(BYTEZ_API_KEY, pdfText, false);
        bankName = parsed.bankName || null;
        periodStart = parsed.periodStart || null;
        periodEnd = parsed.periodEnd || null;
        allTransactions = parsed.transactions || [];
      } catch (err: any) {
        console.error('[parse] AI error:', err.message);
        const is402 = err.message?.includes('AI_HTTP_402');
        const errorMsg = is402
          ? 'AI service payment required. Please try again later or contact support.'
          : err.message?.includes('TIMEOUT')
            ? 'Processing timed out. Please try a smaller file.'
            : err.message?.includes('429')
              ? 'Service is busy. Please try again in a minute.'
              : 'Failed to extract transactions. Please try again.';
        await updateStatus(supabase, importId, 'failed', { error_message: errorMsg });
        return json({ success: false, error: errorMsg }, is402 ? 503 : 500);
      }
    } else {
      // Large PDF — chunked processing
      console.log(`[parse] Splitting into chunks of ${PAGES_PER_CHUNK} pages`);
      let chunks: Uint8Array[];
      try {
        chunks = await splitPdfIntoChunks(pdfBytes, PAGES_PER_CHUNK);
      } catch (splitErr) {
        console.error('[parse] Failed to split PDF:', splitErr);
        // Fallback: send the whole file
        try {
          const fallbackText = await extractTextFromPDF(pdfBytes);
          const parsed = await callAI(BYTEZ_API_KEY, fallbackText, false);
          bankName = parsed.bankName || null;
          periodStart = parsed.periodStart || null;
          periodEnd = parsed.periodEnd || null;
          allTransactions = parsed.transactions || [];
          chunks = [];
        } catch (err: any) {
          console.error('[parse] Fallback AI error:', err.message);
          await updateStatus(supabase, importId, 'failed', { error_message: 'Failed to process large PDF.' });
          return json({ success: false, error: 'Failed to process large PDF' }, 500);
        }
      }

      let paymentRequired = false;
      for (let i = 0; i < chunks.length; i++) {
        console.log(`[parse] Processing chunk ${i + 1}/${chunks.length}`);

        await updateStatus(supabase, importId, 'processing', {
          error_message: `Processing page ${i * PAGES_PER_CHUNK + 1}-${Math.min((i + 1) * PAGES_PER_CHUNK, totalPages)} of ${totalPages}...`,
        });

        try {
          const chunkText = await extractTextFromPDF(chunks[i]);
          if (!chunkText || chunkText.length === 0) {
            console.log(`[parse] Chunk ${i + 1} empty, skipping`);
            continue;
          }
          const parsed = await callAI(BYTEZ_API_KEY, chunkText, true);

          if (i === 0) {
            bankName = parsed.bankName || null;
            periodStart = parsed.periodStart || null;
          }
          if (parsed.periodEnd) periodEnd = parsed.periodEnd;

          const txs = parsed.transactions || [];
          console.log(`[parse] Chunk ${i + 1} extracted ${txs.length} transactions`);
          allTransactions.push(...txs);
        } catch (err: any) {
          console.error(`[parse] Chunk ${i + 1} failed:`, err.message);
          if (err.message?.includes('AI_HTTP_402')) {
            paymentRequired = true;
            break;
          }
          continue;
        }

        if (i < chunks.length - 1) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      if (paymentRequired && allTransactions.length === 0) {
        const errMsg = 'AI service payment required. Please try again later or contact support.';
        await updateStatus(supabase, importId, 'failed', { file_hash: fileHash, error_message: errMsg });
        return json({ success: false, error: errMsg }, 503);
      }
    }

    // Handle no transactions
    if (allTransactions.length === 0) {
      await updateStatus(supabase, importId, 'failed', {
        file_hash: fileHash,
        bank_name: bankName,
        error_message: 'No transactions found in this statement. The PDF may not contain readable transaction data.',
      });
      return json({ success: false, error: 'No transactions found in this statement' }, 400);
    }

    // Filter and deduplicate
    const seenKeys = new Set<string>();
    const validTransactions = allTransactions.filter((t: any) => {
      if (!t || !t.date || t.amount === undefined || t.amount === null) return false;
      const key = `${t.date}_${t.amount}_${(t.description || '').slice(0, 30)}`;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });

    if (validTransactions.length === 0) {
      await updateStatus(supabase, importId, 'failed', {
        file_hash: fileHash, bank_name: bankName,
        error_message: 'No valid transactions found.',
      });
      return json({ success: false, error: 'No valid transactions' }, 400);
    }

    console.log(`[parse] Total valid transactions: ${validTransactions.length}`);

    // Check for duplicates against existing expenses
    const { data: existingExpenses } = await supabase
      .from('expenses')
      .select('id, date, amount, note')
      .eq('user_id', user.id);

    const rows = validTransactions.map((t: any) => {
      const dup = existingExpenses?.find(
        (e: any) => e.date === t.date && Math.abs(Number(e.amount) - Math.abs(Number(t.amount))) < 0.01
      );
      return {
        import_id: importId,
        user_id: user.id,
        transaction_date: t.date,
        description: String(t.description || 'Unknown transaction').slice(0, 500),
        amount: Math.abs(Number(t.amount) || 0),
        transaction_type: t.type === 'credit' ? 'credit' : 'debit',
        balance: t.balance != null ? Number(t.balance) : null,
        raw_text: JSON.stringify(t),
        is_duplicate: !!dup,
        duplicate_of: dup?.id || null,
        is_selected: !dup,
      };
    });

    // Insert in batches of 50
    const BATCH_SIZE = 50;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error: insertErr } = await supabase
        .from('extracted_transactions')
        .insert(batch);
      if (insertErr) {
        console.error(`[parse] Insert batch ${i}-${i + batch.length} error:`, insertErr);
        for (const row of batch) {
          const { error: singleErr } = await supabase
            .from('extracted_transactions')
            .insert(row);
          if (singleErr) console.error('[parse] Single insert failed:', singleErr, row.description);
        }
      }
    }

    // SUCCESS
    await updateStatus(supabase, importId, 'extracted', {
      bank_name: bankName || null,
      statement_period_start: periodStart || null,
      statement_period_end: periodEnd || null,
      total_transactions: rows.length,
      file_hash: fileHash,
      error_message: null,
    });

    console.log(`[parse] Success: ${rows.length} transactions from ${bankName}`);

    return json({
      success: true,
      bankName,
      transactionCount: rows.length,
      periodStart,
      periodEnd,
    });

  } catch (error) {
    console.error('[parse] Unhandled error:', error);
    if (supabase && importId) {
      try {
        await updateStatus(supabase, importId, 'failed', {
          error_message: 'An unexpected error occurred. Please try again.',
        });
      } catch (_) { /* best effort */ }
    }
    return json({ success: false, error: 'An unexpected error occurred. Please try again.' }, 500);
  }
});
