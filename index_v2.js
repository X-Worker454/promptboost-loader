// Cloudflare Worker for Optimo Prompt Ai Backend
// Handles subscription management, API key storage, and LLM optimization

import { initializeDatabase, updateUserSubscription, getUserStatus, saveUserApiKey, optimizeUserPrompt } from './database.js';
import { verifyPaddleWebhook, handleSubscriptionEvent } from './paddle.js';
import { constructOptimizationPrompt, callLLMAPI } from './llm.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Initialize database on first request
      await initializeDatabase(env.DB);

      switch (pathname) {
        case '/api/user-status':
          return await handleUserStatus(request, env, corsHeaders);
        
        case '/api/save-key':
          return await handleSaveKey(request, env, corsHeaders);
        
        case '/api/optimize-prompt':
          return await handleOptimizePrompt(request, env, corsHeaders);
        
        case '/paddle-webhook':
          return await handlePaddleWebhook(request, env, corsHeaders);
        
        default:
          return new Response('Not Found', { status: 404, headers: corsHeaders });
      }
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Internal server error' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

async function handleUserStatus(request, env, corsHeaders) {
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');

  if (!userId) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'User ID required' 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const user = await getUserStatus(env.DB, userId);
    
    if (!user) {
      // Create new user record
      await env.DB.prepare(`
        INSERT INTO users (user_id, subscription_status, created_at, updated_at)
        VALUES (?, 'freemium', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(userId).run();
      
      return new Response(JSON.stringify({
        success: true,
        subscription_status: 'freemium',
        unlimited_trial_ends_at: null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if unlimited trial is still active
    let effectiveStatus = user.subscription_status;
    if (user.unlimited_trial_ends_at && new Date(user.unlimited_trial_ends_at) > new Date()) {
      effectiveStatus = 'trialing_unlimited';
    }

    return new Response(JSON.stringify({
      success: true,
      subscription_status: effectiveStatus,
      unlimited_trial_ends_at: user.unlimited_trial_ends_at
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting user status:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to get user status' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleSaveKey(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const { userId, provider, apiKey, customEndpoint, modelName } = body;

    if (!userId || !provider || !apiKey) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing required fields' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Encrypt the API key (simple encryption for demo)
    const encryptedKey = btoa(apiKey); // In production, use proper encryption

    await saveUserApiKey(env.DB, userId, provider, encryptedKey, customEndpoint, modelName);

    return new Response(JSON.stringify({
      success: true,
      message: 'API key saved successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error saving API key:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to save API key' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleOptimizePrompt(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const { userId, prompt, options } = body;

    if (!userId || !prompt) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing required fields' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get user status and check limits
    const user = await getUserStatus(env.DB, userId);
    if (!user) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'User not found' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if unlimited trial is active
    let effectiveStatus = user.subscription_status;
    if (user.unlimited_trial_ends_at && new Date(user.unlimited_trial_ends_at) > new Date()) {
      effectiveStatus = 'trialing_unlimited';
    }

    // Check daily limits (skip for unlimited and trialing_unlimited)
    if (effectiveStatus !== 'unlimited' && effectiveStatus !== 'trialing_unlimited') {
      const today = new Date().toISOString().split('T')[0];
      const dailyCount = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM optimization_history 
        WHERE user_id = ? AND DATE(created_at) = ?
      `).bind(userId, today).first();

      const dailyLimit = effectiveStatus === 'premium' ? 50 : 15;
      if (dailyCount.count >= dailyLimit) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Daily limit of ${dailyLimit} optimizations reached` 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Get user's API configuration
    const apiConfig = await env.DB.prepare(`
      SELECT provider, encrypted_api_key, custom_endpoint, model_name 
      FROM user_api_keys 
      WHERE user_id = ? AND is_active = 1
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(userId).first();

    if (!apiConfig) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No API key configured' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Decrypt API key
    const apiKey = atob(apiConfig.encrypted_api_key);

    // Construct optimization prompt
    const optimizationPrompt = constructOptimizationPrompt(prompt, options, effectiveStatus);

    // Call LLM API
    const result = await callLLMAPI(apiConfig.provider, apiKey, optimizationPrompt, apiConfig.custom_endpoint, apiConfig.model_name);

    if (!result.success) {
      return new Response(JSON.stringify(result), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Save to optimization history
    await env.DB.prepare(`
      INSERT INTO optimization_history (user_id, original_prompt, optimized_prompt, options_used, created_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(userId, prompt, result.optimized_prompt, JSON.stringify(options)).run();

    return new Response(JSON.stringify({
      success: true,
      optimized_prompt: result.optimized_prompt
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error optimizing prompt:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to optimize prompt' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handlePaddleWebhook(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const body = await request.text();
    const signature = request.headers.get('paddle-signature');

    // Verify webhook signature
    if (!verifyPaddleWebhook(body, signature, env.PADDLE_WEBHOOK_SECRET)) {
      return new Response('Invalid signature', { status: 401, headers: corsHeaders });
    }

    const event = JSON.parse(body);
    await handleSubscriptionEvent(env.DB, event);

    return new Response('OK', { headers: corsHeaders });
  } catch (error) {
    console.error('Error handling webhook:', error);
    return new Response('Internal server error', { status: 500, headers: corsHeaders });
  }
}