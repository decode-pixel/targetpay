import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Bank-specific parsing patterns for major Indian banks
const BANK_PATTERNS = {
  SBI: {
    identifier: /State Bank of India|SBI/i,
    dateFormats: ['dd/MM/yyyy', 'dd-MM-yyyy'],
    transactionPattern: /(\d{2}[\/\-]\d{2}[\/\-]\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s*(Dr|Cr)?\s*([\d,]+\.\d{2})?/gi,
  },
  HDFC: {
    identifier: /HDFC Bank/i,
    dateFormats: ['dd/MM/yy', 'dd-MM-yy'],
    transactionPattern: /(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})\s+(.+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})?/gi,
  },
  ICICI: {
    identifier: /ICICI Bank/i,
    dateFormats: ['dd-MMM-yyyy', 'dd/MM/yyyy'],
    transactionPattern: /(\d{2}[-\/]\w{3}[-\/]\d{4}|\d{2}[\/\-]\d{2}[\/\-]\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s*(DR|CR)?\s*([\d,]+\.\d{2})?/gi,
  },
  AXIS: {
    identifier: /Axis Bank/i,
    dateFormats: ['dd-MM-yyyy', 'dd/MM/yyyy'],
    transactionPattern: /(\d{2}[-\/]\d{2}[-\/]\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})?/gi,
  },
};

interface Transaction {
  date: string;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
  balance?: number;
  rawText: string;
}

/**
 * Detect PDF password protection by scanning the raw PDF bytes for encryption markers.
 * Scans up to 16KB to handle PDFs where the /Encrypt dictionary appears after the header.
 */
function detectPasswordProtection(pdfBuffer: ArrayBuffer): boolean {
  // Scan up to 16KB (or full file if smaller) for encryption markers
  const scanSize = Math.min(pdfBuffer.byteLength, 16384);
  const bytes = new Uint8Array(pdfBuffer.slice(0, scanSize));
  const headerStr = new TextDecoder('latin1').decode(bytes);
  
  // Primary marker: /Encrypt dictionary indicates PDF-level encryption
  if (headerStr.includes('/Encrypt')) return true;
  
  // Additional markers for various encryption schemes
  if (headerStr.includes('/EncryptMetadata')) return true;
  if (headerStr.includes('/StmF') && headerStr.includes('/StrF')) return true;
  
  // If the file is larger, also scan the last 4KB (xref/trailer area)
  if (pdfBuffer.byteLength > scanSize) {
    const tailSize = Math.min(pdfBuffer.byteLength, 4096);
    const tailBytes = new Uint8Array(pdfBuffer.slice(pdfBuffer.byteLength - tailSize));
    const tailStr = new TextDecoder('latin1').decode(tailBytes);
    if (tailStr.includes('/Encrypt')) return true;
  }
  
  return false;
}

function detectBank(text: string): string | null {
  for (const [bankName, pattern] of Object.entries(BANK_PATTERNS)) {
    if (pattern.identifier.test(text)) {
      return bankName;
    }
  }
  return null;
}

function parseDate(dateStr: string): string {
  const formats = [
    /^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/,
    /^(\d{2})[\/\-](\d{2})[\/\-](\d{2})$/,
    /^(\d{2})[\/\-](\w{3})[\/\-](\d{4})$/,
  ];

  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      let [_, day, month, year] = match;
      if (isNaN(parseInt(month))) {
        month = months[month.toLowerCase().slice(0, 3)] || '01';
      }
      if (year.length === 2) {
        year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
      }
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }
  return dateStr;
}

function parseAmount(amountStr: string): number {
  return parseFloat(amountStr.replace(/,/g, ''));
}

function extractTransactionsGeneric(text: string): Transaction[] {
  const transactions: Transaction[] = [];
  const lines = text.split('\n');
  const genericPattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})[^\d]*(.*?)([\d,]+\.\d{2})\s*(Dr|Cr|DR|CR|D|C)?\s*([\d,]+\.\d{2})?/gi;
  
  for (const line of lines) {
    const matches = [...line.matchAll(genericPattern)];
    for (const match of matches) {
      const dateStr = match[1];
      const description = match[2]?.trim() || 'Unknown';
      const amount = parseAmount(match[3]);
      const typeIndicator = match[4]?.toUpperCase();
      const balance = match[5] ? parseAmount(match[5]) : undefined;
      if (amount < 1) continue;
      let type: 'debit' | 'credit' = 'debit';
      if (typeIndicator === 'CR' || typeIndicator === 'C') {
        type = 'credit';
      }
      transactions.push({
        date: parseDate(dateStr),
        description: description.slice(0, 200),
        amount,
        type,
        balance,
        rawText: line.trim().slice(0, 500),
      });
    }
  }
  return transactions;
}

function extractTransactionsForBank(text: string, bankName: string): Transaction[] {
  const pattern = BANK_PATTERNS[bankName as keyof typeof BANK_PATTERNS];
  if (!pattern) {
    return extractTransactionsGeneric(text);
  }
  const transactions: Transaction[] = [];
  const matches = [...text.matchAll(pattern.transactionPattern)];
  for (const match of matches) {
    const dateStr = match[1];
    const description = match[2]?.trim() || 'Unknown';
    const amount = parseAmount(match[3]);
    const typeIndicator = match[4]?.toUpperCase();
    const balance = match[5] ? parseAmount(match[5]) : undefined;
    if (amount < 1) continue;
    let type: 'debit' | 'credit' = 'debit';
    if (typeIndicator === 'CR' || typeIndicator === 'C') {
      type = 'credit';
    }
    transactions.push({
      date: parseDate(dateStr),
      description: description.slice(0, 200),
      amount,
      type,
      balance,
      rawText: match[0].slice(0, 500),
    });
  }
  if (transactions.length === 0) {
    return extractTransactionsGeneric(text);
  }
  return transactions;
}

async function hashFile(content: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', content);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Input validation schema
    const requestSchema = z.object({
      importId: z.string().uuid({ message: 'Invalid import ID format' }),
      password: z.string().max(100).optional(),
    });

    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      console.error('Validation error:', validation.error.errors);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid request: ' + validation.error.errors[0]?.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { importId, password } = validation.data;
    console.log(`Processing import ${importId} for user ${user.id}${password ? ' (with password)' : ''}`);

    // Get import record
    const { data: importRecord, error: importError } = await supabase
      .from('statement_imports')
      .select('*')
      .eq('id', importId)
      .eq('user_id', user.id)
      .single();

    if (importError || !importRecord) {
      console.error('Import not found:', importError);
      return new Response(
        JSON.stringify({ success: false, error: 'Import not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Download file from storage FIRST — before any processing
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('bank-statements')
      .download(importRecord.file_path);

    if (downloadError || !fileData) {
      console.error('File download failed:', downloadError);
      await supabase
        .from('statement_imports')
        .update({ status: 'failed', error_message: 'Failed to download file' })
        .eq('id', importId);
      
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to download file' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fileBuffer = await fileData.arrayBuffer();
    const fileHash = await hashFile(fileBuffer);

    // ── STEP 1: Password protection check BEFORE any extraction ──
    const isPasswordProtected = detectPasswordProtection(fileBuffer);
    
    if (isPasswordProtected && !password) {
      // PDF is encrypted and no password provided — halt and ask user
      console.log('Password-protected PDF detected, halting extraction and requesting password');
      await supabase
        .from('statement_imports')
        .update({ 
          status: 'password_required',
          error_message: 'This bank statement is password protected. Please provide the password to continue.',
          file_hash: fileHash 
        })
        .eq('id', importId);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Password required',
          passwordRequired: true,
          message: 'This bank statement is password protected. Please enter the password to continue.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── STEP 2: Only now set status to processing ──
    await supabase
      .from('statement_imports')
      .update({ status: 'processing' })
      .eq('id', importId);

    // Check for duplicate by file hash
    const { data: existingImport } = await supabase
      .from('statement_imports')
      .select('id, file_name, created_at')
      .eq('user_id', user.id)
      .eq('file_hash', fileHash)
      .eq('status', 'completed')
      .single();

    if (existingImport && existingImport.id !== importId) {
      await supabase
        .from('statement_imports')
        .update({ 
          status: 'failed', 
          error_message: `This statement was already imported on ${new Date(existingImport.created_at).toLocaleDateString()}`,
          file_hash: fileHash 
        })
        .eq('id', importId);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Duplicate statement detected',
          duplicateOf: existingImport.id 
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── STEP 3: Send to AI for extraction ──
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    const base64Data = btoa(
      new Uint8Array(fileBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    
    // If password-protected and password provided, include instruction for AI
    const passwordInstruction = (isPasswordProtected && password)
      ? `\nIMPORTANT: This PDF is password-protected. The document password is: ${password}\nUse this password to decrypt and read the document content.`
      : '';

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: `You are a bank statement parser. Extract all transactions from the provided bank statement.${passwordInstruction}\n\nFor each transaction, extract:\n- date: The transaction date in YYYY-MM-DD format\n- description: The transaction description/narration (merchant name, payment reference, etc.)\n- amount: The transaction amount as a number (without currency symbols)\n- type: "debit" for money out, "credit" for money in\n- balance: The balance after transaction (if available)\n\nAlso identify:\n- bankName: The bank name (SBI, HDFC, ICICI, Axis, or Other)\n- periodStart: Statement period start date (YYYY-MM-DD)\n- periodEnd: Statement period end date (YYYY-MM-DD)\n\nReturn a JSON object with this structure:\n{\n  "bankName": "string",\n  "periodStart": "string or null",\n  "periodEnd": "string or null", \n  "transactions": [\n    {\n      "date": "YYYY-MM-DD",\n      "description": "string",\n      "amount": number,\n      "type": "debit" | "credit",\n      "balance": number or null\n    }\n  ]\n}\n\nFocus on extracting DEBIT transactions (expenses). Skip credits unless they are refunds.\nParse carefully - bank statements can have complex layouts.\nIf the document is encrypted or unreadable, return: {\"error\": \"encrypted\", \"transactions\": []}`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please extract all transactions from this bank statement PDF. Focus on debit/expense transactions.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${base64Data}`
                }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 8000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI parsing failed:', aiResponse.status, errorText);
      
      // If this was a password attempt, give a specific error
      if (isPasswordProtected && password) {
        await supabase
          .from('statement_imports')
          .update({ 
            status: 'password_required', 
            error_message: 'Could not read the PDF with the provided password. Please check and try again.' 
          })
          .eq('id', importId);
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Incorrect password or unreadable PDF',
            passwordRequired: true,
            message: 'Could not read the PDF with the provided password. Please try again.'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      await supabase
        .from('statement_imports')
        .update({ status: 'failed', error_message: 'Failed to parse PDF. Please ensure it is a valid bank statement.' })
        .eq('id', importId);
      
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to parse PDF' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content;
    
    console.log('AI response:', content?.slice(0, 500));

    // Parse the JSON from AI response
    let parsedData;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      parsedData = JSON.parse(jsonMatch[1].trim());
    } catch (e) {
      console.error('Failed to parse AI response as JSON:', e);
      
      // If password-protected, the AI likely couldn't read it — ask for password retry
      if (isPasswordProtected && password) {
        await supabase
          .from('statement_imports')
          .update({ 
            status: 'password_required', 
            error_message: 'The password may be incorrect, or the PDF format is not supported. Please try again.' 
          })
          .eq('id', importId);
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Incorrect password',
            passwordRequired: true,
            message: 'Could not extract data. The password may be incorrect. Please try again.'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      await supabase
        .from('statement_imports')
        .update({ status: 'failed', error_message: 'Failed to extract transactions from statement' })
        .eq('id', importId);
      
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to extract transactions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if AI explicitly reported the document as encrypted/unreadable
    if (parsedData.error === 'encrypted') {
      console.log('AI reported document as encrypted');
      await supabase
        .from('statement_imports')
        .update({ 
          status: 'password_required', 
          error_message: password 
            ? 'The password appears to be incorrect. Please try again.'
            : 'This document is encrypted. Please provide the password.',
          file_hash: fileHash 
        })
        .eq('id', importId);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Password required',
          passwordRequired: true,
          message: password 
            ? 'The password appears to be incorrect. Please try again.'
            : 'This document is encrypted. Please provide the password.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { bankName, periodStart, periodEnd, transactions = [] } = parsedData;

    // Filter to only debit transactions (expenses)
    const debitTransactions = transactions.filter((t: any) => t.type === 'debit' && t.amount > 0);

    if (debitTransactions.length === 0) {
      // If password was provided but no transactions found, it may be a wrong password
      if (isPasswordProtected && password) {
        await supabase
          .from('statement_imports')
          .update({ 
            status: 'password_required', 
            error_message: 'No transactions found. The password may be incorrect. Please try again.',
            file_hash: fileHash,
            bank_name: bankName
          })
          .eq('id', importId);
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'No transactions found — password may be incorrect',
            passwordRequired: true,
            message: 'No transactions could be extracted. Please verify the password and try again.'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await supabase
        .from('statement_imports')
        .update({ 
          status: 'failed', 
          error_message: 'No expense transactions found in the statement',
          file_hash: fileHash,
          bank_name: bankName
        })
        .eq('id', importId);
      
      return new Response(
        JSON.stringify({ success: false, error: 'No expense transactions found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for duplicate transactions against existing expenses
    const { data: existingExpenses } = await supabase
      .from('expenses')
      .select('id, date, amount, note')
      .eq('user_id', user.id);

    // Insert extracted transactions
    const extractedTransactions = debitTransactions.map((t: any) => {
      const possibleDuplicate = existingExpenses?.find(e => 
        e.date === t.date && 
        Math.abs(Number(e.amount) - t.amount) < 0.01
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

    const { error: insertError } = await supabase
      .from('extracted_transactions')
      .insert(extractedTransactions);

    if (insertError) {
      console.error('Failed to insert transactions:', insertError);
      await supabase
        .from('statement_imports')
        .update({ status: 'failed', error_message: 'Failed to save extracted transactions' })
        .eq('id', importId);
      
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to save transactions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update import record — extraction successful
    await supabase
      .from('statement_imports')
      .update({
        status: 'extracted',
        bank_name: bankName,
        statement_period_start: periodStart,
        statement_period_end: periodEnd,
        total_transactions: debitTransactions.length,
        file_hash: fileHash,
      })
      .eq('id', importId);

    // Password is NOT stored or logged — it was only used in the AI prompt above
    // and goes out of scope here.
    console.log(`Extracted ${debitTransactions.length} transactions from ${bankName} statement`);

    return new Response(
      JSON.stringify({
        success: true,
        bankName,
        transactionCount: debitTransactions.length,
        periodStart,
        periodEnd,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Parse error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
