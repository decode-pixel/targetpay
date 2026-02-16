import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

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

interface SuggestedCategory {
  name: string;
  icon: string;
  color: string;
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

    // Input validation schema
    const requestSchema = z.object({
      importId: z.string().uuid({ message: 'Invalid import ID format' }),
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

    const { importId } = validation.data;
    console.log(`Categorizing transactions for import ${importId}`);

    // Update status
    await supabase
      .from('statement_imports')
      .update({ status: 'categorizing' })
      .eq('id', importId);

    // Get user's categories
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('id, name, icon, color')
      .eq('user_id', user.id);

    if (catError) {
      console.error('Error fetching categories:', catError);
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
    const suggestedNewCategories: SuggestedCategory[] = [];
    
    if (unmatchedTransactions.length > 0) {
      const BYTEZ_API_KEY = Deno.env.get('BYTEZ_API_KEY');
      
      if (!BYTEZ_API_KEY) {
        console.error('BYTEZ_API_KEY not configured');
        return new Response(
          JSON.stringify({ success: false, error: 'AI service not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Build category list for AI
      const categoryList = categories && categories.length > 0 
        ? categories.map(c => `- ${c.name} (id: ${c.id})`).join('\n')
        : 'No categories exist yet.';

      // Process in batches to avoid token limits
      const batchSize = 20;
      for (let i = 0; i < unmatchedTransactions.length; i += batchSize) {
        const batch = unmatchedTransactions.slice(i, i + batchSize);
        
        const transactionList = batch.map((t, idx) => 
          `${idx + 1}. "${t.description}" (id: ${t.id})`
        ).join('\n');

        const systemPrompt = categories && categories.length > 0 
          ? `You are an expense categorization assistant. Categorize each transaction into ONE of the available categories.

Available categories:
${categoryList}

For each transaction, respond with a JSON object containing:
{
  "categorizations": [
    {
      "transaction_id": "the id",
      "category_id": "id of best matching category, or null if no good match",
      "confidence": 0.1-1.0,
      "keyword": "short keyword from description for learning",
      "needs_new_category": false,
      "suggested_category": null
    }
  ],
  "new_category_suggestions": [
    {
      "name": "Category Name",
      "icon": "icon-name",
      "color": "#HEX",
      "for_transactions": ["tx_id1", "tx_id2"]
    }
  ]
}

If a transaction doesn't fit any existing category well, set needs_new_category: true and suggest a new category.
Use common finance icons: utensils, car, shopping-bag, receipt, home, heart-pulse, graduation-cap, plane, gift, fuel, wifi, phone, briefcase, etc.
Use vibrant colors like: #F97316, #3B82F6, #EC4899, #8B5CF6, #10B981, #06B6D4, #EF4444, #F59E0B

Focus on Indian payment patterns: UPI, NEFT/IMPS, Swiggy, Zomato, Uber, Ola, utility bills, EMI.
Return ONLY valid JSON.`
          : `You are an expense categorization assistant. The user has no categories yet, so suggest appropriate categories for their transactions.

For each transaction, respond with a JSON object:
{
  "categorizations": [
    {
      "transaction_id": "the id",
      "category_id": null,
      "confidence": 0,
      "keyword": "short keyword",
      "needs_new_category": true,
      "suggested_category": {
        "name": "Category Name",
        "icon": "icon-name",
        "color": "#HEX"
      }
    }
  ],
  "new_category_suggestions": [
    {
      "name": "Category Name",
      "icon": "icon-name",
      "color": "#HEX",
      "for_transactions": ["tx_id1"]
    }
  ]
}

Use common finance icons: utensils, car, shopping-bag, receipt, home, heart-pulse, graduation-cap, plane, gift, fuel, wifi, phone, briefcase, etc.
Use vibrant colors: #F97316, #3B82F6, #EC4899, #8B5CF6, #10B981, #06B6D4, #EF4444, #F59E0B.
Return ONLY valid JSON.`;

        const aiResponse = await fetch('https://api.bytez.com/models/v2/openai/gpt-4o', {
          method: 'POST',
          headers: {
            'Authorization': BYTEZ_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `Categorize these transactions:\n${transactionList}` }
            ],
            temperature: 0.2,
            max_tokens: 3000,
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
        
        console.log('AI categorization response:', content?.slice(0, 500));

        try {
          // Extract JSON from markdown if present
          const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
          const result = JSON.parse(jsonMatch[1].trim());

          // Apply AI categorizations
          if (result.categorizations) {
            for (const cat of result.categorizations) {
              if (cat.transaction_id) {
                await supabase
                  .from('extracted_transactions')
                  .update({
                    suggested_category_id: cat.category_id || null,
                    ai_confidence: Math.min(Math.max(cat.confidence || 0.5, 0.1), 1.0),
                  })
                  .eq('id', cat.transaction_id);

                // Learn from this categorization
                if (cat.keyword && cat.keyword.length >= 3 && cat.category_id) {
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
          }

          // Collect new category suggestions
          if (result.new_category_suggestions) {
            for (const suggestion of result.new_category_suggestions) {
              if (suggestion.name && !suggestedNewCategories.find(s => s.name === suggestion.name)) {
                suggestedNewCategories.push({
                  name: suggestion.name,
                  icon: suggestion.icon || 'tag',
                  color: suggestion.color || '#3B82F6',
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
    console.log(`Suggested ${suggestedNewCategories.length} new categories`);

    return new Response(
      JSON.stringify({
        success: true,
        totalTransactions: transactions.length,
        categorizedCount,
        avgConfidence: Math.round(avgConfidence * 100),
        suggestedCategories: suggestedNewCategories,
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
