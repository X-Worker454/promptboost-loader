document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const llmProviderSelect = document.getElementById('llmProvider');
    const apiKeyInput = document.getElementById('apiKey');
    const toggleApiKeyBtn = document.getElementById('toggleApiKey');
    const customEndpointGroup = document.getElementById('customEndpointGroup');
    const customEndpointInput = document.getElementById('customEndpoint');
    const modelNameInput = document.getElementById('modelName');
    const saveConfigBtn = document.getElementById('saveConfig');
    const testConnectionBtn = document.getElementById('testConnection');
    const configStatus = document.getElementById('configStatus');
    const apiKeyHelp = document.getElementById('apiKeyHelp');
    const historySearch = document.getElementById('historySearch');
    const clearHistoryBtn = document.getElementById('clearHistory');
    const historyContainer = document.getElementById('historyContainer');
    const librarySearch = document.getElementById('librarySearch');
    const addPromptBtn = document.getElementById('addPrompt');
    const libraryContainer = document.getElementById('libraryContainer');
    const userIdDisplay = document.getElementById('userIdDisplay');
    const copyUserIdBtn = document.getElementById('copyUserId');
    const subscriptionStatusDisplay = document.getElementById('subscriptionStatusDisplay');
    const syncBackendBtn = document.getElementById('syncBackend');
    
    // Modal elements
    const promptModal = document.getElementById('promptModal');
    const modalTitle = document.getElementById('modalTitle');
    const closeModalBtn = document.getElementById('closeModal');
    const promptTitle = document.getElementById('promptTitle');
    const promptContent = document.getElementById('promptContent');
    const cancelPromptBtn = document.getElementById('cancelPrompt');
    const savePromptBtn = document.getElementById('savePrompt');

    let editingPromptIndex = -1;
    let subscriptionStatus = 'freemium';
    let usageStats = { daily: 0, history: 0, saved: 0 };
    let usageData = { dailyCount: 0, lastReset: new Date().toISOString().split('T')[0] };
    let apiKeys = [];
    let templates = [];

    // Initialize
    loadUserInfo();
    loadApiKeys();
    loadTemplates();
    loadHistory();
    loadLibrary();

    // Event listeners for multi-LLM API keys
    const addApiKeyBtn = document.getElementById('addApiKeyBtn');
    const cancelAddKeyBtn = document.getElementById('cancelAddKey');
    
    if (addApiKeyBtn) addApiKeyBtn.addEventListener('click', showAddApiKeyForm);
    if (cancelAddKeyBtn) cancelAddKeyBtn.addEventListener('click', hideAddApiKeyForm);
    if (llmProviderSelect) llmProviderSelect.addEventListener('change', updateProviderUI);
    if (toggleApiKeyBtn) toggleApiKeyBtn.addEventListener('click', toggleApiKeyVisibility);
    if (saveConfigBtn) saveConfigBtn.addEventListener('click', saveApiKey);
    if (testConnectionBtn) testConnectionBtn.addEventListener('click', testConnection);
    
    // Event listeners for templates
    const addTemplateBtn = document.getElementById('addTemplate');
    const templatesSearch = document.getElementById('templatesSearch');
    
    if (addTemplateBtn) addTemplateBtn.addEventListener('click', openTemplateModal);
    if (templatesSearch) templatesSearch.addEventListener('input', filterTemplates);
    historySearch.addEventListener('input', filterHistory);
    clearHistoryBtn.addEventListener('click', clearHistory);
    librarySearch.addEventListener('input', filterLibrary);
    addPromptBtn.addEventListener('click', () => openPromptModal());
    closeModalBtn.addEventListener('click', closeModal);
    cancelPromptBtn.addEventListener('click', closeModal);
    savePromptBtn.addEventListener('click', savePromptToLibrary);
    
    if (copyUserIdBtn) {
        copyUserIdBtn.addEventListener('click', copyUserId);
    }
    if (syncBackendBtn) {
        syncBackendBtn.addEventListener('click', syncWithBackend);
    }

    // Close modal when clicking outside
    promptModal.addEventListener('click', function(e) {
        if (e.target === promptModal) {
            closeModal();
        }
    });

    async function loadLLMConfig() {
        try {
            const result = await browser.storage.local.get(['llmProvider', 'apiKey', 'customEndpoint', 'modelName']);
            
            if (result.llmProvider) {
                llmProviderSelect.value = result.llmProvider;
            }
            if (result.apiKey) {
                apiKeyInput.value = result.apiKey;
            }
            if (result.customEndpoint) {
                customEndpointInput.value = result.customEndpoint;
            }
            if (result.modelName) {
                modelNameInput.value = result.modelName;
            }
            
            updateProviderUI();
            
            if (result.apiKey) {
                showConfigStatus('Configuration loaded successfully', 'success');
            }
        } catch (error) {
            console.error('Error loading LLM config:', error);
        }
    }
    
    async function loadUserInfo() {
        try {
            const result = await browser.storage.local.get(['userId', 'subscriptionStatus']);
            const userId = result.userId;
            const subscriptionStatus = result.subscriptionStatus || 'freemium';
            
            if (userIdDisplay && userId) {
                userIdDisplay.textContent = userId;
            }
            
            if (subscriptionStatusDisplay) {
                const statusText = subscriptionStatus === 'premium' ? 'Premium' : 'Freemium';
                const statusColor = subscriptionStatus === 'premium' ? '#4CAF50' : '#2196F3';
                subscriptionStatusDisplay.textContent = statusText;
                subscriptionStatusDisplay.style.color = statusColor;
                subscriptionStatusDisplay.style.fontWeight = '600';
            }
            
            // Update UI based on subscription
            updateUIForSubscription(subscriptionStatus);
        } catch (error) {
            console.error('Error loading user info:', error);
        }
    }
    
    function updateUIForSubscription(subscriptionStatus) {
        // Update prompt library limit info
        const maxPrompts = subscriptionStatus === 'premium' ? 50 : 15;
        const libraryTitle = document.querySelector('.library-section h3');
        if (libraryTitle) {
            libraryTitle.textContent = `Saved Prompt Library (${maxPrompts} slots)`;
        }
        
        // Update history limit info
        const maxHistory = subscriptionStatus === 'premium' ? 100 : 30;
        const historyTitle = document.querySelector('.history-section h3');
        if (historyTitle) {
            historyTitle.textContent = `Optimization History (Last ${maxHistory} entries)`;
        }
    }
    
    async function copyUserId() {
        try {
            const result = await browser.storage.local.get('userId');
            if (result.userId) {
                await navigator.clipboard.writeText(result.userId);
                
                // Show feedback
                const originalText = copyUserIdBtn.textContent;
                copyUserIdBtn.textContent = 'Copied!';
                copyUserIdBtn.style.background = '#4CAF50';
                
                setTimeout(() => {
                    copyUserIdBtn.textContent = originalText;
                    copyUserIdBtn.style.background = '';
                }, 2000);
            }
        } catch (error) {
            console.error('Failed to copy user ID:', error);
            copyUserIdBtn.textContent = 'Failed';
            setTimeout(() => {
                copyUserIdBtn.textContent = 'Copy';
            }, 2000);
        }
    }
    
    async function syncWithBackend() {
        if (!syncBackendBtn) return;
        
        const originalText = syncBackendBtn.textContent;
        syncBackendBtn.textContent = 'Syncing...';
        syncBackendBtn.disabled = true;
        
        try {
            const response = await browser.runtime.sendMessage({ action: 'syncBackend' });
            if (response.success) {
                await loadUserInfo();
                showConfigStatus('Subscription status updated successfully!', 'success');
            } else {
                showConfigStatus('Failed to sync with backend', 'error');
            }
        } catch (error) {
            console.error('Error syncing with backend:', error);
            showConfigStatus('Sync failed - using cached status', 'warning');
        } finally {
            syncBackendBtn.textContent = originalText;
            syncBackendBtn.disabled = false;
        }
    }

    function updateProviderUI() {
        const provider = llmProviderSelect.value;
        
        // Show/hide custom endpoint field
        customEndpointGroup.style.display = provider === 'custom' ? 'block' : 'none';
        
        // Update help text and model placeholder based on provider
        switch (provider) {
            case 'openai':
                apiKeyHelp.innerHTML = `
                    <p>Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank">OpenAI Platform</a></p>
                    <p>Your API key is stored locally and never shared with our servers.</p>
                `;
                modelNameInput.placeholder = 'gpt-4, gpt-3.5-turbo, gpt-4-turbo';
                modelNameInput.value = modelNameInput.value || 'gpt-4';
                break;
            case 'anthropic':
                apiKeyHelp.innerHTML = `
                    <p>Get your API key from <a href="https://console.anthropic.com/" target="_blank">Anthropic Console</a></p>
                    <p>Your API key is stored locally and never shared with our servers.</p>
                `;
                modelNameInput.placeholder = 'claude-3-sonnet-20240229, claude-3-haiku-20240307';
                modelNameInput.value = modelNameInput.value || 'claude-3-sonnet-20240229';
                break;
            case 'google':
                apiKeyHelp.innerHTML = `
                    <p>Get your API key from <a href="https://makersuite.google.com/app/apikey" target="_blank">Google AI Studio</a></p>
                    <p>Your API key is stored locally and never shared with our servers.</p>
                `;
                modelNameInput.placeholder = 'gemini-pro, gemini-2.5-flash';
                modelNameInput.value = modelNameInput.value || 'gemini-2.5-flash';
                break;
            case 'custom':
                apiKeyHelp.innerHTML = `
                    <p>Enter your custom API endpoint and authentication details.</p>
                    <p>Your credentials are stored locally and never shared with our servers.</p>
                `;
                modelNameInput.placeholder = 'Enter model identifier';
                break;
        }
    }

    function toggleApiKeyVisibility() {
        if (apiKeyInput.type === 'password') {
            apiKeyInput.type = 'text';
            toggleApiKeyBtn.textContent = '🙈';
        } else {
            apiKeyInput.type = 'password';
            toggleApiKeyBtn.textContent = '👁️';
        }
    }

    async function saveLLMConfig() {
        const provider = llmProviderSelect.value;
        const apiKey = apiKeyInput.value.trim();
        const customEndpoint = customEndpointInput.value.trim();
        const modelName = modelNameInput.value.trim();
        
        if (!apiKey) {
            showConfigStatus('Please enter an API key', 'error');
            return;
        }

        if (provider === 'custom' && !customEndpoint) {
            showConfigStatus('Please enter a custom endpoint URL', 'error');
            return;
        }

        if (!modelName) {
            showConfigStatus('Please enter a model name', 'error');
            return;
        }

        try {
            await browser.storage.local.set({
                llmProvider: provider,
                apiKey: apiKey,
                customEndpoint: customEndpoint,
                modelName: modelName
            });
            showConfigStatus('Configuration saved successfully!', 'success');
        } catch (error) {
            console.error('Error saving LLM config:', error);
            showConfigStatus('Error saving configuration', 'error');
        }
    }

    async function testLLMConnection() {
        const provider = llmProviderSelect.value;
        const apiKey = apiKeyInput.value.trim();
        const customEndpoint = customEndpointInput.value.trim();
        const modelName = modelNameInput.value.trim();
        
        if (!apiKey) {
            showConfigStatus('Please enter an API key first', 'error');
            return;
        }

        testConnectionBtn.disabled = true;
        testConnectionBtn.textContent = 'Testing...';
        
        try {
            const response = await browser.runtime.sendMessage({
                action: 'testConnection',
                data: { provider, apiKey, customEndpoint, modelName }
            });
            
            if (response.success) {
                showConfigStatus('Connection test successful!', 'success');
            } else {
                showConfigStatus(response.error || 'Connection test failed', 'error');
            }
        } catch (error) {
            console.error('Error testing connection:', error);
            showConfigStatus('Error testing connection', 'error');
        } finally {
            testConnectionBtn.disabled = false;
            testConnectionBtn.textContent = 'Test Connection';
        }
    }

    function showConfigStatus(message, type) {
        configStatus.textContent = message;
        configStatus.className = `status-message ${type}`;
        setTimeout(() => {
            configStatus.style.display = 'none';
        }, 3000);
    }

    async function loadHistory() {
        try {
            const result = await browser.storage.local.get('optimizationHistory');
            const history = result.optimizationHistory || [];
            renderHistory(history);
        } catch (error) {
            console.error('Error loading history:', error);
        }
    }

    function renderHistory(history) {
        if (history.length === 0) {
            historyContainer.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📝</span>
                    <p>No optimization history yet. Start optimizing prompts to see them here!</p>
                </div>
            `;
            return;
        }

        historyContainer.innerHTML = history.map((item, index) => `
            <div class="history-item" data-index="${index}">
                <div class="item-header">
                    <span class="item-timestamp">${new Date(item.timestamp).toLocaleString()}</span>
                </div>
                <div class="item-content">
                    <div class="original-prompt">
                        <div class="prompt-label">Original Prompt:</div>
                        <div class="prompt-text">${escapeHtml(item.originalPrompt)}</div>
                    </div>
                    <div class="optimized-prompt">
                        <div class="prompt-label">Optimized Prompt:</div>
                        <div class="prompt-text">${escapeHtml(item.optimizedPrompt)}</div>
                    </div>
                </div>
                <div class="item-actions">
                    <button class="use-btn" onclick="copyToClipboard('${escapeHtml(item.optimizedPrompt)}')">Copy</button>
                    <button class="edit-btn" onclick="saveToLibrary('${escapeHtml(item.optimizedPrompt)}')">Save to Library</button>
                </div>
            </div>
        `).join('');
    }

    function filterHistory() {
        const searchTerm = historySearch.value.toLowerCase();
        const historyItems = historyContainer.querySelectorAll('.history-item');
        
        historyItems.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(searchTerm) ? 'block' : 'none';
        });
    }

    async function clearHistory() {
        if (confirm('Are you sure you want to clear all optimization history?')) {
            try {
                await browser.storage.local.set({ optimizationHistory: [] });
                loadHistory();
            } catch (error) {
                console.error('Error clearing history:', error);
            }
        }
    }

    async function loadLibrary() {
        try {
            const result = await browser.storage.local.get('promptLibrary');
            const library = result.promptLibrary || [];
            renderLibrary(library);
        } catch (error) {
            console.error('Error loading library:', error);
        }
    }

    function renderLibrary(library) {
        if (library.length === 0) {
            libraryContainer.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">💾</span>
                    <p>No saved prompts yet. Save your favorite optimized prompts for quick access!</p>
                </div>
            `;
            return;
        }

        libraryContainer.innerHTML = library.map((item, index) => `
            <div class="library-item" data-index="${index}">
                <div class="item-header">
                    <h4>${escapeHtml(item.title)}</h4>
                    <span class="item-timestamp">${new Date(item.timestamp).toLocaleString()}</span>
                </div>
                <div class="item-content">
                    <div class="prompt-text">${escapeHtml(item.content)}</div>
                </div>
                <div class="item-actions">
                    <button class="use-btn" onclick="copyToClipboard('${escapeHtml(item.content)}')">Copy</button>
                    <button class="edit-btn" onclick="editPrompt(${index})">Edit</button>
                    <button class="delete-btn" onclick="deletePrompt(${index})">Delete</button>
                </div>
            </div>
        `).join('');
    }

    function filterLibrary() {
        const searchTerm = librarySearch.value.toLowerCase();
        const libraryItems = libraryContainer.querySelectorAll('.library-item');
        
        libraryItems.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(searchTerm) ? 'block' : 'none';
        });
    }

    function openPromptModal(title = '', content = '', index = -1) {
        modalTitle.textContent = index >= 0 ? 'Edit Prompt' : 'Add New Prompt';
        promptTitle.value = title;
        promptContent.value = content;
        editingPromptIndex = index;
        promptModal.classList.add('show');
    }

    function closeModal() {
        promptModal.classList.remove('show');
        promptTitle.value = '';
        promptContent.value = '';
        editingPromptIndex = -1;
    }

    async function savePromptToLibrary() {
        const title = promptTitle.value.trim();
        const content = promptContent.value.trim();
        
        if (!title || !content) {
            alert('Please enter both title and content');
            return;
        }

        try {
            const result = await browser.storage.local.get('promptLibrary');
            const library = result.promptLibrary || [];
            
            if (editingPromptIndex >= 0) {
                // Edit existing prompt
                library[editingPromptIndex] = {
                    title,
                    content,
                    timestamp: library[editingPromptIndex].timestamp // Keep original timestamp
                };
            } else {
                // Add new prompt - check subscription limit
                const result = await browser.storage.local.get('subscriptionStatus');
                const subscriptionStatus = result.subscriptionStatus || 'freemium';
                const maxPrompts = subscriptionStatus === 'premium' ? 50 : 15;
                
                if (library.length >= maxPrompts) {
                    const upgradeMsg = subscriptionStatus === 'freemium' ? ' Upgrade to Premium for 50 slots.' : '';
                    alert(`Maximum ${maxPrompts} prompts allowed in library.${upgradeMsg}`);
                    return;
                }
                
                library.push({
                    title,
                    content,
                    timestamp: Date.now()
                });
            }
            
            await browser.storage.local.set({ promptLibrary: library });
            loadLibrary();
            closeModal();
        } catch (error) {
            console.error('Error saving prompt:', error);
            alert('Error saving prompt');
        }
    }

    // Global functions for inline event handlers
    window.copyToClipboard = function(text) {
        navigator.clipboard.writeText(text).then(() => {
            // Could show a toast notification here
            console.log('Copied to clipboard');
        });
    };

    window.saveToLibrary = function(content) {
        openPromptModal('Optimized Prompt', content);
    };

    window.editPrompt = async function(index) {
        try {
            const result = await browser.storage.local.get('promptLibrary');
            const library = result.promptLibrary || [];
            const prompt = library[index];
            if (prompt) {
                openPromptModal(prompt.title, prompt.content, index);
            }
        } catch (error) {
            console.error('Error loading prompt for editing:', error);
        }
    };

    window.deletePrompt = async function(index) {
        if (confirm('Are you sure you want to delete this prompt?')) {
            try {
                const result = await browser.storage.local.get('promptLibrary');
                const library = result.promptLibrary || [];
                library.splice(index, 1);
                await browser.storage.local.set({ promptLibrary: library });
                loadLibrary();
            } catch (error) {
                console.error('Error deleting prompt:', error);
            }
        }
    };

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Multi-LLM API Key Management Functions
    async function loadApiKeys() {
        try {
            const result = await browser.storage.local.get(['apiKeys', 'subscriptionStatus']);
            apiKeys = result.apiKeys || [];
            subscriptionStatus = result.subscriptionStatus || 'freemium';
            
            updateUIForSubscriptionStatus();
            renderApiKeys();
        } catch (error) {
            console.error('Error loading API keys:', error);
        }
    }

    function updateUIForSubscriptionStatus() {
        const isUnlimited = subscriptionStatus === 'unlimited' || subscriptionStatus === 'trialing_unlimited';
        const templatesSection = document.getElementById('templatesSection');
        const llmSectionTitle = document.getElementById('llmSectionTitle');
        const historyTitle = document.getElementById('historyTitle');
        const libraryTitle = document.getElementById('libraryTitle');
        
        if (isUnlimited) {
            if (templatesSection) templatesSection.style.display = 'block';
            if (llmSectionTitle) llmSectionTitle.textContent = 'Multi-LLM Configuration';
            if (historyTitle) historyTitle.textContent = 'Optimization History (Unlimited)';
            if (libraryTitle) libraryTitle.textContent = 'Saved Prompt Library (Unlimited)';
        } else {
            if (templatesSection) templatesSection.style.display = 'none';
            if (llmSectionTitle) llmSectionTitle.textContent = 'LLM Configuration';
            const historyLimit = subscriptionStatus === 'premium' ? 100 : 30;
            const libraryLimit = subscriptionStatus === 'premium' ? 50 : 15;
            if (historyTitle) historyTitle.textContent = `Optimization History (Last ${historyLimit} entries)`;
            if (libraryTitle) libraryTitle.textContent = `Saved Prompt Library (${libraryLimit} slots)`;
        }
    }

    function renderApiKeys() {
        const apiKeysList = document.getElementById('apiKeysList');
        if (!apiKeysList) return;

        if (apiKeys.length === 0) {
            apiKeysList.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">🔑</span>
                    <p>No API keys configured. Add your first LLM API key to get started!</p>
                </div>
            `;
            return;
        }

        apiKeysList.innerHTML = apiKeys.map((key, index) => `
            <div class="api-key-item">
                <div class="api-key-provider">${getProviderDisplayName(key.provider)}</div>
                <div class="api-key-model">${key.model || 'Default model'}</div>
                <div class="api-key-status ${key.status || 'disconnected'}">${key.status === 'connected' ? 'Connected' : 'Not tested'}</div>
                <div class="api-key-actions">
                    <button class="btn-test" onclick="testApiKey(${index})">Test</button>
                    <button class="btn-edit" onclick="editApiKey(${index})">Edit</button>
                    <button class="btn-delete" onclick="deleteApiKey(${index})">Delete</button>
                </div>
            </div>
        `).join('');
    }

    function getProviderDisplayName(provider) {
        const names = {
            'openai': 'OpenAI',
            'anthropic': 'Anthropic Claude',
            'google': 'Google Gemini',
            'deepseek': 'DeepSeek',
            'kimi': 'Kimi',
            'grok': 'Grok',
            'qwen': 'Qwen',
            'mistral': 'Mistral',
            'glm': 'GLM 4.5',
            'llama': 'Llama',
            'together': 'Together AI',
            'openrouter': 'OpenRouter',
            'custom': 'Custom API'
        };
        return names[provider] || provider;
    }

    function showAddApiKeyForm() {
        const addApiKeyForm = document.getElementById('addApiKeyForm');
        const addApiKeyBtn = document.getElementById('addApiKeyBtn');
        
        if (addApiKeyForm) addApiKeyForm.style.display = 'block';
        if (addApiKeyBtn) addApiKeyBtn.style.display = 'none';
        
        // Reset form
        if (llmProviderSelect) llmProviderSelect.value = 'openai';
        if (apiKeyInput) apiKeyInput.value = '';
        if (customEndpointInput) customEndpointInput.value = '';
        if (modelNameInput) modelNameInput.value = '';
        updateProviderUI();
    }

    function hideAddApiKeyForm() {
        const addApiKeyForm = document.getElementById('addApiKeyForm');
        const addApiKeyBtn = document.getElementById('addApiKeyBtn');
        
        if (addApiKeyForm) addApiKeyForm.style.display = 'none';
        if (addApiKeyBtn) addApiKeyBtn.style.display = 'inline-flex';
    }

    async function saveApiKey() {
        if (!llmProviderSelect || !apiKeyInput) return;
        
        const provider = llmProviderSelect.value;
        const apiKey = apiKeyInput.value.trim();
        const endpoint = customEndpointInput ? customEndpointInput.value.trim() : '';
        const model = modelNameInput ? modelNameInput.value.trim() : '';

        if (!apiKey) {
            showConfigStatus('Please enter an API key', 'error');
            return;
        }

        const newKey = {
            id: Date.now().toString(),
            provider,
            apiKey,
            endpoint,
            model,
            status: 'disconnected',
            createdAt: new Date().toISOString()
        };

        apiKeys.push(newKey);
        
        try {
            await browser.storage.local.set({ apiKeys });
            renderApiKeys();
            hideAddApiKeyForm();
            showConfigStatus('API key saved successfully', 'success');
        } catch (error) {
            console.error('Error saving API key:', error);
            showConfigStatus('Failed to save API key', 'error');
        }
    }

    // Template Management Functions
    async function loadTemplates() {
        try {
            const result = await browser.storage.local.get(['templates']);
            templates = result.templates || [];
            renderTemplates();
        } catch (error) {
            console.error('Error loading templates:', error);
        }
    }

    function renderTemplates() {
        const templatesContainer = document.getElementById('templatesContainer');
        if (!templatesContainer) return;

        if (templates.length === 0) {
            templatesContainer.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📋</span>
                    <p>No templates yet. Create your first custom prompt template!</p>
                </div>
            `;
            return;
        }

        templatesContainer.innerHTML = templates.map((template, index) => `
            <div class="template-item">
                <div class="template-info">
                    <div class="template-name">${template.name}</div>
                    <div class="template-description">${template.description || 'No description'}</div>
                    <div class="template-tags">
                        ${template.tags ? template.tags.map(tag => `<span class="template-tag">${tag}</span>`).join('') : ''}
                    </div>
                </div>
                <div class="template-actions">
                    <button class="btn-use" onclick="useTemplate(${index})">Use</button>
                    <button class="btn-edit" onclick="editTemplate(${index})">Edit</button>
                    <button class="btn-delete" onclick="deleteTemplate(${index})">Delete</button>
                </div>
            </div>
        `).join('');
    }

    // Global functions for API key management
    window.testApiKey = async function(index) {
        const key = apiKeys[index];
        if (!key) return;

        try {
            showConfigStatus('Testing connection...', 'info');
            
            const response = await browser.runtime.sendMessage({
                type: 'testApiKey',
                keyData: key
            });

            if (response.success) {
                apiKeys[index].status = 'connected';
                await browser.storage.local.set({ apiKeys });
                renderApiKeys();
                showConfigStatus('Connection successful!', 'success');
            } else {
                apiKeys[index].status = 'disconnected';
                await browser.storage.local.set({ apiKeys });
                renderApiKeys();
                showConfigStatus(`Connection failed: ${response.error}`, 'error');
            }
        } catch (error) {
            console.error('Error testing API key:', error);
            showConfigStatus('Failed to test connection', 'error');
        }
    };

    window.editApiKey = function(index) {
        const key = apiKeys[index];
        if (!key) return;

        showAddApiKeyForm();
        
        if (llmProviderSelect) llmProviderSelect.value = key.provider;
        if (apiKeyInput) apiKeyInput.value = key.apiKey;
        if (customEndpointInput) customEndpointInput.value = key.endpoint || '';
        if (modelNameInput) modelNameInput.value = key.model || '';
        
        updateProviderUI();
    };

    window.deleteApiKey = async function(index) {
        if (!confirm('Are you sure you want to delete this API key?')) return;

        apiKeys.splice(index, 1);
        
        try {
            await browser.storage.local.set({ apiKeys });
            renderApiKeys();
            showConfigStatus('API key deleted', 'success');
        } catch (error) {
            console.error('Error deleting API key:', error);
            showConfigStatus('Failed to delete API key', 'error');
        }
    };

    // Global functions for template management
    window.useTemplate = function(index) {
        const template = templates[index];
        if (!template) return;
        
        navigator.clipboard.writeText(template.content).then(() => {
            showConfigStatus('Template copied to clipboard!', 'success');
        }).catch(() => {
            showConfigStatus('Failed to copy template', 'error');
        });
    };

    window.editTemplate = function(index) {
        const template = templates[index];
        if (!template) return;
        
        const name = prompt('Template name:', template.name);
        if (!name) return;
        
        const content = prompt('Template content:', template.content);
        if (!content) return;
        
        const description = prompt('Description:', template.description || '');
        
        templates[index] = {
            ...template,
            name,
            content,
            description,
            updatedAt: new Date().toISOString()
        };
        
        updateTemplate();
    };

    window.deleteTemplate = async function(index) {
        if (!confirm('Are you sure you want to delete this template?')) return;
        
        templates.splice(index, 1);
        
        try {
            await browser.storage.local.set({ templates });
            renderTemplates();
            showConfigStatus('Template deleted', 'success');
        } catch (error) {
            console.error('Error deleting template:', error);
            showConfigStatus('Failed to delete template', 'error');
        }
    };

    async function updateTemplate() {
        try {
            await browser.storage.local.set({ templates });
            renderTemplates();
            showConfigStatus('Template updated successfully', 'success');
        } catch (error) {
            console.error('Error updating template:', error);
            showConfigStatus('Failed to update template', 'error');
        }
    }

    function openTemplateModal() {
        const name = prompt('Template name:');
        if (!name) return;
        
        const content = prompt('Template content:');
        if (!content) return;
        
        const description = prompt('Description (optional):') || '';
        
        const newTemplate = {
            id: Date.now().toString(),
            name,
            content,
            description,
            tags: [],
            createdAt: new Date().toISOString()
        };
        
        saveTemplate(newTemplate);
    }

    async function saveTemplate(template) {
        templates.push(template);
        
        try {
            await browser.storage.local.set({ templates });
            renderTemplates();
            showConfigStatus('Template saved successfully', 'success');
        } catch (error) {
            console.error('Error saving template:', error);
            showConfigStatus('Failed to save template', 'error');
        }
    }

    function filterTemplates() {
        const search = document.getElementById('templatesSearch');
        if (!search) return;
        
        const searchTerm = search.value.toLowerCase();
        const templateItems = document.querySelectorAll('.template-item');
        
        templateItems.forEach(item => {
            const name = item.querySelector('.template-name').textContent.toLowerCase();
            const description = item.querySelector('.template-description').textContent.toLowerCase();
            
            const matches = name.includes(searchTerm) || description.includes(searchTerm);
            item.style.display = matches ? 'flex' : 'none';
        });
    }
});
