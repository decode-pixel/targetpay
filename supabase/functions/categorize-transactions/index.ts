import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface CategoryMapping {
  keyword: string;
  category_id: string;
}

interface Transaction {
  id: string;
  description: string;
}

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

    const { importId } = await req.json();
    
    if (!importId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Import ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Categorizing transactions for import ${importId}`);

    // Update status
    await supabase
      .from('statement_imports')
      .update({ status: 'categorizing' })
      .eq('id', importId);

    // Get user's categories
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('id, name, icon')
      .eq('user_id', user.id);

    if (catError || !categories || categories.length === 0) {
      console.error('No categories found:', catError);
      return new Response(
        JSON.stringify({ success: false, error: 'No categories found. Please create categories first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's learned category mappings
    const { data: mappings } = await supabase
      .from('category_mappings')
      .select('keyword, category_id')
      .eq('user_id', user.id)
      .order('usage_count', { ascending: false });

    // Get extracted transactions
    const { data: transactions, error: txError } = await supabase
      .from('extracted_transactions')
      .select('id, description')
      .eq('import_id', importId)
      .eq('user_id', user.id);

    if (txError || !transactions || transactions.length === 0) {
      console.error('No transactions found:', txError);
      return new Response(
        JSON.stringify({ success: false, error: 'No transactions to categorize' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // First pass: Match using learned mappings
    const unmatchedTransactions: Transaction[] = [];
    const matchedUpdates: { id: string; category_id: string; confidence: number }[] = [];

    for (const tx of transactions) {
      const descLower = tx.description.toLowerCase();
      let matched = false;

      // Check learned mappings first
      if (mappings) {
        for (const mapping of mappings) {
          if (descLower.includes(mapping.keyword.toLowerCase())) {
            matchedUpdates.push({
              id: tx.id,
              category_id: mapping.category_id,
              confidence: 0.9, // High confidence for learned mappings
            });
            matched = true;
            break;
          }
        }
      }

      if (!matched) {
        unmatchedTransactions.push(tx);
      }
    }

    console.log(`Matched ${matchedUpdates.length} transactions via learned mappings, ${unmatchedTransactions.length} need AI`);

    // Apply learned matches
    for (const update of matchedUpdates) {
      await supabase
        .from('extracted_transactions')
        .update({
          suggested_category_id: update.category_id,
          ai_confidence: update.confidence,
        })
        .eq('id', update.id);
    }

    // Second pass: Use AI for unmatched transactions
    if (unmatchedTransactions.length > 0) {
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      
      if (!LOVABLE_API_KEY) {
        console.error('LOVABLE_API_KEY not configured');
        return new Response(
          JSON.stringify({ success: false, error: 'AI service not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Build category list for AI
      const categoryList = categories.map(c => `- ${c.name} (id: ${c.id})`).join('\n');

      // Process in batches to avoid token limits
      const batchSize = 20;
      for (let i = 0; i < unmatchedTransactions.length; i += batchSize) {
        const batch = unmatchedTransactions.slice(i, i + batchSize);
        
        const transactionList = batch.map((t, idx) => 
          `${idx + 1}. "${t.description}" (id: ${t.id})`
        ).join('\n');

        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              {
                role: 'system',
                content: `You are an expense categorization assistant. Categorize each transaction into ONE of the available categories.

Available categories:
${categoryList}

For each transaction, respond with a JSON array of objects containing:
- transaction_id: the id of the transaction
- category_id: the id of the best matching category
- confidence: a number between 0.1 and 1.0 indicating confidence
- keyword: a short keyword (max 20 chars, lowercase) from the description that indicates this category (for learning)

Focus on common Indian payment patterns:
- UPI payments often include merchant names
- NEFT/IMPS transfers may include beneficiary names
- ATM withdrawals are typically cash
- Swiggy, Zomato, Uber, Ola are common apps
- Utility payments include electricity, gas, water, internet
- EMI payments are typically loans or bills

Return ONLY valid JSON, no markdown or explanation.`
              },
              {
                role: 'user',
                content: `Categorize these transactions:\n${transactionList}`
              }
            ],
            temperature: 0.2,
            max_tokens: 2000,
          }),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error('AI categorization failed:', aiResponse.status, errorText);
          
          if (aiResponse.status === 429) {
            return new Response(
              JSON.stringify({ success: false, error: 'Rate limit exceeded. Please try again later.' }),
              { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          continue;
        }

        const aiResult = await aiResponse.json();
        const content = aiResult.choices?.[0]?.message?.content;
        
        console.log('AI categorization response:', content?.slice(0, 300));

        try {
          // Extract JSON from markdown if present
          const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
          const categorizations = JSON.parse(jsonMatch[1].trim());

          // Apply AI categorizations
          for (const cat of categorizations) {
            if (cat.transaction_id && cat.category_id) {
              await supabase
                .from('extracted_transactions')
                .update({
                  suggested_category_id: cat.category_id,
                  ai_confidence: Math.min(Math.max(cat.confidence || 0.5, 0.1), 1.0),
                })
                .eq('id', cat.transaction_id);

              // Learn from this categorization (will be reinforced if user confirms)
              if (cat.keyword && cat.keyword.length >= 3) {
                await supabase
                  .from('category_mappings')
                  .upsert({
                    user_id: user.id,
                    keyword: cat.keyword.toLowerCase().slice(0, 50),
                    category_id: cat.category_id,
                    usage_count: 1,
                  }, {
                    onConflict: 'user_id,keyword',
                    ignoreDuplicates: true,
                  });
              }
            }
          }
        } catch (e) {
          console.error('Failed to parse AI categorization response:', e);
        }
      }
    }

    // Update import status to ready
    await supabase
      .from('statement_imports')
      .update({ status: 'ready' })
      .eq('id', importId);

    // Get final categorization stats
    const { data: finalStats } = await supabase
      .from('extracted_transactions')
      .select('id, suggested_category_id, ai_confidence')
      .eq('import_id', importId);

    const categorizedCount = finalStats?.filter(t => t.suggested_category_id).length || 0;
    const totalConfidence = finalStats?.reduce((sum, t) => sum + (t.ai_confidence || 0), 0) || 0;
    const avgConfidence = totalConfidence / (categorizedCount || 1);

    console.log(`Categorization complete: ${categorizedCount}/${transactions.length} transactions, avg confidence: ${avgConfidence.toFixed(2)}`);

    return new Response(
      JSON.stringify({
        success: true,
        totalTransactions: transactions.length,
        categorizedCount,
        avgConfidence: Math.round(avgConfidence * 100),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Categorization error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
