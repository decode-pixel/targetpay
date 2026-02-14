import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { PDFDocument } from "https://esm.sh/@cantoo/pdf-lib@1.17.1";

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

/**
 * Attempt to decrypt a password-protected PDF using @cantoo/pdf-lib.
 * Returns the decrypted PDF bytes, or throws on wrong password.
 */
async function decryptPdf(fileBytes: Uint8Array, password: string): Promise<Uint8Array> {
  try {
    const pdfDoc = await PDFDocument.load(fileBytes, {
      password,
      updateMetadata: false,
      ignoreEncryption: false,
    });
    // Save as unencrypted PDF
    const decryptedBytes = await pdfDoc.save();
    return new Uint8Array(decryptedBytes);
  } catch (err: any) {
    const msg = err?.message || String(err);
    // pdf-lib throws specific errors for wrong passwords
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
  // Try direct parse first
  try {
    return JSON.parse(content.trim());
  } catch { /* continue */ }

  // Strip markdown code fences
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch { /* continue */ }
  }

  // Try to find JSON object in the content
  const jsonStart = content.indexOf('{');
  const jsonEnd = content.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    try {
      return JSON.parse(content.slice(jsonStart, jsonEnd + 1));
    } catch { /* continue */ }
  }

  throw new Error('Could not parse JSON from AI response');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let supabase: ReturnType<typeof createClient> | null = null;
  let importId: string | null = null;

  try {
    // ── AUTH ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ success: false, error: 'Authorization required' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    supabase = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return json({ success: false, error: 'Invalid authentication' }, 401);

    // ── PARSE REQUEST ──
    let body: { importId?: string; password?: string };
    try {
      body = await req.json();
    } catch {
      return json({ success: false, error: 'Invalid JSON body' }, 400);
    }

    importId = body.importId || null;
    const password = body.password;

    if (!importId) return json({ success: false, error: 'importId is required' }, 400);

    console.log(`[parse] importId=${importId} hasPassword=${!!password}`);

    // ── GET IMPORT RECORD ──
    const { data: importRecord, error: importError } = await supabase
      .from('statement_imports')
      .select('*')
      .eq('id', importId)
      .eq('user_id', user.id)
      .single();

    if (importError || !importRecord) {
      return json({ success: false, error: 'Import not found' }, 404);
    }

    // ── DOWNLOAD FILE ──
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

    // ── PHASE 1: ENCRYPTION CHECK — if encrypted and no password, ask for it ──
    if (isEncrypted && !password) {
      await updateStatus(supabase, importId, 'password_required', {
        file_hash: fileHash,
        error_message: 'This PDF is password protected. Please enter the password.',
      });
      return json({
        success: false,
        passwordRequired: true,
        message: 'This PDF is password protected.',
      });
    }

    // ── PHASE 2: DECRYPT if encrypted ──
    let pdfBytes: Uint8Array;

    if (isEncrypted && password) {
      await updateStatus(supabase, importId, 'processing', {
        error_message: null,
      });

      try {
        pdfBytes = await decryptPdf(new Uint8Array(fileBuffer), password);
        console.log(`[parse] Decrypted successfully, new size=${pdfBytes.byteLength}`);
      } catch (err: any) {
        if (err.message === 'WRONG_PASSWORD') {
          console.log('[parse] Wrong password provided');
          await updateStatus(supabase, importId, 'password_required', {
            file_hash: fileHash,
            error_message: 'Incorrect password. Please try again.',
          });
          return json({
            success: false,
            passwordRequired: true,
            message: 'Incorrect password. Please try again.',
          });
        }
        console.error('[parse] Decrypt error:', err);
        await updateStatus(supabase, importId, 'password_required', {
          file_hash: fileHash,
          error_message: 'Failed to decrypt PDF. Please verify the password.',
        });
        return json({
          success: false,
          passwordRequired: true,
          message: 'Failed to decrypt PDF.',
        });
      }
    } else {
      // Not encrypted
      pdfBytes = new Uint8Array(fileBuffer);
    }

    // ── PHASE 3: AI EXTRACTION ──
    await updateStatus(supabase, importId, 'processing', { file_hash: fileHash });

    // Check for duplicate
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

    // Convert decrypted bytes to base64
    const base64Data = base64Encode(pdfBytes);

    if (base64Data.length > 20 * 1024 * 1024) {
      await updateStatus(supabase, importId, 'failed', {
        error_message: 'File is too large for AI processing.',
      });
      return json({ success: false, error: 'File too large' }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      await updateStatus(supabase, importId, 'failed', { error_message: 'AI service not configured' });
      return json({ success: false, error: 'AI service not configured' }, 500);
    }

    const systemPrompt = `You are a bank statement parser. Extract ALL transactions from the provided bank statement PDF.

For each transaction extract:
- date: Transaction date in YYYY-MM-DD format
- description: The narration/description
- amount: Numeric amount (no currency symbols)
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
Include both debit and credit transactions.`;

    // AI call with 55s timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    let aiResponse: Response;
    try {
      aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Extract all transactions from this bank statement PDF.' },
                { type: 'image_url', image_url: { url: `data:application/pdf;base64,${base64Data}` } },
              ],
            },
          ],
          temperature: 0.1,
          max_tokens: 32000,
        }),
        signal: controller.signal,
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('[parse] AI fetch error:', err);
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      const errorMsg = isAbort
        ? 'Processing timed out. The file may be too large or complex.'
        : 'Failed to connect to AI service.';
      await updateStatus(supabase, importId, 'failed', { error_message: errorMsg });
      return json({ success: false, error: errorMsg }, 500);
    } finally {
      clearTimeout(timeoutId);
    }

    // Handle AI HTTP errors
    if (!aiResponse.ok) {
      const errText = await aiResponse.text().catch(() => 'Unknown');
      console.error('[parse] AI HTTP error:', aiResponse.status, errText);

      let errorMsg = 'AI service error. Please try again.';
      if (aiResponse.status === 429) errorMsg = 'Rate limited. Please try again in a minute.';
      if (aiResponse.status === 402) errorMsg = 'AI credits exhausted.';

      await updateStatus(supabase, importId, 'failed', { error_message: errorMsg });
      return json({ success: false, error: errorMsg }, aiResponse.status >= 400 && aiResponse.status < 500 ? aiResponse.status : 500);
    }

    // Parse AI response
    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content;

    if (!content || content.trim().length === 0) {
      console.error('[parse] Empty AI response');
      await updateStatus(supabase, importId, 'failed', { error_message: 'AI returned empty response. The PDF may be unreadable.' });
      return json({ success: false, error: 'AI returned no content' }, 500);
    }

    console.log('[parse] AI response length:', content.length, 'preview:', content.slice(0, 200));

    // Parse JSON
    let parsedData: any;
    try {
      parsedData = parseJsonFromAI(content);
    } catch (parseErr) {
      console.error('[parse] JSON parse error:', parseErr, 'raw:', content.slice(0, 500));
      await updateStatus(supabase, importId, 'failed', {
        error_message: 'Failed to parse AI response. The statement format may not be supported.',
      });
      return json({ success: false, error: 'Failed to parse extraction result' }, 500);
    }

    // Handle AI-reported errors
    if (parsedData.error === 'no_transactions') {
      await updateStatus(supabase, importId, 'failed', {
        file_hash: fileHash,
        error_message: 'No transactions found in this statement.',
      });
      return json({ success: false, error: 'No transactions found' }, 400);
    }

    // Extract transactions
    const { bankName, periodStart, periodEnd, transactions = [] } = parsedData;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      await updateStatus(supabase, importId, 'failed', {
        file_hash: fileHash, bank_name: bankName,
        error_message: 'No transactions found in the statement.',
      });
      return json({ success: false, error: 'No transactions extracted' }, 400);
    }

    // Filter valid transactions
    const validTransactions = transactions.filter((t: any) =>
      t && t.date && t.amount !== undefined && t.amount !== null
    );

    if (validTransactions.length === 0) {
      await updateStatus(supabase, importId, 'failed', {
        file_hash: fileHash, bank_name: bankName,
        error_message: 'No valid transactions found.',
      });
      return json({ success: false, error: 'No valid transactions' }, 400);
    }

    // Check for duplicates against existing expenses
    const { data: existingExpenses } = await supabase
      .from('expenses')
      .select('id, date, amount, note')
      .eq('user_id', user.id);

    const rows = validTransactions.map((t: any) => {
      const dup = existingExpenses?.find(
        (e: any) => e.date === t.date && Math.abs(Number(e.amount) - Math.abs(t.amount)) < 0.01
      );
      return {
        import_id: importId,
        user_id: user.id,
        transaction_date: t.date,
        description: (t.description || 'Unknown transaction').slice(0, 500),
        amount: Math.abs(t.amount),
        transaction_type: t.type || 'debit',
        balance: t.balance ?? null,
        raw_text: JSON.stringify(t),
        is_duplicate: !!dup,
        duplicate_of: dup?.id || null,
        is_selected: !dup,
      };
    });

    // Insert extracted transactions
    const { error: insertErr } = await supabase
      .from('extracted_transactions')
      .insert(rows);

    if (insertErr) {
      console.error('[parse] Insert error:', insertErr);
      await updateStatus(supabase, importId, 'failed', { error_message: 'Failed to save extracted transactions.' });
      return json({ success: false, error: 'Failed to save transactions' }, 500);
    }

    // ── SUCCESS ──
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
    return json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
