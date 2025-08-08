// Optimo Prompt Ai - Landing Page JavaScript
// Paddle checkout integration and user verification

class OptimoLanding {
    constructor() {
        this.userId = null;
        this.paddleInitialized = false;
        this.init();
    }

    async init() {
        await this.initPaddle();
        this.bindEventListeners();
        this.loadUserIdFromUrl();
    }

    // Initialize Paddle with sandbox configuration
    async initPaddle() {
        try {
            // Initialize Paddle - using sandbox token for development
            // Replace with production token when ready
            const paddleToken = 'test_YOUR_PADDLE_CLIENT_TOKEN_HERE'; // Replace with actual token
            
            if (typeof Paddle !== 'undefined') {
                await Paddle.Initialize({
                    token: paddleToken,
                    environment: 'sandbox', // Change to 'production' for live
                    debug: true // Set to false in production
                });
                
                this.paddleInitialized = true;
                console.log('Paddle initialized successfully');
            } else {
                console.warn('Paddle.js not loaded');
            }
        } catch (error) {
            console.error('Failed to initialize Paddle:', error);
        }
    }

    // Bind event listeners to UI elements
    bindEventListeners() {
        // Premium button click handler
        const premiumBtn = document.getElementById('get-premium-btn');
        if (premiumBtn) {
            premiumBtn.addEventListener('click', () => this.handlePremiumPurchase());
        }

        // Unlimited trial button click handler
        const unlimitedTrialBtn = document.getElementById('start-unlimited-trial-btn');
        if (unlimitedTrialBtn) {
            unlimitedTrialBtn.addEventListener('click', () => this.handleUnlimitedTrial());
        }

        // Free tier button click handler
        const freeBtn = document.querySelector('.cta-button.free');
        if (freeBtn) {
            freeBtn.addEventListener('click', () => this.handleFreeTierClick());
        }

        // User ID verification
        const verifyBtn = document.getElementById('verify-id-btn');
        if (verifyBtn) {
            verifyBtn.addEventListener('click', () => this.verifyUserId());
        }

        // Enter key in user ID input
        const userIdInput = document.getElementById('user-id-input');
        if (userIdInput) {
            userIdInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.verifyUserId();
                }
            });
        }
    }

    // Load user ID from URL parameters if present
    loadUserIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const userIdFromUrl = urlParams.get('user_id');
        
        if (userIdFromUrl) {
            const userIdInput = document.getElementById('user-id-input');
            if (userIdInput) {
                userIdInput.value = userIdFromUrl;
                this.userId = userIdFromUrl;
                // Auto-verify if user ID is in URL
                this.verifyUserId();
            }
        }
    }

    // Handle Unlimited tier trial
    async handleUnlimitedTrial() {
        if (!this.paddleInitialized) {
            this.showNotification('Payment system not ready. Please try again in a moment.', 'error');
            return;
        }

        // Get user ID if available
        const userIdInput = document.getElementById('user-id-input');
        const userId = userIdInput?.value.trim() || this.userId || this.generateTempUserId();

        if (!userId) {
            this.showNotification('Please enter your Installation ID first, or we\'ll create a temporary one for you.', 'warning');
            return;
        }

        try {
            // Open Paddle checkout for unlimited trial
            await Paddle.Checkout.open({
                // Replace with your actual product/price IDs from Paddle Dashboard
                items: [
                    {
                        priceId: 'pri_YOUR_UNLIMITED_TRIAL_PRICE_ID', // Unlimited trial price ID
                        quantity: 1
                    }
                ],
                customer: {
                    // Optional: pre-fill customer info if available
                },
                customData: {
                    user_id: userId,
                    plan_type: 'unlimited_trial',
                    source: 'landing_page'
                },
                settings: {
                    displayMode: 'overlay',
                    theme: 'light',
                    allowLogout: false
                },
                // Checkout completion handlers
                success(data) {
                    console.log('Trial started:', data);
                    window.location.href = `?trial_started=true&user_id=${userId}`;
                },
                error(error) {
                    console.error('Trial checkout error:', error);
                }
            });
            
        } catch (error) {
            console.error('Failed to start trial:', error);
            this.showNotification('Failed to start trial. Please try again.', 'error');
        }
    }

    // Handle Premium tier purchase
    async handlePremiumPurchase() {
        if (!this.paddleInitialized) {
            this.showNotification('Payment system not ready. Please try again in a moment.', 'error');
            return;
        }

        // Get user ID if available
        const userIdInput = document.getElementById('user-id-input');
        const userId = userIdInput?.value.trim() || this.userId || this.generateTempUserId();

        if (!userId) {
            this.showNotification('Please enter your Installation ID first, or we\'ll create a temporary one for you.', 'warning');
            return;
        }

        try {
            // Open Paddle checkout
            await Paddle.Checkout.open({
                // Replace with your actual product/price IDs from Paddle Dashboard
                items: [
                    {
                        priceId: 'pri_YOUR_MONTHLY_PRICE_ID', // Monthly subscription price ID
                        quantity: 1
                    }
                ],
                customer: {
                    // Optional: pre-fill customer info if available
                },
                customData: {
                    user_id: userId,
                    plan_type: 'premium_monthly',
                    source: 'landing_page'
                },
                settings: {
                    displayMode: 'overlay',
                    theme: 'light',
                    allowLogout: false
                },
                // Checkout completion handlers
                success(data) {
                    console.log('Checkout completed:', data);
                    window.location.href = `?success=true&user_id=${userId}`;
                },
                error(error) {
                    console.error('Checkout error:', error);
                }
            });
            
        } catch (error) {
            console.error('Failed to open checkout:', error);
            this.showNotification('Failed to open checkout. Please try again.', 'error');
        }
    }

    // Handle Free tier button click
    handleFreeTierClick() {
        // For free tier, redirect to extension download/installation guide
        this.showNotification('Download the extension from Firefox Add-ons store to get started!', 'info');
        
        // In a real implementation, this would redirect to:
        // window.open('https://addons.mozilla.org/firefox/addon/optimo-prompt-ai/', '_blank');
        
        // For now, show installation instructions
        this.showInstallationModal();
    }

    // Verify user ID with backend
    async verifyUserId() {
        const userIdInput = document.getElementById('user-id-input');
        const userId = userIdInput?.value.trim();

        if (!userId) {
            this.showNotification('Please enter your Installation ID', 'warning');
            return;
        }

        // Basic UUID format validation
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(userId)) {
            this.showNotification('Please enter a valid Installation ID format', 'warning');
            return;
        }

        try {
            // In a real implementation, verify with your backend API
            // const response = await fetch(`/api/user-status`, {
            //     headers: { 'X-User-ID': userId }
            // });
            
            // For demo purposes, simulate verification
            this.userId = userId;
            this.showNotification('Installation ID verified! You can now purchase Premium.', 'success');
            
            // Update URL to include user ID
            const newUrl = new URL(window.location);
            newUrl.searchParams.set('user_id', userId);
            window.history.pushState({}, '', newUrl);
            
        } catch (error) {
            console.error('Failed to verify user ID:', error);
            this.showNotification('Failed to verify Installation ID. Please check and try again.', 'error');
        }
    }

    // Generate a temporary user ID for new users
    generateTempUserId() {
        // Generate a simple UUID v4
        return 'temp-' + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // Show notification to user
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;

        // Add styles if not already added
        if (!document.querySelector('#notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 10000;
                    max-width: 400px;
                    padding: 16px;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    animation: slideIn 0.3s ease-out;
                }
                .notification-info { background: #e3f2fd; border-left: 4px solid #2196f3; color: #1976d2; }
                .notification-success { background: #e8f5e8; border-left: 4px solid #4caf50; color: #2e7d32; }
                .notification-warning { background: #fff3e0; border-left: 4px solid #ff9800; color: #f57c00; }
                .notification-error { background: #ffebee; border-left: 4px solid #f44336; color: #c62828; }
                .notification-content {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 12px;
                }
                .notification-close {
                    background: none;
                    border: none;
                    font-size: 18px;
                    cursor: pointer;
                    padding: 0;
                    color: inherit;
                    opacity: 0.7;
                }
                .notification-close:hover { opacity: 1; }
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }

        // Add to page
        document.body.appendChild(notification);

        // Close button handler
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (document.body.contains(notification)) {
                notification.remove();
            }
        }, 5000);
    }

    // Show installation modal for free tier users
    showInstallationModal() {
        const modal = document.createElement('div');
        modal.className = 'installation-modal';
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>🚀 Get Started with Optimo Prompt Ai</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="install-step">
                            <div class="step-number">1</div>
                            <div class="step-content">
                                <h4>Install Firefox Extension</h4>
                                <p>Download from Firefox Add-ons store</p>
                                <button class="download-btn">Download Extension</button>
                            </div>
                        </div>
                        <div class="install-step">
                            <div class="step-number">2</div>
                            <div class="step-content">
                                <h4>Configure Your API Key</h4>
                                <p>Add your OpenAI, Anthropic, or Google API key in extension settings</p>
                            </div>
                        </div>
                        <div class="install-step">
                            <div class="step-number">3</div>
                            <div class="step-content">
                                <h4>Start Optimizing</h4>
                                <p>Visit any AI chat platform and click the ⚡ button</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add modal styles
        if (!document.querySelector('#modal-styles')) {
            const style = document.createElement('style');
            style.id = 'modal-styles';
            style.textContent = `
                .installation-modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 10000; }
                .modal-overlay { background: rgba(0, 0, 0, 0.7); width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; padding: 20px; }
                .modal-content { background: white; border-radius: 16px; max-width: 500px; width: 100%; max-height: 90vh; overflow-y: auto; }
                .modal-header { padding: 24px; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center; }
                .modal-header h3 { margin: 0; font-size: 1.5rem; }
                .modal-close { background: none; border: none; font-size: 24px; cursor: pointer; padding: 0; }
                .modal-body { padding: 24px; }
                .install-step { display: flex; gap: 16px; margin-bottom: 24px; align-items: flex-start; }
                .install-step:last-child { margin-bottom: 0; }
                .step-number { width: 32px; height: 32px; background: linear-gradient(135deg, #ffd700 0%, #ffb347 100%); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; flex-shrink: 0; }
                .step-content h4 { margin: 0 0 8px 0; font-size: 1.1rem; }
                .step-content p { margin: 0 0 12px 0; color: #666; }
                .download-btn { background: linear-gradient(135deg, #ffd700 0%, #ffb347 100%); color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; }
                .download-btn:hover { transform: translateY(-1px); }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(modal);

        // Event handlers
        modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
        modal.querySelector('.modal-overlay').addEventListener('click', (e) => {
            if (e.target === modal.querySelector('.modal-overlay')) {
                modal.remove();
            }
        });
        modal.querySelector('.download-btn').addEventListener('click', () => {
            this.showNotification('Extension download will be available once published to Firefox Add-ons store', 'info');
            modal.remove();
        });

        // Close on Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    // Handle successful payment (called from URL parameter)
    handlePaymentSuccess() {
        const urlParams = new URLSearchParams(window.location.search);
        const success = urlParams.get('success');
        const userId = urlParams.get('user_id');

        if (success === 'true') {
            this.showNotification('🎉 Premium subscription activated! Check your email for confirmation.', 'success');
            
            if (userId) {
                const userIdInput = document.getElementById('user-id-input');
                if (userIdInput) {
                    userIdInput.value = userId;
                }
            }
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const optimo = new OptimoLanding();
    
    // Check for payment success
    optimo.handlePaymentSuccess();
});

// Handle Paddle webhook responses (for testing)
window.paddleCheckoutCompleted = (data) => {
    console.log('Paddle checkout completed:', data);
    // This would typically be handled by your backend webhook
};

window.paddleCheckoutClosed = (data) => {
    console.log('Paddle checkout closed:', data);
};