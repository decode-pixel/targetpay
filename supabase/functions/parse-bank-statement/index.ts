import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function detectPasswordProtection(pdfBuffer: ArrayBuffer): boolean {
  const scanSize = Math.min(pdfBuffer.byteLength, 16384);
  const bytes = new Uint8Array(pdfBuffer.slice(0, scanSize));
  const headerStr = new TextDecoder('latin1').decode(bytes);
  
  if (headerStr.includes('/Encrypt')) return true;
  if (headerStr.includes('/EncryptMetadata')) return true;
  if (headerStr.includes('/StmF') && headerStr.includes('/StrF')) return true;
  
  if (pdfBuffer.byteLength > scanSize) {
    const tailSize = Math.min(pdfBuffer.byteLength, 4096);
    const tailBytes = new Uint8Array(pdfBuffer.slice(pdfBuffer.byteLength - tailSize));
    const tailStr = new TextDecoder('latin1').decode(tailBytes);
    if (tailStr.includes('/Encrypt')) return true;
  }
  
  return false;
}

async function hashFile(content: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', content);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Helper to update import status and return a JSON response */
function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // We'll set these early so the catch block can update the import status
  let supabaseAdmin: ReturnType<typeof createClient> | null = null;
  let importId: string | null = null;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ success: false, error: 'Authorization required' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      return jsonResponse({ success: false, error: 'Invalid authentication' }, 401);
    }

    const requestSchema = z.object({
      importId: z.string().uuid({ message: 'Invalid import ID format' }),
      password: z.string().max(100).optional(),
    });

    let body;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400);
    }

    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      return jsonResponse({ success: false, error: 'Invalid request: ' + validation.error.errors[0]?.message }, 400);
    }

    importId = validation.data.importId;
    const password = validation.data.password;
    console.log(`Processing import ${importId} for user ${user.id}${password ? ' (with password)' : ''}`);

    // Get import record
    const { data: importRecord, error: importError } = await supabaseAdmin
      .from('statement_imports')
      .select('*')
      .eq('id', importId)
      .eq('user_id', user.id)
      .single();

    if (importError || !importRecord) {
      return jsonResponse({ success: false, error: 'Import not found' }, 404);
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('bank-statements')
      .download(importRecord.file_path);

    if (downloadError || !fileData) {
      console.error('File download failed:', downloadError);
      await supabaseAdmin.from('statement_imports')
        .update({ status: 'failed', error_message: 'Failed to download file' })
        .eq('id', importId);
      return jsonResponse({ success: false, error: 'Failed to download file' }, 500);
    }

    const fileBuffer = await fileData.arrayBuffer();
    const fileHash = await hashFile(fileBuffer);

    // ── STEP 1: Password protection check ──
    const isPasswordProtected = detectPasswordProtection(fileBuffer);
    
    if (isPasswordProtected && !password) {
      console.log('Password-protected PDF detected, requesting password');
      await supabaseAdmin.from('statement_imports')
        .update({ 
          status: 'password_required',
          error_message: 'This bank statement is password protected. Please provide the password to continue.',
          file_hash: fileHash,
        })
        .eq('id', importId);
      
      return jsonResponse({ 
        success: false, 
        passwordRequired: true,
        message: 'This bank statement is password protected. Please enter the password to continue.',
      });
    }

    // ── STEP 2: Set status to processing ──
    await supabaseAdmin.from('statement_imports')
      .update({ status: 'processing' })
      .eq('id', importId);

    // Check for duplicate by file hash
    const { data: existingImport } = await supabaseAdmin
      .from('statement_imports')
      .select('id, file_name, created_at')
      .eq('user_id', user.id)
      .eq('file_hash', fileHash)
      .eq('status', 'completed')
      .single();

    if (existingImport && existingImport.id !== importId) {
      await supabaseAdmin.from('statement_imports')
        .update({ 
          status: 'failed', 
          error_message: `This statement was already imported on ${new Date(existingImport.created_at).toLocaleDateString()}`,
          file_hash: fileHash,
        })
        .eq('id', importId);
      return jsonResponse({ success: false, error: 'Duplicate statement detected' }, 409);
    }

    // ── STEP 3: Base64 encode using Deno's efficient encoder (NOT string concatenation) ──
    const base64Data = base64Encode(new Uint8Array(fileBuffer));

    const passwordInstruction = (isPasswordProtected && password)
      ? `\nIMPORTANT: This PDF is password-protected. The document password is: ${password}\nUse this password to decrypt and read the document content.`
      : '';

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    // ── STEP 4: AI extraction with timeout ──
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

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
            {
              role: 'system',
              content: `You are a bank statement parser. Extract all transactions from the provided bank statement.${passwordInstruction}\n\nFor each transaction, extract:\n- date: The transaction date in YYYY-MM-DD format\n- description: The transaction description/narration\n- amount: The transaction amount as a number (without currency symbols)\n- type: "debit" for money out, "credit" for money in\n- balance: The balance after transaction (if available)\n\nAlso identify:\n- bankName: The bank name (SBI, HDFC, ICICI, Axis, or Other)\n- periodStart: Statement period start date (YYYY-MM-DD)\n- periodEnd: Statement period end date (YYYY-MM-DD)\n\nReturn ONLY a JSON object (no markdown, no code fences) with this structure:\n{\n  "bankName": "string",\n  "periodStart": "string or null",\n  "periodEnd": "string or null",\n  "transactions": [\n    {\n      "date": "YYYY-MM-DD",\n      "description": "string",\n      "amount": number,\n      "type": "debit" | "credit",\n      "balance": number or null\n    }\n  ]\n}\n\nFocus on extracting DEBIT transactions (expenses). Include credits only if they are refunds.\nIf the document is encrypted or unreadable, return: {"error": "encrypted", "transactions": []}\nIf no transactions found, return: {"error": "no_transactions", "transactions": []}`
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extract all transactions from this bank statement PDF. Focus on debit/expense transactions.',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:application/pdf;base64,${base64Data}`,
                  },
                },
              ],
            },
          ],
          temperature: 0.1,
          max_tokens: 8000,
        }),
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.error('AI request failed:', fetchError);
      
      const isTimeout = fetchError instanceof DOMException && fetchError.name === 'AbortError';
      const errMsg = isPasswordProtected && password
        ? 'Processing timed out. The password may be incorrect or the file is too large.'
        : isTimeout
          ? 'Processing timed out. Please try again with a smaller file.'
          : 'Failed to connect to AI service. Please try again.';

      // If password was provided and it timed out, go back to password_required
      const newStatus = (isPasswordProtected && password) ? 'password_required' : 'failed';
      await supabaseAdmin.from('statement_imports')
        .update({ status: newStatus, error_message: errMsg })
        .eq('id', importId);

      return jsonResponse({ 
        success: false, 
        error: errMsg,
        passwordRequired: newStatus === 'password_required',
        message: errMsg,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI parsing failed:', aiResponse.status, errorText);
      
      if (isPasswordProtected && password) {
        await supabaseAdmin.from('statement_imports')
          .update({ status: 'password_required', error_message: 'Failed to read PDF. The password may be incorrect.' })
          .eq('id', importId);
        return jsonResponse({ success: false, passwordRequired: true, message: 'Failed to read PDF. The password may be incorrect.' });
      }
      
      await supabaseAdmin.from('statement_imports')
        .update({ status: 'failed', error_message: 'Failed to parse PDF. Please ensure it is a valid bank statement.' })
        .eq('id', importId);
      return jsonResponse({ success: false, error: 'Failed to parse PDF' }, 500);
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error('AI returned empty content');
      await supabaseAdmin.from('statement_imports')
        .update({ status: 'failed', error_message: 'AI returned no content. Please try again.' })
        .eq('id', importId);
      return jsonResponse({ success: false, error: 'AI returned no content' }, 500);
    }

    console.log('AI response preview:', content.slice(0, 300));

    // Parse AI JSON response
    let parsedData;
    try {
      // Strip markdown code fences if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      parsedData = JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse AI response:', e, 'Content:', content.slice(0, 500));
      
      if (isPasswordProtected && password) {
        await supabaseAdmin.from('statement_imports')
          .update({ status: 'password_required', error_message: 'Could not read PDF content. The password may be incorrect.' })
          .eq('id', importId);
        return jsonResponse({ success: false, passwordRequired: true, message: 'Could not read PDF content. The password may be incorrect.' });
      }
      
      await supabaseAdmin.from('statement_imports')
        .update({ status: 'failed', error_message: 'Failed to extract transactions from statement.' })
        .eq('id', importId);
      return jsonResponse({ success: false, error: 'Failed to extract transactions' }, 500);
    }

    // Check if AI reported encrypted
    if (parsedData.error === 'encrypted') {
      const msg = password
        ? 'The password appears to be incorrect. Please try again.'
        : 'This document is encrypted. Please provide the password.';
      await supabaseAdmin.from('statement_imports')
        .update({ status: 'password_required', error_message: msg, file_hash: fileHash })
        .eq('id', importId);
      return jsonResponse({ success: false, passwordRequired: true, message: msg });
    }

    const { bankName, periodStart, periodEnd, transactions = [] } = parsedData;
    const debitTransactions = transactions.filter((t: any) => t.type === 'debit' && t.amount > 0);

    if (debitTransactions.length === 0) {
      if (isPasswordProtected && password) {
        await supabaseAdmin.from('statement_imports')
          .update({ status: 'password_required', error_message: 'No transactions found. The password may be incorrect.', file_hash: fileHash, bank_name: bankName })
          .eq('id', importId);
        return jsonResponse({ success: false, passwordRequired: true, message: 'No transactions could be extracted. Please verify the password.' });
      }

      await supabaseAdmin.from('statement_imports')
        .update({ status: 'failed', error_message: 'No expense transactions found in the statement.', file_hash: fileHash, bank_name: bankName })
        .eq('id', importId);
      return jsonResponse({ success: false, error: 'No expense transactions found' }, 400);
    }

    // Check for duplicate transactions
    const { data: existingExpenses } = await supabaseAdmin
      .from('expenses')
      .select('id, date, amount, note')
      .eq('user_id', user.id);

    const extractedTransactions = debitTransactions.map((t: any) => {
      const possibleDuplicate = existingExpenses?.find(e => 
        e.date === t.date && Math.abs(Number(e.amount) - t.amount) < 0.01
      );
      return {
        import_id: importId,
        user_id: user.id,
        transaction_date: t.date,
        description: t.description || 'Unknown transaction',
        amount: t.amount,
        transaction_type: 'debit',
        balance: t.balance,
        raw_text: JSON.stringify(t),
        is_duplicate: !!possibleDuplicate,
        duplicate_of: possibleDuplicate?.id || null,
        is_selected: !possibleDuplicate,
      };
    });

    const { error: insertError } = await supabaseAdmin
      .from('extracted_transactions')
      .insert(extractedTransactions);

    if (insertError) {
      console.error('Failed to insert transactions:', insertError);
      await supabaseAdmin.from('statement_imports')
        .update({ status: 'failed', error_message: 'Failed to save extracted transactions.' })
        .eq('id', importId);
      return jsonResponse({ success: false, error: 'Failed to save transactions' }, 500);
    }

    // Success
    await supabaseAdmin.from('statement_imports')
      .update({
        status: 'extracted',
        bank_name: bankName,
        statement_period_start: periodStart,
        statement_period_end: periodEnd,
        total_transactions: debitTransactions.length,
        file_hash: fileHash,
      })
      .eq('id', importId);

    console.log(`Extracted ${debitTransactions.length} transactions from ${bankName} statement`);

    return jsonResponse({
      success: true,
      bankName,
      transactionCount: debitTransactions.length,
      periodStart,
      periodEnd,
    });

  } catch (error) {
    console.error('Unhandled parse error:', error);
    
    // CRITICAL: Update import status so frontend doesn't stay stuck
    if (supabaseAdmin && importId) {
      try {
        await supabaseAdmin.from('statement_imports')
          .update({ status: 'failed', error_message: 'An unexpected error occurred. Please try again.' })
          .eq('id', importId);
      } catch (updateErr) {
        console.error('Failed to update import status after error:', updateErr);
      }
    }

    return jsonResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
