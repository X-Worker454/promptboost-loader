// Background service worker for Optimo Prompt Ai
let dailyOptimizationCount = 0;
let lastResetDate = '';
let userId = null;
let subscriptionStatus = 'freemium';

// Backend configuration
const BACKEND_URL = 'https://optimo-prompt-ai-backend.workers.dev'; // Replace with actual Worker URL

// Initialize on startup
browser.runtime.onStartup.addListener(initialize);
browser.runtime.onInstalled.addListener(initialize);

// Listen for messages from content scripts
browser.runtime.onMessage.addListener(handleMessage);

async function initialize() {
    try {
        const result = await browser.storage.local.get(['dailyCount', 'lastResetDate', 'userId', 'subscriptionStatus']);
        dailyOptimizationCount = result.dailyCount || 0;
        lastResetDate = result.lastResetDate || '';
        userId = result.userId;
        subscriptionStatus = result.subscriptionStatus || 'freemium';
        
        // Generate user ID on first install
        if (!userId) {
            userId = generateUserId();
            await browser.storage.local.set({ userId: userId });
        }
        
        // Reset daily count if it's a new day
        await checkAndResetDailyCount();
        
        // Sync with backend to get latest subscription status
        await syncWithBackend();
    } catch (error) {
        console.error('Error initializing background script:', error);
    }
}

async function handleMessage(message, sender, sendResponse) {
    if (message.action === 'optimizePrompt') {
        try {
            const result = await optimizePrompt(message.data);
            return Promise.resolve(result);
        } catch (error) {
            console.error('Error in handleMessage:', error);
            return Promise.resolve({
                success: false,
                error: 'Internal error occurred'
            });
        }
    } else if (message.action === 'testConnection') {
        try {
            const result = await testLLMConnection(message.data);
            return Promise.resolve(result);
        } catch (error) {
            console.error('Error in testConnection:', error);
            return Promise.resolve({
                success: false,
                error: 'Connection test failed'
            });
        }
    } else if (message.action === 'syncBackend') {
        try {
            await syncWithBackend();
            return Promise.resolve({ success: true, subscriptionStatus: subscriptionStatus });
        } catch (error) {
            console.error('Error syncing with backend:', error);
            return Promise.resolve({
                success: false,
                error: 'Failed to sync with backend'
            });
        }
    } else if (message.type === 'testApiKey') {
        try {
            const result = await testApiKey(message.keyData);
            return Promise.resolve(result);
        } catch (error) {
            console.error('Error testing API key:', error);
            return Promise.resolve({
                success: false,
                error: 'Failed to test API key'
            });
        }
    } else if (message.action === 'getUserId') {
        return Promise.resolve({ userId: userId });
    }
    
    return Promise.resolve();
}

async function checkAndResetDailyCount() {
    const today = new Date().toDateString();
    
    if (lastResetDate !== today) {
        dailyOptimizationCount = 0;
        lastResetDate = today;
        
        await browser.storage.local.set({
            dailyCount: 0,
            lastResetDate: today
        });
    }
}

async function optimizePrompt({ promptText, options }) {
    try {
        // Sync with backend first to ensure we have latest subscription status
        await syncWithBackend();
        
        // Use backend API for optimization with subscription checks
        const optimizedPrompt = await optimizePromptWithBackend(promptText, options);
        
        return {
            success: true,
            optimizedPrompt: optimizedPrompt
        };
        
    } catch (error) {
        console.error('Error optimizing prompt:', error);
        
        // If backend fails, fall back to direct API call for better user experience
        if (error.message.includes('Backend')) {
            console.log('Falling back to direct API call');
            return await optimizePromptDirect({ promptText, options });
        }
        
        return {
            success: false,
            error: error.message || 'Failed to optimize prompt. Please try again.'
        };
    }
}

function buildMetaPrompt(userPrompt, options) {
    const { tone, length, persona, audience } = options;
    
    // Build tone instruction
    let toneInstruction = '';
    switch (tone.toLowerCase()) {
        case 'professional':
            toneInstruction = 'Use formal, business-appropriate language with clear structure and authoritative tone.';
            break;
        case 'friendly':
            toneInstruction = 'Use warm, approachable language that feels conversational and welcoming.';
            break;
        case 'direct':
            toneInstruction = 'Use clear, straightforward language without unnecessary elaboration. Be concise and to the point.';
            break;
        case 'creative':
            toneInstruction = 'Use imaginative, engaging language that encourages innovative thinking and creative solutions.';
            break;
        case 'empathetic':
            toneInstruction = 'Use understanding, compassionate language that acknowledges emotions and perspectives.';
            break;
        case 'authoritative':
            toneInstruction = 'Use confident, expert language that demonstrates knowledge and commands respect.';
            break;
        case 'humorous':
            toneInstruction = 'Use light, engaging language with appropriate humor while maintaining clarity.';
            break;
        case 'persuasive':
            toneInstruction = 'Use compelling, convincing language that motivates action and agreement.';
            break;
        case 'analytical':
            toneInstruction = 'Use logical, data-driven language that emphasizes reasoning and systematic thinking.';
            break;
        default:
            toneInstruction = `Use a ${tone} tone that matches the specified style and context.`;
    }
    
    // Build length instruction
    let lengthInstruction = '';
    switch (length.toLowerCase()) {
        case 'concise':
            lengthInstruction = 'Make the prompt as brief as possible while maintaining all essential information.';
            break;
        case 'elaborate':
            lengthInstruction = 'Provide detailed, comprehensive instructions with additional context and examples.';
            break;
        default:
            lengthInstruction = 'Maintain an appropriate length that balances clarity with completeness.';
    }
    
    return `As an expert prompt engineer, your task is to refine and optimize the following user-provided prompt.
Your goal is to make it clearer, more concise, and more effective for a large language model.

**Optimization Constraints:**
- **Tone:** ${toneInstruction}
- **Length:** ${lengthInstruction}
- **Persona:** Optimize the prompt from the perspective of a ${persona}.
- **Target Audience:** The final output should be suitable for a ${audience} audience.
- **Core Instructions:** Remove ambiguity, use strong action-oriented verbs, and make implicit instructions explicit.
- **Language:** Optimize the prompt while preserving its original language.

**User Prompt to Optimize:**
---
${userPrompt}
---

Return ONLY the optimized prompt, with no additional commentary or explanation.`;
}

async function callLLMAPI(provider, apiKey, customEndpoint, modelName, prompt) {
    let apiUrl, headers, requestBody;
    
    switch (provider) {
        case 'openai':
            apiUrl = 'https://api.openai.com/v1/chat/completions';
            headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            };
            requestBody = {
                model: modelName,
                messages: [
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 2048
            };
            break;
            
        case 'anthropic':
            apiUrl = 'https://api.anthropic.com/v1/messages';
            headers = {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            };
            requestBody = {
                model: modelName,
                max_tokens: 2048,
                messages: [
                    { role: 'user', content: prompt }
                ]
            };
            break;
            
        case 'google':
            apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
            headers = {
                'Content-Type': 'application/json'
            };
            requestBody = {
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048,
                }
            };
            break;
            
        case 'custom':
            apiUrl = customEndpoint;
            headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            };
            requestBody = {
                model: modelName,
                messages: [
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 2048
            };
            break;
            
        default:
            throw new Error(`Unsupported provider: ${provider}`);
    }
    
    try {
        const url = provider === 'google' ? `${apiUrl}?key=${apiKey}` : apiUrl;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            
            if (response.status === 400) {
                throw new Error('Invalid API request. Please check your configuration.');
            } else if (response.status === 401 || response.status === 403) {
                throw new Error('API key access denied. Please verify your API key.');
            } else if (response.status === 429) {
                throw new Error('API rate limit exceeded. Please try again later.');
            } else {
                throw new Error(`API error: ${errorData.error?.message || errorData.message || 'Unknown error occurred'}`);
            }
        }
        
        const data = await response.json();
        
        // Parse response based on provider
        let optimizedText;
        switch (provider) {
            case 'openai':
            case 'custom':
                if (!data.choices || data.choices.length === 0) {
                    throw new Error('No response from AI model. Please try again.');
                }
                optimizedText = data.choices[0].message?.content;
                break;
                
            case 'anthropic':
                if (!data.content || data.content.length === 0) {
                    throw new Error('No response from AI model. Please try again.');
                }
                optimizedText = data.content[0].text;
                break;
                
            case 'google':
                if (!data.candidates || data.candidates.length === 0) {
                    throw new Error('No response from AI model. Please try again.');
                }
                const candidate = data.candidates[0];
                if (!candidate.content?.parts || candidate.content.parts.length === 0) {
                    throw new Error('Invalid response format from AI model.');
                }
                optimizedText = candidate.content.parts[0].text;
                break;
        }
        
        if (!optimizedText || optimizedText.trim() === '') {
            throw new Error('Empty response from AI model. Please try again.');
        }
        
        return optimizedText.trim();
        
    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('Network connection failed. Please check your internet connection.');
        }
        throw error;
    }
}

async function testLLMConnection(config) {
    const { provider, apiKey, customEndpoint, modelName } = config;
    
    try {
        // Test with a simple prompt
        const testPrompt = 'Say "Hello" if you can understand this message.';
        const response = await callLLMAPI(provider, apiKey, customEndpoint, modelName, testPrompt);
        
        if (response && response.trim()) {
            return { success: true, message: 'Connection successful!' };
        } else {
            return { success: false, error: 'Received empty response from API' };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function saveToHistory(originalPrompt, optimizedPrompt) {
    try {
        const result = await browser.storage.local.get('optimizationHistory');
        const history = result.optimizationHistory || [];
        
        // Add new entry
        const newEntry = {
            originalPrompt,
            optimizedPrompt,
            timestamp: Date.now()
        };
        
        history.unshift(newEntry); // Add to beginning
        
        // Keep entries based on subscription: 30 for freemium, 100 for premium
        const maxEntries = subscriptionStatus === 'premium' ? 100 : 30;
        if (history.length > maxEntries) {
            history.splice(maxEntries);
        }
        
        await browser.storage.local.set({ optimizationHistory: history });
    } catch (error) {
        console.error('Error saving to history:', error);
    }
}

// Generate unique user ID
function generateUserId() {
    return crypto.randomUUID();
}

// Sync with backend to get subscription status
async function syncWithBackend() {
    try {
        if (!userId) {
            console.warn('No user ID available for backend sync');
            return;
        }
        
        const response = await fetch(`${BACKEND_URL}/api/user-status`, {
            method: 'GET',
            headers: {
                'X-User-ID': userId,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            subscriptionStatus = data.subscription_status || 'freemium';
            
            // Update storage
            await browser.storage.local.set({ 
                subscriptionStatus: subscriptionStatus 
            });
            
            console.log('Synced with backend, subscription status:', subscriptionStatus);
        } else {
            console.warn('Failed to sync with backend:', response.status);
        }
    } catch (error) {
        console.error('Error syncing with backend:', error);
    }
}

// Optimize prompt using backend API
async function optimizePromptWithBackend(promptText, options) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/optimize-prompt`, {
            method: 'POST',
            headers: {
                'X-User-ID': userId,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt_text: promptText,
                options: options
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            if (response.status === 429) {
                throw new Error(`Daily optimization limit reached. ${data.error}`);
            } else if (response.status === 403) {
                throw new Error(`Premium feature required: ${data.error}`);
            } else {
                throw new Error(data.error || 'Backend optimization failed');
            }
        }
        
        // Update local usage count for immediate UI feedback
        if (data.usage_remaining !== undefined) {
            const maxLimit = subscriptionStatus === 'premium' ? 50 : 15;
            dailyOptimizationCount = maxLimit - data.usage_remaining;
            await browser.storage.local.set({ dailyCount: dailyOptimizationCount });
        }
        
        return data.optimized_prompt;
    } catch (error) {
        if (error.message.includes('fetch')) {
            throw new Error('Backend connection failed. Check your internet connection.');
        }
        throw error;
    }
}

// Fallback: Direct API optimization (original logic)
async function optimizePromptDirect({ promptText, options }) {
    try {
        // Check daily limit based on subscription
        await checkAndResetDailyCount();
        
        const maxLimit = subscriptionStatus === 'premium' ? 50 : 15;
        if (dailyOptimizationCount >= maxLimit) {
            return {
                success: false,
                error: `Daily limit of ${maxLimit} optimizations reached. ${subscriptionStatus === 'freemium' ? 'Upgrade to Premium for more optimizations.' : ''}`
            };
        }
        
        // Get LLM configuration
        const result = await browser.storage.local.get(['llmProvider', 'apiKey', 'customEndpoint', 'modelName']);
        const { llmProvider, apiKey, customEndpoint, modelName } = result;
        
        if (!apiKey || apiKey.trim() === '') {
            return {
                success: false,
                error: 'API key not found. Please configure your LLM API key in Settings.'
            };
        }
        
        if (!llmProvider) {
            return {
                success: false,
                error: 'LLM provider not configured. Please set up your provider in Settings.'
            };
        }
        
        // Check premium features for freemium users
        if (subscriptionStatus === 'freemium') {
            const premiumFeatures = ['academic', 'journalistic', 'json', 'list', 'table'];
            if (options && premiumFeatures.some(feature => 
                (options.tone && options.tone.toLowerCase().includes(feature)) ||
                (options.format && options.format.toLowerCase().includes(feature))
            )) {
                return {
                    success: false,
                    error: 'Premium feature required. Upgrade to Premium to use advanced tones and output formats.'
                };
            }
        }
        
        // Construct meta-prompt
        const metaPrompt = buildMetaPrompt(promptText, options);
        
        // Make API call based on provider
        const optimizedPrompt = await callLLMAPI(llmProvider, apiKey, customEndpoint, modelName, metaPrompt);
        
        // Increment usage count
        dailyOptimizationCount++;
        await browser.storage.local.set({
            dailyCount: dailyOptimizationCount
        });
        
        // Save to history
        await saveToHistory(promptText, optimizedPrompt);
        
        return {
            success: true,
            optimizedPrompt: optimizedPrompt
        };
        
    } catch (error) {
        console.error('Error in direct optimization:', error);
        return {
            success: false,
            error: error.message || 'Failed to optimize prompt. Please check your API key and try again.'
        };
    }
}

// Handle extension lifecycle events
browser.runtime.onSuspend.addListener(() => {
    console.log('Background script suspending');
});

// Handle storage changes for debugging
browser.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
        console.log('Storage changes:', changes);
    }
});

// Test API key functionality for unlimited tier
async function testApiKey(keyData) {
    try {
        const { provider, apiKey, endpoint, model } = keyData;
        
        if (!apiKey || apiKey.trim() === '') {
            return {
                success: false,
                error: 'API key is required'
            };
        }
        
        // Test with a simple prompt
        const testPrompt = 'Hello, can you respond with "API connection successful"?';
        
        try {
            const response = await callLLMAPI(provider, apiKey, endpoint, model, testPrompt);
            
            if (response && response.length > 0) {
                return {
                    success: true,
                    message: 'API connection successful!'
                };
            } else {
                return {
                    success: false,
                    error: 'Empty response from API'
                };
            }
        } catch (apiError) {
            console.error('API test error:', apiError);
            return {
                success: false,
                error: apiError.message || 'API connection failed'
            };
        }
        
    } catch (error) {
        console.error('Error testing API key:', error);
        return {
            success: false,
            error: 'Failed to test API key'
        };
    }
}

// Enhanced optimization for unlimited tier with advanced techniques
async function optimizePromptUnlimited(promptText, options, technique = 'standard') {
    try {
        // Get unlimited tier API keys
        const result = await browser.storage.local.get(['apiKeys']);
        const apiKeys = result.apiKeys || [];
        
        if (apiKeys.length === 0) {
            throw new Error('No API keys configured. Please add at least one API key in settings.');
        }
        
        // Select the best API key for the technique
        const selectedKey = selectBestApiKey(apiKeys, technique);
        
        if (!selectedKey) {
            throw new Error('No suitable API key found for this optimization technique.');
        }
        
        let metaPrompt;
        
        switch (technique) {
            case 'chain-of-thought':
                metaPrompt = buildChainOfThoughtPrompt(promptText, options);
                break;
            case 'react':
                metaPrompt = buildReActPrompt(promptText, options);
                break;
            case 'self-correction':
                metaPrompt = buildSelfCorrectionPrompt(promptText, options);
                break;
            case 'ethical-refinement':
                metaPrompt = buildEthicalRefinementPrompt(promptText, options);
                break;
            default:
                metaPrompt = buildAdvancedMetaPrompt(promptText, options);
        }
        
        const optimizedPrompt = await callLLMAPI(
            selectedKey.provider, 
            selectedKey.apiKey, 
            selectedKey.endpoint, 
            selectedKey.model, 
            metaPrompt
        );
        
        return optimizedPrompt;
        
    } catch (error) {
        console.error('Error in unlimited optimization:', error);
        throw error;
    }
}

// Select best API key based on technique requirements
function selectBestApiKey(apiKeys, technique) {
    // Filter only connected keys
    const connectedKeys = apiKeys.filter(key => key.status === 'connected');
    
    if (connectedKeys.length === 0) {
        return apiKeys[0]; // Fallback to first key
    }
    
    // Technique-specific preferences
    switch (technique) {
        case 'chain-of-thought':
        case 'react':
            // Prefer OpenAI or Anthropic for reasoning
            return connectedKeys.find(key => 
                key.provider === 'openai' || key.provider === 'anthropic'
            ) || connectedKeys[0];
            
        case 'ethical-refinement':
            // Prefer Anthropic for ethical considerations
            return connectedKeys.find(key => key.provider === 'anthropic') || connectedKeys[0];
            
        default:
            // Use first connected key
            return connectedKeys[0];
    }
}

// Advanced prompting technique builders
function buildChainOfThoughtPrompt(userPrompt, options) {
    return `You are an expert prompt engineer. Optimize the following prompt using Chain-of-Thought reasoning. 

Step 1: Analyze the original prompt for clarity, specificity, and potential ambiguities.
Step 2: Identify areas for improvement including structure, context, and expected output.
Step 3: Apply best practices for prompt engineering.
Step 4: Provide the optimized version.

Original prompt: "${userPrompt}"

Options: ${JSON.stringify(options)}

Follow this chain of thought and provide only the final optimized prompt as your response:`;
}

function buildReActPrompt(userPrompt, options) {
    return `You are an expert prompt engineer using the ReAct (Reasoning + Acting) approach. 

Thought: I need to analyze this prompt and determine what makes it effective or ineffective.
Action: Analyze the prompt structure, clarity, and completeness.
Observation: [Analyze the prompt]

Thought: Based on my analysis, I should identify specific improvements.
Action: List concrete improvements needed.
Observation: [List improvements]

Thought: Now I'll create an optimized version incorporating these improvements.
Action: Generate the optimized prompt.

Original prompt: "${userPrompt}"
Options: ${JSON.stringify(options)}

Please follow the ReAct pattern above and provide the final optimized prompt:`;
}

function buildSelfCorrectionPrompt(userPrompt, options) {
    return `You are an expert prompt engineer with self-correction capabilities. Your task is to optimize this prompt through iterative refinement.

First attempt: Analyze and optimize this prompt:
"${userPrompt}"

Now, critically evaluate your first optimization:
- Is it clear and unambiguous?
- Does it provide sufficient context?
- Will it produce the desired output?
- Are there any potential issues?

Self-correction: Based on your evaluation, provide a final, improved version.

Options to consider: ${JSON.stringify(options)}

Provide only the final optimized prompt:`;
}

function buildEthicalRefinementPrompt(userPrompt, options) {
    return `You are an expert prompt engineer specializing in ethical AI interactions. Review and optimize this prompt while ensuring it adheres to ethical guidelines.

Original prompt: "${userPrompt}"

Ethical considerations:
1. Check for potential bias or harmful content
2. Ensure inclusivity and fairness
3. Remove any discriminatory language
4. Maintain respectful tone
5. Consider potential misuse

Optimization guidelines: ${JSON.stringify(options)}

Provide an optimized, ethically-refined version of the prompt:`;
}

function buildAdvancedMetaPrompt(userPrompt, options) {
    const { tone, length, persona, audience, format } = options;
    
    return `You are an expert prompt engineer. Optimize this prompt for maximum effectiveness using advanced techniques:

ORIGINAL PROMPT: "${userPrompt}"

OPTIMIZATION CRITERIA:
- Tone: ${tone || 'professional'}
- Length: ${length || 'balanced'}
- Persona: ${persona || 'expert assistant'}
- Audience: ${audience || 'general'}
- Format: ${format || 'structured'}

ADVANCED TECHNIQUES TO APPLY:
1. Specificity enhancement - Make instructions more precise
2. Context enrichment - Add relevant background information
3. Output structuring - Define clear expected output format
4. Constraint setting - Add appropriate limitations or boundaries
5. Example provision - Include examples when beneficial

Provide only the optimized prompt:`;
}
