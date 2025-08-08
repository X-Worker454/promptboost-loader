document.addEventListener('DOMContentLoaded', async function() {
    const statusIndicator = document.getElementById('statusIndicator');
    const statusMessage = document.getElementById('statusMessage');
    const usageCount = document.getElementById('usageCount');
    const usageProgress = document.getElementById('usageProgress');
    const subscriptionStatus = document.getElementById('subscriptionStatus');
    const settingsBtn = document.getElementById('settingsBtn');
    const premiumBtn = document.getElementById('premiumBtn');
    const syncBtn = document.getElementById('syncBtn');

    // Load and display current status
    await loadStatus();

    // Event listeners
    settingsBtn.addEventListener('click', function() {
        browser.tabs.create({ url: browser.runtime.getURL('options.html') });
        window.close();
    });
    
    if (syncBtn) {
        syncBtn.addEventListener('click', async function() {
            syncBtn.textContent = 'Syncing...';
            syncBtn.disabled = true;
            
            try {
                await browser.runtime.sendMessage({ action: 'syncBackend' });
                await loadStatus();
            } catch (error) {
                console.error('Sync failed:', error);
            } finally {
                syncBtn.textContent = 'Sync';
                syncBtn.disabled = false;
            }
        });
    }

    async function loadStatus() {
        try {
            // Check API key and subscription status
            const result = await browser.storage.local.get(['apiKey', 'llmProvider', 'dailyCount', 'lastResetDate', 'subscriptionStatus', 'userId']);
            
            const hasApiKey = result.apiKey && result.apiKey.trim() !== '';
            const dailyCount = result.dailyCount || 0;
            const lastResetDate = result.lastResetDate;
            const userSubscription = result.subscriptionStatus || 'freemium';
            const userId = result.userId;
            
            // Reset daily count if it's a new day
            const today = new Date().toDateString();
            let currentDailyCount = dailyCount;
            
            if (lastResetDate !== today) {
                currentDailyCount = 0;
                await browser.storage.local.set({
                    dailyCount: 0,
                    lastResetDate: today
                });
            }

            // Update API status
            if (hasApiKey) {
                statusIndicator.classList.add('connected');
                const provider = result.llmProvider || 'Unknown';
                statusMessage.textContent = `${provider.toUpperCase()} API configured ✓`;
            } else {
                statusIndicator.classList.add('error');
                statusMessage.textContent = 'LLM API not configured. Please set up in Settings.';
            }

            // Update subscription status
            if (subscriptionStatus) {
                const statusText = userSubscription === 'premium' ? 'Premium' : 'Free';
                const statusColor = userSubscription === 'premium' ? '#4CAF50' : '#2196F3';
                subscriptionStatus.textContent = `Status: ${statusText}`;
                subscriptionStatus.style.color = statusColor;
            }
            
            // Update usage counter based on subscription
            const maxOptimizations = userSubscription === 'premium' ? 50 : 15;
            usageCount.textContent = `${currentDailyCount}/${maxOptimizations}`;
            
            // Update progress bar
            const progressPercentage = (currentDailyCount / maxOptimizations) * 100;
            usageProgress.style.width = `${progressPercentage}%`;
            
            // Change progress bar color based on usage
            if (progressPercentage >= 100) {
                usageProgress.style.background = 'linear-gradient(90deg, #f44336, #d32f2f)';
            } else if (progressPercentage >= 80) {
                usageProgress.style.background = 'linear-gradient(90deg, #ff9800, #f57c00)';
            } else {
                usageProgress.style.background = userSubscription === 'premium' ? 
                    'linear-gradient(90deg, #ffd700, #ffb347)' : 'linear-gradient(90deg, #4CAF50, #8BC34A)';
            }
            
            // Update premium button based on subscription
            if (premiumBtn) {
                if (userSubscription === 'premium') {
                    premiumBtn.textContent = 'Premium Active ✓';
                    premiumBtn.style.background = 'linear-gradient(90deg, #4CAF50, #66BB6A)';
                    premiumBtn.disabled = true;
                } else {
                    premiumBtn.textContent = 'Get Premium';
                    premiumBtn.style.background = 'linear-gradient(90deg, #ffd700, #ffb347)';
                    premiumBtn.disabled = false;
                    
                    // Add click handler for upgrade
                    if (!premiumBtn.hasAttribute('data-listener-added')) {
                        premiumBtn.addEventListener('click', function() {
                            const upgradeUrl = userId ? 
                                `https://optimo-prompt-ai.com?user_id=${userId}` :
                                'https://optimo-prompt-ai.com';
                            browser.tabs.create({ url: upgradeUrl });
                        });
                        premiumBtn.setAttribute('data-listener-added', 'true');
                    }
                }
            }

        } catch (error) {
            console.error('Error loading status:', error);
            statusIndicator.classList.add('error');
            statusMessage.textContent = 'Error loading status';
        }
    }
});
