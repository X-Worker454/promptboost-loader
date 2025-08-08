// LLM API integration and prompt construction

export function constructOptimizationPrompt(userPrompt, options, subscriptionStatus) {
  let metaPrompt = `As an expert prompt engineer, your task is to refine and optimize the following user-provided prompt.
Your goal is to make it clearer, more concise, and more effective for a large language model.

**Optimization Constraints:**`;

  // Basic constraints available to all tiers
  if (options.tone) {
    metaPrompt += `\n- **Tone:** ${getToneInstruction(options.tone)}`;
  }
  
  if (options.length) {
    metaPrompt += `\n- **Length:** ${getLengthInstruction(options.length)}`;
  }
  
  if (options.persona) {
    metaPrompt += `\n- **Persona:** Optimize the prompt from the perspective of a ${options.persona}.`;
  }
  
  if (options.audience) {
    metaPrompt += `\n- **Target Audience:** The final output should be suitable for a ${options.audience} audience.`;
  }

  // Premium tier features
  if ((subscriptionStatus === 'premium' || subscriptionStatus === 'unlimited' || subscriptionStatus === 'trialing_unlimited') && options.outputFormat) {
    metaPrompt += `\n- **Output Format:** Structure the response as ${options.outputFormat}.`;
  }

  if ((subscriptionStatus === 'premium' || subscriptionStatus === 'unlimited' || subscriptionStatus === 'trialing_unlimited') && options.negativePrompting) {
    metaPrompt += `\n- **Negative Prompting:** Include appropriate "do not" clauses to prevent unwanted responses.`;
  }

  // Unlimited tier exclusive features
  if ((subscriptionStatus === 'unlimited' || subscriptionStatus === 'trialing_unlimited') && options.advancedTechnique) {
    metaPrompt += `\n- **Advanced Technique:** Apply ${getAdvancedTechniqueInstruction(options.advancedTechnique)} methodology.`;
  }

  if ((subscriptionStatus === 'unlimited' || subscriptionStatus === 'trialing_unlimited') && options.ethicalRefinement) {
    metaPrompt += `\n- **Ethical Considerations:** Ensure the prompt promotes responsible AI usage and avoids potential misuse.`;
  }

  metaPrompt += `\n- **Core Instructions:** Remove ambiguity, use strong action-oriented verbs, and make implicit instructions explicit.
- **Language:** Optimize the prompt while preserving its original language.

**User Prompt to Optimize:**
---
${userPrompt}
---

Return ONLY the optimized prompt, with no additional commentary or explanation.`;

  return metaPrompt;
}

function getToneInstruction(tone) {
  const toneMap = {
    'professional': 'Use a professional, business-appropriate tone',
    'friendly': 'Use a warm, approachable, and friendly tone',
    'direct': 'Use a clear, direct, and straightforward tone',
    'creative': 'Use an imaginative, innovative, and creative tone',
    'empathetic': 'Use a compassionate, understanding, and empathetic tone',
    'authoritative': 'Use a confident, expert, and authoritative tone',
    'humorous': 'Use a light-hearted, witty, and humorous tone',
    'persuasive': 'Use a compelling, convincing, and persuasive tone',
    'analytical': 'Use a logical, systematic, and analytical tone',
    'academic': 'Use a scholarly, research-oriented, and academic tone',
    'journalistic': 'Use an objective, factual, and journalistic tone'
  };
  
  return toneMap[tone] || `Use a ${tone} tone`;
}

function getLengthInstruction(length) {
  const lengthMap = {
    'concise': 'Keep the response brief and to the point',
    'default': 'Use an appropriate length for the content',
    'elaborate': 'Provide detailed and comprehensive information'
  };
  
  return lengthMap[length] || 'Use an appropriate length for the content';
}

function getAdvancedTechniqueInstruction(technique) {
  const techniqueMap = {
    'cot': 'Chain-of-Thought reasoning - break down complex problems into step-by-step logical reasoning',
    'react': 'ReAct (Reasoning and Acting) - combine reasoning and action-taking in an iterative process',
    'self-correction': 'Self-Correction - include instructions for the AI to review and refine its own output'
  };
  
  return techniqueMap[technique] || technique;
}

export async function callLLMAPI(provider, apiKey, prompt, customEndpoint = null, modelName = null) {
  try {
    switch (provider) {
      case 'openai':
        return await callOpenAIAPI(apiKey, prompt, modelName || 'gpt-4');
      
      case 'anthropic':
        return await callAnthropicAPI(apiKey, prompt, modelName || 'claude-3-sonnet-20240229');
      
      case 'google':
        return await callGoogleAPI(apiKey, prompt, modelName || 'gemini-pro');
      
      case 'custom':
        return await callCustomAPI(customEndpoint, apiKey, prompt, modelName);
      
      default:
        return { success: false, error: 'Unsupported LLM provider' };
    }
  } catch (error) {
    console.error('LLM API error:', error);
    return { success: false, error: 'Failed to call LLM API' };
  }
}

async function callOpenAIAPI(apiKey, prompt, model) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const error = await response.text();
    return { success: false, error: `OpenAI API error: ${error}` };
  }

  const data = await response.json();
  return { 
    success: true, 
    optimized_prompt: data.choices[0].message.content.trim() 
  };
}

async function callAnthropicAPI(apiKey, prompt, model) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    return { success: false, error: `Anthropic API error: ${error}` };
  }

  const data = await response.json();
  return { 
    success: true, 
    optimized_prompt: data.content[0].text.trim() 
  };
}

async function callGoogleAPI(apiKey, prompt, model) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7
      }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    return { success: false, error: `Google API error: ${error}` };
  }

  const data = await response.json();
  return { 
    success: true, 
    optimized_prompt: data.candidates[0].content.parts[0].text.trim() 
  };
}

async function callCustomAPI(endpoint, apiKey, prompt, model) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const error = await response.text();
    return { success: false, error: `Custom API error: ${error}` };
  }

  const data = await response.json();
  return { 
    success: true, 
    optimized_prompt: data.choices[0].message.content.trim() 
  };
}