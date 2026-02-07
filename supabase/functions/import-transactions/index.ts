import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Input validation schema with array size limits
    const transactionUpdateSchema = z.object({
      id: z.string().uuid({ message: 'Invalid transaction ID format' }),
      category_id: z.string().uuid({ message: 'Invalid category ID format' }).optional(),
    });

    const requestSchema = z.object({
      importId: z.string().uuid({ message: 'Invalid import ID format' }),
      transactions: z.array(transactionUpdateSchema).max(1000, { message: 'Maximum 1000 transactions per import' }).optional(),
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

    const { importId, transactions: transactionUpdates } = validation.data;
    console.log(`Importing transactions for import ${importId}`);

    // Get selected transactions with updated data
    const { data: extractedTransactions, error: txError } = await supabase
      .from('extracted_transactions')
      .select('*')
      .eq('import_id', importId)
      .eq('user_id', user.id)
      .eq('is_selected', true);

    if (txError || !extractedTransactions || extractedTransactions.length === 0) {
      console.error('No selected transactions:', txError);
      return new Response(
        JSON.stringify({ success: false, error: 'No transactions selected for import' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Apply any client-side updates (category changes, etc.) - types inferred from zod schema
    const updateMap = new Map(
      transactionUpdates?.map((t) => [t.id, t]) || []
    );

    // Convert extracted transactions to expenses
    const expenses = extractedTransactions.map(tx => {
      const update = updateMap.get(tx.id);
      return {
        user_id: user.id,
        category_id: update?.category_id || tx.suggested_category_id,
        amount: tx.amount,
        date: tx.transaction_date,
        payment_method: 'bank', // Imported from bank statement
        note: tx.description.slice(0, 500),
        is_draft: false,
      };
    });

    // Insert expenses
    const { data: insertedExpenses, error: insertError } = await supabase
      .from('expenses')
      .insert(expenses)
      .select('id');

    if (insertError) {
      console.error('Failed to insert expenses:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to import expenses' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update category mappings based on user confirmations (learn from user)
    for (const tx of extractedTransactions) {
      const update = updateMap.get(tx.id);
      const finalCategoryId = update?.category_id || tx.suggested_category_id;
      
      if (finalCategoryId && tx.description) {
        // Extract keywords from description for learning
        const keywords = tx.description
          .toLowerCase()
          .split(/[\s\-\/\\|@#$%^&*()+=\[\]{}:;"'<>,.?!]+/)
          .filter((word: string) => word.length >= 3 && word.length <= 20)
          .slice(0, 3);

        for (const keyword of keywords) {
          // Skip common words
          const skipWords = ['the', 'and', 'for', 'from', 'upi', 'neft', 'imps', 'rtgs', 'transfer', 'payment', 'ref', 'txn'];
          if (skipWords.includes(keyword)) continue;

          await supabase
            .from('category_mappings')
            .upsert({
              user_id: user.id,
              keyword,
              category_id: finalCategoryId,
              usage_count: 1,
            }, {
              onConflict: 'user_id,keyword',
            })
            .then(async ({ error }) => {
              if (!error) {
                // Increment usage count for existing mappings
                await supabase.rpc('increment_mapping_count', {
                  p_user_id: user.id,
                  p_keyword: keyword,
                });
              }
            });
        }
      }
    }

    // Update import record
    await supabase
      .from('statement_imports')
      .update({
        status: 'completed',
        imported_transactions: insertedExpenses?.length || 0,
      })
      .eq('id', importId);

    // Clean up extracted transactions
    await supabase
      .from('extracted_transactions')
      .delete()
      .eq('import_id', importId);

    // Delete the statement file (user chose 24-hour retention, but cleanup after import is complete)
    const { data: importRecord } = await supabase
      .from('statement_imports')
      .select('file_path')
      .eq('id', importId)
      .single();

    if (importRecord?.file_path) {
      await supabase.storage
        .from('bank-statements')
        .remove([importRecord.file_path]);
    }

    console.log(`Successfully imported ${insertedExpenses?.length} expenses`);

    return new Response(
      JSON.stringify({
        success: true,
        importedCount: insertedExpenses?.length || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Import error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
