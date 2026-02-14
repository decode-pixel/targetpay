import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ success: false, error: 'Authorization required' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return json({ success: false, error: 'Invalid authentication' }, 401);

    let body: any;
    try { body = await req.json(); } catch {
      return json({ success: false, error: 'Invalid JSON body' }, 400);
    }

    const importId = body?.importId;
    if (!importId || typeof importId !== 'string' || !isValidUUID(importId)) {
      return json({ success: false, error: 'Invalid import ID format' }, 400);
    }

    // Validate transactions array if provided
    const transactionUpdates: { id: string; category_id: string | null }[] = [];
    if (Array.isArray(body.transactions)) {
      if (body.transactions.length > 1000) {
        return json({ success: false, error: 'Maximum 1000 transactions per import' }, 400);
      }
      for (const t of body.transactions) {
        if (!t || typeof t !== 'object') continue;
        if (!t.id || typeof t.id !== 'string' || !isValidUUID(t.id)) continue;
        // Handle category_id: accept string UUID, null, undefined, or empty string
        let categoryId: string | null = null;
        if (t.category_id && typeof t.category_id === 'string' && isValidUUID(t.category_id)) {
          categoryId = t.category_id;
        }
        transactionUpdates.push({ id: t.id, category_id: categoryId });
      }
    }

    console.log(`[import] importId=${importId}, updates=${transactionUpdates.length}`);

    // Get selected transactions
    const { data: extractedTransactions, error: txError } = await supabase
      .from('extracted_transactions')
      .select('*')
      .eq('import_id', importId)
      .eq('user_id', user.id)
      .eq('is_selected', true);

    if (txError) {
      console.error('[import] Fetch error:', txError);
      return json({ success: false, error: 'Failed to fetch transactions' }, 500);
    }

    if (!extractedTransactions || extractedTransactions.length === 0) {
      return json({ success: false, error: 'No transactions selected for import' }, 400);
    }

    // Build update map
    const updateMap = new Map(transactionUpdates.map(t => [t.id, t]));

    // Convert to expenses with robust null handling
    const expenses = extractedTransactions.map(tx => {
      const update = updateMap.get(tx.id);
      const categoryId = update?.category_id || tx.suggested_category_id || null;
      
      // Ensure all fields are valid
      const amount = Math.abs(Number(tx.amount) || 0);
      const date = tx.transaction_date || new Date().toISOString().split('T')[0];
      const note = String(tx.description || '').slice(0, 500) || 'Imported transaction';
      
      return {
        user_id: user.id,
        category_id: categoryId,
        amount,
        date,
        payment_method: 'bank' as const,
        note,
        is_draft: false,
      };
    }).filter(e => e.amount > 0); // Skip zero-amount entries

    if (expenses.length === 0) {
      return json({ success: false, error: 'No valid transactions to import' }, 400);
    }

    // Insert expenses in batches of 50
    let totalInserted = 0;
    const BATCH_SIZE = 50;
    
    for (let i = 0; i < expenses.length; i += BATCH_SIZE) {
      const batch = expenses.slice(i, i + BATCH_SIZE);
      const { data: inserted, error: insertError } = await supabase
        .from('expenses')
        .insert(batch)
        .select('id');

      if (insertError) {
        console.error(`[import] Batch ${i}-${i + batch.length} failed:`, insertError);
        // Try one by one for failed batch
        for (const expense of batch) {
          const { error: singleErr } = await supabase
            .from('expenses')
            .insert(expense);
          if (!singleErr) totalInserted++;
          else console.error('[import] Single insert failed:', singleErr);
        }
      } else {
        totalInserted += inserted?.length || batch.length;
      }
    }

    if (totalInserted === 0) {
      return json({ success: false, error: 'Failed to import any expenses' }, 500);
    }

    // Learn category mappings (best effort, don't block)
    try {
      for (const tx of extractedTransactions) {
        const update = updateMap.get(tx.id);
        const finalCategoryId = update?.category_id || tx.suggested_category_id;
        
        if (finalCategoryId && tx.description) {
          const keywords = tx.description
            .toLowerCase()
            .split(/[\s\-\/\\|@#$%^&*()+=\[\]{}:;"'<>,.?!]+/)
            .filter((word: string) => word.length >= 3 && word.length <= 20)
            .slice(0, 3);

          const skipWords = ['the', 'and', 'for', 'from', 'upi', 'neft', 'imps', 'rtgs', 'transfer', 'payment', 'ref', 'txn'];
          for (const keyword of keywords) {
            if (skipWords.includes(keyword)) continue;
            await supabase
              .from('category_mappings')
              .upsert({
                user_id: user.id,
                keyword,
                category_id: finalCategoryId,
                usage_count: 1,
              }, { onConflict: 'user_id,keyword' });
          }
        }
      }
    } catch (mappingErr) {
      console.error('[import] Category mapping error (non-fatal):', mappingErr);
    }

    // Update import record
    await supabase
      .from('statement_imports')
      .update({ status: 'completed', imported_transactions: totalInserted })
      .eq('id', importId);

    // Cleanup extracted transactions
    await supabase
      .from('extracted_transactions')
      .delete()
      .eq('import_id', importId);

    // Delete the statement file
    const { data: importRecord } = await supabase
      .from('statement_imports')
      .select('file_path')
      .eq('id', importId)
      .maybeSingle();

    if (importRecord?.file_path) {
      await supabase.storage.from('bank-statements').remove([importRecord.file_path]);
    }

    // Count months
    const months = new Set(
      extractedTransactions
        .filter(tx => tx.transaction_date)
        .map(tx => tx.transaction_date.slice(0, 7))
    );

    console.log(`[import] Success: ${totalInserted} expenses across ${months.size} months`);

    return json({
      success: true,
      importedCount: totalInserted,
      monthCount: months.size,
    });

  } catch (error) {
    console.error('[import] Unhandled error:', error);
    return json({
      success: false,
      error: 'An unexpected error occurred during import. Please try again.',
    }, 500);
  }
});
