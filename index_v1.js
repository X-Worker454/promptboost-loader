// Optimo Prompt Ai - Cloudflare Worker Backend
// Handles user management, subscriptions, and LLM API proxying

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    // CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-ID',
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Route handling
      if (pathname === '/api/user-status' && request.method === 'GET') {
        return await handleUserStatus(request, env, corsHeaders);
      }
      
      if (pathname === '/api/save-key' && request.method === 'POST') {
        return await handleSaveKey(request, env, corsHeaders);
      }
      
      if (pathname === '/api/optimize-prompt' && request.method === 'POST') {
        return await handleOptimizePrompt(request, env, corsHeaders);
      }
      
      if (pathname === '/paddle-webhook' && request.method === 'POST') {
        return await handlePaddleWebhook(request, env, corsHeaders);
      }

      // Health check endpoint
      if (pathname === '/health') {
        return new Response(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  },
};

// Get user subscription status
async function handleUserStatus(request, env, corsHeaders) {
  const userId = request.headers.get('X-User-ID');
  
  if (!userId) {
    return new Response(JSON.stringify({ error: 'User ID required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    // Get or create user
    let user = await getUserById(env.DB, userId);
    
    if (!user) {
      // Create new user with freemium status
      await createUser(env.DB, userId);
      user = { user_id: userId, subscription_status: 'freemium' };
    }

    return new Response(JSON.stringify({
      subscription_status: user.subscription_status,
      user_id: user.user_id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting user status:', error);
    return new Response(JSON.stringify({ error: 'Database error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Save encrypted LLM API key
async function handleSaveKey(request, env, corsHeaders) {
  const userId = request.headers.get('X-User-ID');
  
  if (!userId) {
    return new Response(JSON.stringify({ error: 'User ID required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const { api_key, provider, model } = body;

    if (!api_key || !provider) {
      return new Response(JSON.stringify({ error: 'API key and provider required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Encrypt the API key
    const encryptedKey = await encryptApiKey(api_key, env);
    
    // Store in database
    await saveUserApiKey(env.DB, userId, encryptedKey, provider, model);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error saving API key:', error);
    return new Response(JSON.stringify({ error: 'Failed to save API key' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Handle prompt optimization with subscription checks
async function handleOptimizePrompt(request, env, corsHeaders) {
  const userId = request.headers.get('X-User-ID');
  
  if (!userId) {
    return new Response(JSON.stringify({ error: 'User ID required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const { prompt_text, options } = body;

    if (!prompt_text) {
      return new Response(JSON.stringify({ error: 'Prompt text required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get user and check subscription
    const user = await getUserById(env.DB, userId);
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check daily usage limits
    const dailyLimit = user.subscription_status === 'premium' ? 50 : 15;
    const usageToday = await getDailyUsage(env.DB, userId);
    
    if (usageToday >= dailyLimit) {
      return new Response(JSON.stringify({ 
        error: 'Daily optimization limit reached',
        limit: dailyLimit,
        usage: usageToday
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check premium features
    if (user.subscription_status === 'freemium') {
      const premiumFeatures = ['academic', 'journalistic', 'json', 'list', 'table'];
      if (options && premiumFeatures.some(feature => 
        (options.tone && options.tone.toLowerCase().includes(feature)) ||
        (options.format && options.format.toLowerCase().includes(feature))
      )) {
        return new Response(JSON.stringify({ 
          error: 'Premium feature required',
          feature: 'advanced_tone_format'
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Get user's API key and optimize prompt
    const optimizedPrompt = await optimizePromptWithLLM(env.DB, userId, prompt_text, options);
    
    // Update usage and save history
    await incrementDailyUsage(env.DB, userId);
    await saveOptimizationHistory(env.DB, userId, prompt_text, optimizedPrompt, options);

    return new Response(JSON.stringify({
      optimized_prompt: optimizedPrompt,
      usage_remaining: dailyLimit - usageToday - 1
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error optimizing prompt:', error);
    return new Response(JSON.stringify({ error: 'Optimization failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Handle Paddle webhook for subscription events
async function handlePaddleWebhook(request, env, corsHeaders) {
  try {
    const signature = request.headers.get('Paddle-Signature');
    const body = await request.text();
    
    // Verify webhook signature
    if (!await verifyPaddleSignature(signature, body, env.PADDLE_WEBHOOK_SECRET)) {
      return new Response('Invalid signature', { status: 401 });
    }

    const payload = JSON.parse(body);
    const { event_type, data } = payload;

    switch (event_type) {
      case 'subscription_created':
      case 'subscription_updated':
        if (data.status === 'active') {
          await updateUserSubscription(env.DB, data.custom_data.user_id, 'premium', data.subscription_id, data.customer_id);
        }
        break;
        
      case 'subscription_cancelled':
      case 'subscription_expired':
        await updateUserSubscription(env.DB, data.custom_data.user_id, 'freemium', null, data.customer_id);
        break;
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('Webhook processing failed', { status: 500 });
  }
}

// Database helper functions
async function getUserById(db, userId) {
  const result = await db.prepare('SELECT * FROM users WHERE user_id = ?').bind(userId).first();
  return result;
}

async function createUser(db, userId) {
  await db.prepare(`
    INSERT INTO users (user_id, subscription_status, created_at, updated_at)
    VALUES (?, 'freemium', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(userId).run();
}

async function saveUserApiKey(db, userId, encryptedKey, provider, model) {
  await db.prepare(`
    INSERT OR REPLACE INTO users (user_id, llm_api_key_encrypted, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
  `).bind(userId, encryptedKey).run();
}

async function getDailyUsage(db, userId) {
  const today = new Date().toISOString().split('T')[0];
  const result = await db.prepare(`
    SELECT optimization_count FROM usage_tracking 
    WHERE user_id = ? AND optimization_date = ?
  `).bind(userId, today).first();
  
  return result ? result.optimization_count : 0;
}

async function incrementDailyUsage(db, userId) {
  const today = new Date().toISOString().split('T')[0];
  await db.prepare(`
    INSERT OR REPLACE INTO usage_tracking (user_id, optimization_date, optimization_count)
    VALUES (?, ?, COALESCE((SELECT optimization_count FROM usage_tracking WHERE user_id = ? AND optimization_date = ?), 0) + 1)
  `).bind(userId, today, userId, today).run();
}

async function saveOptimizationHistory(db, userId, originalPrompt, optimizedPrompt, options) {
  await db.prepare(`
    INSERT INTO optimization_history (user_id, original_prompt, optimized_prompt, optimization_settings)
    VALUES (?, ?, ?, ?)
  `).bind(userId, originalPrompt, optimizedPrompt, JSON.stringify(options)).run();
}

async function updateUserSubscription(db, userId, status, subscriptionId, customerId) {
  await db.prepare(`
    UPDATE users 
    SET subscription_status = ?, paddle_subscription_id = ?, paddle_customer_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).bind(status, subscriptionId, customerId, userId).run();
}

// Encryption helper function
async function encryptApiKey(apiKey, env) {
  // Simple base64 encoding for demo - in production, use proper encryption
  return btoa(apiKey);
}

async function decryptApiKey(encryptedKey, env) {
  // Simple base64 decoding for demo - in production, use proper decryption
  return atob(encryptedKey);
}

// LLM API integration
async function optimizePromptWithLLM(db, userId, promptText, options) {
  const user = await getUserById(db, userId);
  
  if (!user || !user.llm_api_key_encrypted) {
    throw new Error('No API key configured');
  }

  const apiKey = await decryptApiKey(user.llm_api_key_encrypted);
  
  // Build optimization prompt based on options
  const optimizationPrompt = buildOptimizationPrompt(promptText, options);
  
  // Make API call to LLM (example with OpenAI format)
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: optimizationPrompt }],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error('LLM API call failed');
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

function buildOptimizationPrompt(userPrompt, options = {}) {
  const { tone = 'professional', length = 'default', persona = 'expert', audience = 'general' } = options;
  
  const toneInstructions = {
    professional: 'Use formal, business-appropriate language',
    friendly: 'Use warm, approachable language',
    direct: 'Use concise, straightforward language',
    creative: 'Use imaginative, expressive language',
    academic: 'Use scholarly, research-oriented language', // Premium
    journalistic: 'Use objective, news-style language', // Premium
  };

  const lengthInstructions = {
    concise: 'Make the prompt as brief as possible while maintaining clarity',
    default: 'Optimize for clarity and effectiveness',
    elaborate: 'Provide detailed, comprehensive instructions',
  };

  return `As an expert prompt engineer, optimize the following prompt for better LLM results.

**Optimization Constraints:**
- **Tone:** ${toneInstructions[tone] || toneInstructions.professional}
- **Length:** ${lengthInstructions[length] || lengthInstructions.default}
- **Persona:** Optimize from the perspective of a ${persona}
- **Target Audience:** Suitable for ${audience} audience
- **Core Instructions:** Remove ambiguity, use action-oriented verbs, make instructions explicit

**User Prompt to Optimize:**
---
${userPrompt}
---

Return ONLY the optimized prompt, with no additional commentary.`;
}

// Paddle signature verification
async function verifyPaddleSignature(signature, body, secret) {
  if (!signature || !secret) return false;
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const computedSignature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const computedHex = Array.from(new Uint8Array(computedSignature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return signature === computedHex;
}