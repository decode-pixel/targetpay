import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

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
  await supabase
    .from('statement_imports')
    .update({ status, ...extra })
    .eq('id', importId);
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
    let body: { importId?: string; password?: string; phase?: string };
    try {
      body = await req.json();
    } catch {
      return json({ success: false, error: 'Invalid JSON body' }, 400);
    }

    importId = body.importId || null;
    const password = body.password;
    const phase = body.phase || 'auto'; // 'check_encryption', 'extract', 'auto'

    if (!importId) return json({ success: false, error: 'importId is required' }, 400);

    console.log(`[parse] Phase=${phase} importId=${importId} hasPassword=${!!password}`);

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

    // ── PHASE 1: ENCRYPTION CHECK ──
    const isEncrypted = detectEncryption(fileBuffer);
    console.log(`[parse] Encrypted=${isEncrypted}, fileSize=${fileBuffer.byteLength}`);

    if (phase === 'check_encryption' || (phase === 'auto' && isEncrypted && !password)) {
      if (isEncrypted) {
        await updateStatus(supabase, importId, 'password_required', {
          file_hash: fileHash,
          error_message: 'This PDF is password protected. Please enter the password.',
        });
        return json({
          success: false,
          passwordRequired: true,
          message: 'This PDF is password protected. Please enter the password.',
        });
      } else if (phase === 'check_encryption') {
        // Not encrypted, just return status
        return json({ success: true, passwordRequired: false });
      }
      // If phase=auto and not encrypted, fall through to extraction
    }

    // ── PHASE 2: PASSWORD VALIDATION (for encrypted PDFs) ──
    if (isEncrypted && password) {
      // We can't actually decrypt the PDF in edge functions.
      // We'll send it to AI with the password hint. If AI can't read it, we report wrong password.
      console.log('[parse] Attempting extraction with password hint');
    } else if (isEncrypted && !password) {
      await updateStatus(supabase, importId, 'password_required', {
        file_hash: fileHash,
        error_message: 'Password is required for this encrypted PDF.',
      });
      return json({ success: false, passwordRequired: true, message: 'Password required' });
    }

    // ── PHASE 3: EXTRACTION ──
    await updateStatus(supabase, importId, 'processing');

    // Check for duplicate import
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

    // Convert to base64 for AI
    const base64Data = base64Encode(new Uint8Array(fileBuffer));

    // Check if base64 is too large (> ~20MB base64 = ~15MB file)
    if (base64Data.length > 20 * 1024 * 1024) {
      await updateStatus(supabase, importId, 'failed', {
        error_message: 'File is too large for AI processing. Please try a smaller statement.',
      });
      return json({ success: false, error: 'File too large for processing' }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      await updateStatus(supabase, importId, 'failed', { error_message: 'AI service not configured' });
      return json({ success: false, error: 'AI service not configured' }, 500);
    }

    // Build extraction prompt
    const passwordHint = isEncrypted && password
      ? `\n\nIMPORTANT: This PDF is password-protected. The document password is: "${password}". Use this to decrypt and read the content.`
      : '';

    const systemPrompt = `You are a bank statement parser. Extract ALL transactions from the provided bank statement PDF.${passwordHint}

For each transaction extract:
- date: Transaction date in YYYY-MM-DD format
- description: The narration/description
- amount: Numeric amount (no currency symbols)
- type: "debit" for expenses/money out, "credit" for income/money in
- balance: Balance after transaction if shown, otherwise null

Also identify:
- bankName: Bank name (e.g. SBI, HDFC, ICICI, Axis, or the actual name)
- periodStart: Statement start date YYYY-MM-DD (or null)
- periodEnd: Statement end date YYYY-MM-DD (or null)

Return ONLY valid JSON (no markdown fences):
{
  "bankName": "string",
  "periodStart": "YYYY-MM-DD or null",
  "periodEnd": "YYYY-MM-DD or null",
  "transactions": [
    { "date": "YYYY-MM-DD", "description": "string", "amount": 123.45, "type": "debit", "balance": null }
  ]
}

If the PDF is encrypted/unreadable, return: {"error": "encrypted", "transactions": []}
If no transactions found, return: {"error": "no_transactions", "transactions": []}
Include both debit and credit transactions.`;

    // AI call with 60s timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

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
                { type: 'text', text: 'Extract all transactions from this bank statement.' },
                { type: 'image_url', image_url: { url: `data:application/pdf;base64,${base64Data}` } },
              ],
            },
          ],
          temperature: 0.1,
          max_tokens: 16000,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('[parse] AI fetch error:', err);

      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      const errorMsg = isAbort
        ? 'Processing timed out. The file may be too large or complex.'
        : 'Failed to connect to AI service.';

      // For encrypted PDFs with password, go back to password_required so user can retry
      if (isEncrypted && password) {
        await updateStatus(supabase, importId, 'password_required', {
          error_message: 'Processing timed out. The password may be incorrect or the file is too complex.',
        });
        return json({
          success: false,
          passwordRequired: true,
          message: 'Processing timed out. Please verify the password and try again.',
        });
      }

      await updateStatus(supabase, importId, 'failed', { error_message: errorMsg });
      return json({ success: false, error: errorMsg }, 500);
    } finally {
      clearTimeout(timeoutId);
    }

    // Handle AI HTTP errors
    if (!aiResponse.ok) {
      const errText = await aiResponse.text().catch(() => 'Unknown');
      console.error('[parse] AI HTTP error:', aiResponse.status, errText);

      if (aiResponse.status === 429) {
        await updateStatus(supabase, importId, 'failed', { error_message: 'Rate limited. Please try again in a minute.' });
        return json({ success: false, error: 'Rate limited. Please try again later.' }, 429);
      }
      if (aiResponse.status === 402) {
        await updateStatus(supabase, importId, 'failed', { error_message: 'AI credits exhausted.' });
        return json({ success: false, error: 'AI credits exhausted.' }, 402);
      }

      if (isEncrypted && password) {
        await updateStatus(supabase, importId, 'password_required', {
          error_message: 'Failed to read PDF. The password may be incorrect.',
        });
        return json({ success: false, passwordRequired: true, message: 'Failed to read PDF. The password may be incorrect.' });
      }

      await updateStatus(supabase, importId, 'failed', { error_message: 'AI service error. Please try again.' });
      return json({ success: false, error: 'AI service error' }, 500);
    }

    // Parse AI response
    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content;

    if (!content || content.trim().length === 0) {
      console.error('[parse] Empty AI response');
      if (isEncrypted && password) {
        await updateStatus(supabase, importId, 'password_required', {
          error_message: 'Could not read PDF content. The password may be incorrect.',
        });
        return json({ success: false, passwordRequired: true, message: 'Could not read PDF. Check the password.' });
      }
      await updateStatus(supabase, importId, 'failed', { error_message: 'AI returned empty response. The PDF may be unreadable.' });
      return json({ success: false, error: 'AI returned no content' }, 500);
    }

    console.log('[parse] AI response length:', content.length, 'preview:', content.slice(0, 200));

    // Parse JSON from AI
    let parsedData: any;
    try {
      // Strip markdown fences if present
      const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = fenceMatch ? fenceMatch[1].trim() : content.trim();
      parsedData = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error('[parse] JSON parse error:', parseErr, 'raw:', content.slice(0, 500));
      if (isEncrypted && password) {
        await updateStatus(supabase, importId, 'password_required', {
          error_message: 'Could not extract data. The password may be incorrect.',
        });
        return json({ success: false, passwordRequired: true, message: 'Could not extract data. Check the password.' });
      }
      await updateStatus(supabase, importId, 'failed', {
        error_message: 'Failed to parse AI response. The statement format may not be supported.',
      });
      return json({ success: false, error: 'Failed to parse extraction result' }, 500);
    }

    // Handle AI-reported errors
    if (parsedData.error === 'encrypted') {
      const msg = password
        ? 'The password appears to be incorrect. Please try again.'
        : 'This PDF is encrypted. Please provide the password.';
      await updateStatus(supabase, importId, 'password_required', { file_hash: fileHash, error_message: msg });
      return json({ success: false, passwordRequired: true, message: msg });
    }

    if (parsedData.error === 'no_transactions') {
      if (isEncrypted && password) {
        await updateStatus(supabase, importId, 'password_required', {
          file_hash: fileHash,
          error_message: 'No transactions found. The password may be incorrect.',
        });
        return json({ success: false, passwordRequired: true, message: 'No transactions found. Check the password.' });
      }
      await updateStatus(supabase, importId, 'failed', {
        file_hash: fileHash,
        error_message: 'No transactions found in this statement.',
      });
      return json({ success: false, error: 'No transactions found' }, 400);
    }

    // Extract transactions
    const { bankName, periodStart, periodEnd, transactions = [] } = parsedData;
    const debitTransactions = transactions.filter((t: any) => t.type === 'debit' && t.amount > 0);

    if (debitTransactions.length === 0 && transactions.length === 0) {
      if (isEncrypted && password) {
        await updateStatus(supabase, importId, 'password_required', {
          file_hash: fileHash, bank_name: bankName,
          error_message: 'No transactions extracted. The password may be incorrect.',
        });
        return json({ success: false, passwordRequired: true, message: 'No transactions extracted. Verify the password.' });
      }
      await updateStatus(supabase, importId, 'failed', {
        file_hash: fileHash, bank_name: bankName,
        error_message: 'No expense transactions found in the statement.',
      });
      return json({ success: false, error: 'No expense transactions found' }, 400);
    }

    // Use all transactions if no debit-only found
    const finalTransactions = debitTransactions.length > 0 ? debitTransactions : transactions.filter((t: any) => t.amount > 0);

    // Check for duplicate expenses
    const { data: existingExpenses } = await supabase
      .from('expenses')
      .select('id, date, amount, note')
      .eq('user_id', user.id);

    const rows = finalTransactions.map((t: any) => {
      const dup = existingExpenses?.find(
        e => e.date === t.date && Math.abs(Number(e.amount) - t.amount) < 0.01
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
