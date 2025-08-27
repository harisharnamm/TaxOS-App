import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AIFeedback {
  user_id: string
  client_id: string
  transaction_id?: string
  document_id?: string
  feedback_type: 'accept' | 'reject' | 'modify'
  original_suggestion: any
  user_correction?: any
  feedback_reason?: string
  confidence_before?: number
  confidence_after?: number
}

interface LearningPattern {
  pattern_type: 'vendor_name' | 'amount' | 'date_tolerance' | 'category' | 'description'
  pattern_data: any
  success_count?: number
  failure_count?: number
  success_rate?: number
  confidence_threshold?: number
}

interface FuzzyMatchRequest {
  text: string
  threshold?: number
}

interface DateToleranceRequest {
  rule_type: string
  vendor_id?: string
  category?: string
  base_tolerance?: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { action, data } = await req.json()

    switch (action) {
      case 'submit_feedback':
        return await handleSubmitFeedback(supabaseClient, data as AIFeedback)
      
      case 'get_learning_patterns':
        return await handleGetLearningPatterns(supabaseClient, data)
      
      case 'fuzzy_match':
        return await handleFuzzyMatch(supabaseClient, data as FuzzyMatchRequest)
      
      case 'get_date_tolerance':
        return await handleGetDateTolerance(supabaseClient, data as DateToleranceRequest)
      
      case 'update_confidence':
        return await handleUpdateConfidence(supabaseClient, data)
      
      case 'learn_pattern':
        return await handleLearnPattern(supabaseClient, data as LearningPattern)
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function handleSubmitFeedback(supabase: any, feedback: AIFeedback) {
  try {
    // Insert feedback
    const { data, error } = await supabase
      .from('ai_feedback')
      .insert([feedback])
      .select()

    if (error) throw error

    // Update learning patterns based on feedback
    await updateLearningPatterns(supabase, feedback)

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    throw new Error(`Failed to submit feedback: ${error.message}`)
  }
}

async function handleGetLearningPatterns(supabase: any, filters: any) {
  try {
    let query = supabase.from('ai_learning_patterns').select('*')
    
    if (filters?.pattern_type) {
      query = query.eq('pattern_type', filters.pattern_type)
    }
    
    if (filters?.min_confidence) {
      query = query.gte('confidence_threshold', filters.min_confidence)
    }

    const { data, error } = await query

    if (error) throw error

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    throw new Error(`Failed to get learning patterns: ${error.message}`)
  }
}

async function handleFuzzyMatch(supabase: any, request: FuzzyMatchRequest) {
  try {
    const { data: patterns, error } = await supabase
      .from('fuzzy_matching_patterns')
      .select('*')
      .gte('confidence_threshold', request.threshold || 0.8)

    if (error) throw error

    const matches = patterns
      .map(pattern => {
        const similarity = calculateSimilarity(request.text, pattern.normalized_text)
        return {
          ...pattern,
          similarity,
          is_match: similarity >= pattern.confidence_threshold
        }
      })
      .filter(match => match.is_match)
      .sort((a, b) => b.similarity - a.similarity)

    return new Response(
      JSON.stringify({ success: true, data: matches }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    throw new Error(`Failed to perform fuzzy match: ${error.message}`)
  }
}

async function handleGetDateTolerance(supabase: any, request: DateToleranceRequest) {
  try {
    let query = supabase.from('date_tolerance_rules').select('*')
    
    if (request.vendor_id) {
      query = query.eq('vendor_id', request.vendor_id)
    }
    
    if (request.category) {
      query = query.eq('category', request.category)
    }
    
    if (request.rule_type) {
      query = query.eq('rule_type', request.rule_type)
    }

    const { data, error } = await query

    if (error) throw error

    // Return the most specific rule found, or default
    const bestRule = data.sort((a: any, b: any) => {
      // Prioritize vendor-specific rules
      if (a.vendor_id && !b.vendor_id) return -1
      if (!a.vendor_id && b.vendor_id) return 1
      // Then by success count
      return (b.success_count || 0) - (a.success_count || 0)
    })[0]

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: bestRule || { 
          rule_type: request.rule_type, 
          base_tolerance_days: request.base_tolerance || 3 
        } 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    throw new Error(`Failed to get date tolerance: ${error.message}`)
  }
}

async function handleUpdateConfidence(supabase: any, data: any) {
  try {
    const { data: result, error } = await supabase
      .from('ai_confidence_history')
      .insert([{
        pattern_id: data.pattern_id,
        transaction_id: data.transaction_id,
        confidence_score: data.confidence_score,
        actual_outcome: data.actual_outcome,
        user_feedback_id: data.user_feedback_id
      }])
      .select()

    if (error) throw error

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    throw new Error(`Failed to update confidence: ${error.message}`)
  }
}

async function handleLearnPattern(supabase: any, pattern: LearningPattern) {
  try {
    // Check if pattern already exists
    const { data: existing, error: searchError } = await supabase
      .from('ai_learning_patterns')
      .select('*')
      .eq('pattern_type', pattern.pattern_type)
      .eq('pattern_data->pattern', pattern.pattern_data.pattern)
      .single()

    if (searchError && searchError.code !== 'PGRST116') throw searchError

    if (existing) {
      // Update existing pattern
      const { data, error } = await supabase
        .from('ai_learning_patterns')
        .update({
          success_count: existing.success_count + (pattern.success_count || 1),
          success_rate: calculateSuccessRate(existing.success_count + (pattern.success_count || 1), existing.failure_count),
          last_used: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()

      if (error) throw error

      return new Response(
        JSON.stringify({ success: true, data, action: 'updated' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      // Insert new pattern
      const { data, error } = await supabase
        .from('ai_learning_patterns')
        .insert([pattern])
        .select()

      if (error) throw error

      return new Response(
        JSON.stringify({ success: true, data, action: 'created' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    throw new Error(`Failed to learn pattern: ${error.message}`)
  }
}

async function updateLearningPatterns(supabase: any, feedback: AIFeedback) {
  try {
    // Extract patterns from feedback and update learning
    if (feedback.feedback_type === 'accept') {
      // Learn from successful suggestions
      await learnFromSuccess(supabase, feedback)
    } else if (feedback.feedback_type === 'reject') {
      // Learn from failures
      await learnFromFailure(supabase, feedback)
    } else if (feedback.feedback_type === 'modify') {
      // Learn from modifications
      await learnFromModification(supabase, feedback)
    }
  } catch (error) {
    console.error('Failed to update learning patterns:', error)
  }
}

async function learnFromSuccess(supabase: any, feedback: AIFeedback) {
  // Extract vendor name pattern
  if (feedback.original_suggestion?.payee) {
    await handleLearnPattern(supabase, {
      pattern_type: 'vendor_name',
      pattern_data: {
        pattern: feedback.original_suggestion.payee.toLowerCase(),
        variants: [feedback.original_suggestion.payee],
        confidence: feedback.confidence_after || 0.9
      },
      success_count: 1
    })
  }

  // Extract amount pattern
  if (feedback.original_suggestion?.amount) {
    await handleLearnPattern(supabase, {
      pattern_type: 'amount',
      pattern_data: {
        pattern: 'exact',
        tolerance: 0.01,
        confidence: feedback.confidence_after || 0.9
      },
      success_count: 1
    })
  }
}

async function learnFromFailure(supabase: any, feedback: AIFeedback) {
  // Learn what NOT to do
  if (feedback.original_suggestion?.payee) {
    const { data: existing } = await supabase
      .from('ai_learning_patterns')
      .select('*')
      .eq('pattern_type', 'vendor_name')
      .eq('pattern_data->pattern', feedback.original_suggestion.payee.toLowerCase())
      .single()

    if (existing) {
      await supabase
        .from('ai_learning_patterns')
        .update({
          failure_count: existing.failure_count + 1,
          success_rate: calculateSuccessRate(existing.success_count, existing.failure_count + 1),
          confidence_threshold: Math.max(0.5, existing.confidence_threshold - 0.05)
        })
        .eq('id', existing.id)
    }
  }
}

async function learnFromModification(supabase: any, feedback: AIFeedback) {
  // Learn the correct pattern from user correction
  if (feedback.user_correction?.payee) {
    await handleLearnPattern(supabase, {
      pattern_type: 'vendor_name',
      pattern_data: {
        pattern: feedback.user_correction.payee.toLowerCase(),
        variants: [feedback.user_correction.payee],
        confidence: feedback.confidence_after || 0.8
      },
      success_count: 1
    })
  }
}

function calculateSimilarity(text1: string, text2: string): number {
  // Simple Levenshtein distance-based similarity
  const distance = levenshteinDistance(text1.toLowerCase(), text2.toLowerCase())
  const maxLength = Math.max(text1.length, text2.length)
  return maxLength === 0 ? 1 : (maxLength - distance) / maxLength
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))

  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      )
    }
  }

  return matrix[str2.length][str1.length]
}

function calculateSuccessRate(success: number, failure: number): number {
  const total = success + failure
  return total === 0 ? 0 : success / total
}
