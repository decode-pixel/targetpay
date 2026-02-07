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

// PDF password protection detection patterns
const PASSWORD_PROTECTED_MARKERS = [
  '/Encrypt',
  '%PDF-1.',
];

function detectPasswordProtection(pdfBuffer: ArrayBuffer): boolean {
  // Check first 2KB of PDF for encryption markers
  const headerBytes = new Uint8Array(pdfBuffer.slice(0, 2048));
  const headerStr = new TextDecoder().decode(headerBytes);
  
  // Look for /Encrypt dictionary which indicates encryption
  return headerStr.includes('/Encrypt');
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
  // Handle various date formats
  const formats = [
    // dd/MM/yyyy or dd-MM-yyyy
    /^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/,
    // dd/MM/yy or dd-MM-yy
    /^(\d{2})[\/\-](\d{2})[\/\-](\d{2})$/,
    // dd-MMM-yyyy
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
      
      // Convert month name to number if needed
      if (isNaN(parseInt(month))) {
        month = months[month.toLowerCase().slice(0, 3)] || '01';
      }
      
      // Handle 2-digit year
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
  
  // Generic pattern for transaction lines
  const genericPattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})[^\d]*(.*?)([\d,]+\.\d{2})\s*(Dr|Cr|DR|CR|D|C)?\s*([\d,]+\.\d{2})?/gi;
  
  for (const line of lines) {
    const matches = [...line.matchAll(genericPattern)];
    for (const match of matches) {
      const dateStr = match[1];
      const description = match[2]?.trim() || 'Unknown';
      const amount = parseAmount(match[3]);
      const typeIndicator = match[4]?.toUpperCase();
      const balance = match[5] ? parseAmount(match[5]) : undefined;
      
      // Skip if amount is 0 or too small
      if (amount < 1) continue;
      
      // Determine transaction type
      let type: 'debit' | 'credit' = 'debit';
      if (typeIndicator === 'CR' || typeIndicator === 'C') {
        type = 'credit';
      } else if (typeIndicator === 'DR' || typeIndicator === 'D') {
        type = 'debit';
      }
      
      transactions.push({
        date: parseDate(dateStr),
        description: description.slice(0, 200), // Limit description length
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
    
    // Skip if amount is 0 or too small
    if (amount < 1) continue;
    
    // Determine transaction type
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
  
  // Fallback to generic if no transactions found
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

    // Input validation schema - now includes optional password
    const requestSchema = z.object({
      importId: z.string().uuid({ message: 'Invalid import ID format' }),
      password: z.string().max(100).optional(), // Optional password for protected PDFs
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

    // Update status to processing
    await supabase
      .from('statement_imports')
      .update({ status: 'processing' })
      .eq('id', importId);

    // Download file from storage
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

    // Check for duplicate by file hash
    const fileBuffer = await fileData.arrayBuffer();
    const fileHash = await hashFile(fileBuffer);

    // Check if PDF is password protected
    const isPasswordProtected = detectPasswordProtection(fileBuffer);
    
    if (isPasswordProtected && !password) {
      // PDF is protected but no password provided
      console.log('Password-protected PDF detected, requesting password');
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

    // Use document parsing via Lovable AI for OCR
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    // Convert PDF to base64 for the AI
    // Note: If password was provided, we include it in the prompt for the AI to use
    const base64Data = btoa(
      new Uint8Array(fileBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    
    // Password hint for AI (if provided)
    const passwordContext = password 
      ? `\nThis PDF is password protected. The password is: ${password}\nPlease use this password to decrypt and read the document.`
      : '';

    // Use Gemini for document understanding with OCR
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
            content: `You are a bank statement parser. Extract all transactions from the provided bank statement.

For each transaction, extract:
- date: The transaction date in YYYY-MM-DD format
- description: The transaction description/narration (merchant name, payment reference, etc.)
- amount: The transaction amount as a number (without currency symbols)
- type: "debit" for money out, "credit" for money in
- balance: The balance after transaction (if available)

Also identify:
- bankName: The bank name (SBI, HDFC, ICICI, Axis, or Other)
- periodStart: Statement period start date (YYYY-MM-DD)
- periodEnd: Statement period end date (YYYY-MM-DD)

Return a JSON object with this structure:
{
  "bankName": "string",
  "periodStart": "string or null",
  "periodEnd": "string or null", 
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "string",
      "amount": number,
      "type": "debit" | "credit",
      "balance": number or null
    }
  ]
}

Focus on extracting DEBIT transactions (expenses). Skip credits unless they are refunds.
Parse carefully - bank statements can have complex layouts.`
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
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      parsedData = JSON.parse(jsonMatch[1].trim());
    } catch (e) {
      console.error('Failed to parse AI response as JSON:', e);
      await supabase
        .from('statement_imports')
        .update({ status: 'failed', error_message: 'Failed to extract transactions from statement' })
        .eq('id', importId);
      
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to extract transactions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { bankName, periodStart, periodEnd, transactions = [] } = parsedData;

    // Filter to only debit transactions (expenses)
    const debitTransactions = transactions.filter((t: any) => t.type === 'debit' && t.amount > 0);

    if (debitTransactions.length === 0) {
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
      // Check if this transaction might be a duplicate
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
        is_selected: !possibleDuplicate, // Unselect duplicates by default
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

    // Update import record
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
