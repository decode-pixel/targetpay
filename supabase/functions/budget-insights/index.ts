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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ success: false, error: 'Authorization required' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return json({ success: false, error: 'Invalid authentication' }, 401);

    const BYTEZ_API_KEY = Deno.env.get('BYTEZ_API_KEY');
    if (!BYTEZ_API_KEY) return json({ success: false, error: 'AI service not configured' }, 500);

    let body: { month?: string };
    try { body = await req.json(); } catch {
      return json({ success: false, error: 'Invalid JSON body' }, 400);
    }

    const month = body?.month;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return json({ success: false, error: 'Invalid month format. Use YYYY-MM.' }, 400);
    }

    // Calculate previous month
    const [year, mon] = month.split('-').map(Number);
    const prevDate = new Date(year, mon - 2, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    // Fetch current month expenses with categories
    const startDate = `${month}-01`;
    const endDate = `${year}-${String(mon).padStart(2, '0')}-${new Date(year, mon, 0).getDate()}`;

    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount, category_id')
      .eq('user_id', user.id)
      .gte('date', startDate)
      .lte('date', endDate);

    // Fetch previous month expenses
    const prevStartDate = `${prevMonth}-01`;
    const prevEndDate = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${new Date(prevDate.getFullYear(), prevDate.getMonth() + 1, 0).getDate()}`;

    const { data: prevExpenses } = await supabase
      .from('expenses')
      .select('amount, category_id')
      .eq('user_id', user.id)
      .gte('date', prevStartDate)
      .lte('date', prevEndDate);

    // Fetch categories
    const { data: categories } = await supabase
      .from('categories')
      .select('id, name')
      .eq('user_id', user.id);

    const catMap = new Map(categories?.map(c => [c.id, c.name]) || []);

    // Aggregate by category
    const currentTotals: Record<string, number> = {};
    for (const e of (expenses || [])) {
      const name = catMap.get(e.category_id) || 'Uncategorized';
      currentTotals[name] = (currentTotals[name] || 0) + Number(e.amount);
    }

    const prevTotals: Record<string, number> = {};
    for (const e of (prevExpenses || [])) {
      const name = catMap.get(e.category_id) || 'Uncategorized';
      prevTotals[name] = (prevTotals[name] || 0) + Number(e.amount);
    }

    if (Object.keys(currentTotals).length === 0) {
      return json({ success: true, insights: ['No expenses recorded this month. Start tracking to get AI-powered insights!'] });
    }

    const prompt = `You are a personal finance assistant.
Analyze this monthly spending summary and provide exactly 3 short insights.

Rules:
- Identify highest spending category.
- Compare with previous month (mention increase or decrease).
- Suggest one specific budget improvement.
- Keep each insight to 1-2 sentences.
- Be encouraging, not judgmental.

Current month (${month}):
${JSON.stringify(currentTotals)}

Previous month (${prevMonth}):
${JSON.stringify(prevTotals)}

Return ONLY a JSON array of 3 strings, no markdown, no extra text.
Example: ["Insight 1", "Insight 2", "Insight 3"]`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const aiResponse = await fetch('https://api.bytez.com/models/v2/openai/gpt-4o', {
      method: 'POST',
      headers: {
        'Authorization': BYTEZ_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 500,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!aiResponse.ok) {
      const errText = await aiResponse.text().catch(() => '');
      console.error(`[insights] AI error ${aiResponse.status}:`, errText);
      if (aiResponse.status === 429) return json({ success: false, error: 'Rate limit exceeded. Try again later.' }, 429);
      if (aiResponse.status === 402) return json({ success: false, error: 'Payment required.' }, 402);
      return json({ success: false, error: 'AI service unavailable' }, 500);
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content || '';

    let insights: string[];
    try {
      // Try parsing JSON directly
      const parsed = JSON.parse(content.trim());
      insights = Array.isArray(parsed) ? parsed.slice(0, 3) : [content];
    } catch {
      // Try extracting JSON array from response
      const match = content.match(/\[[\s\S]*?\]/);
      if (match) {
        try {
          insights = JSON.parse(match[0]).slice(0, 3);
        } catch {
          insights = [content.trim()];
        }
      } else {
        insights = content.split('\n').filter((l: string) => l.trim()).slice(0, 3);
      }
    }

    return json({ success: true, insights });

  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return json({ success: false, error: 'Request timed out' }, 504);
    }
    console.error('[insights] Error:', error);
    return json({ success: false, error: 'An unexpected error occurred' }, 500);
  }
});
