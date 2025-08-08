// Database operations for Optimo Prompt Ai

export async function initializeDatabase(db) {
  // Create users table with unlimited trial support
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      llm_api_key_encrypted TEXT,
      subscription_status TEXT NOT NULL DEFAULT 'freemium',
      paddle_subscription_id TEXT,
      paddle_customer_id TEXT,
      unlimited_trial_ends_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // Create user_api_keys table for multi-LLM support
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS user_api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      encrypted_api_key TEXT NOT NULL,
      custom_endpoint TEXT,
      model_name TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (user_id)
    )
  `).run();

  // Create optimization_history table
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS optimization_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      original_prompt TEXT NOT NULL,
      optimized_prompt TEXT NOT NULL,
      options_used TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (user_id)
    )
  `).run();

  // Create prompt_templates table for unlimited tier
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS prompt_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      template_name TEXT NOT NULL,
      template_content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (user_id)
    )
  `).run();

  // Create indexes
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_paddle_subscription_id ON users (paddle_subscription_id)
  `).run();
  
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_paddle_customer_id ON users (paddle_customer_id)
  `).run();

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON user_api_keys (user_id)
  `).run();

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_optimization_history_user_id ON optimization_history (user_id)
  `).run();

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_prompt_templates_user_id ON prompt_templates (user_id)
  `).run();
}

export async function getUserStatus(db, userId) {
  const user = await db.prepare(`
    SELECT user_id, subscription_status, unlimited_trial_ends_at, paddle_subscription_id, paddle_customer_id
    FROM users 
    WHERE user_id = ?
  `).bind(userId).first();

  return user;
}

export async function updateUserSubscription(db, userId, subscriptionStatus, paddleSubscriptionId = null, paddleCustomerId = null, trialEndsAt = null) {
  await db.prepare(`
    INSERT INTO users (user_id, subscription_status, paddle_subscription_id, paddle_customer_id, unlimited_trial_ends_at, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      subscription_status = excluded.subscription_status,
      paddle_subscription_id = excluded.paddle_subscription_id,
      paddle_customer_id = excluded.paddle_customer_id,
      unlimited_trial_ends_at = excluded.unlimited_trial_ends_at,
      updated_at = CURRENT_TIMESTAMP
  `).bind(userId, subscriptionStatus, paddleSubscriptionId, paddleCustomerId, trialEndsAt).run();
}

export async function saveUserApiKey(db, userId, provider, encryptedApiKey, customEndpoint = null, modelName = null) {
  // Deactivate previous keys for this user and provider
  await db.prepare(`
    UPDATE user_api_keys 
    SET is_active = 0 
    WHERE user_id = ? AND provider = ?
  `).bind(userId, provider).run();

  // Insert new key
  await db.prepare(`
    INSERT INTO user_api_keys (user_id, provider, encrypted_api_key, custom_endpoint, model_name, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
  `).bind(userId, provider, encryptedApiKey, customEndpoint, modelName).run();
}

export async function getUserApiKeys(db, userId) {
  const keys = await db.prepare(`
    SELECT provider, custom_endpoint, model_name, created_at
    FROM user_api_keys 
    WHERE user_id = ? AND is_active = 1
    ORDER BY created_at DESC
  `).bind(userId).all();

  return keys.results || [];
}

export async function getOptimizationHistory(db, userId, limit = 100) {
  const history = await db.prepare(`
    SELECT original_prompt, optimized_prompt, options_used, created_at
    FROM optimization_history 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `).bind(userId, limit).all();

  return history.results || [];
}

export async function savePromptTemplate(db, userId, templateName, templateContent) {
  await db.prepare(`
    INSERT INTO prompt_templates (user_id, template_name, template_content)
    VALUES (?, ?, ?)
  `).bind(userId, templateName, templateContent).run();
}

export async function getUserPromptTemplates(db, userId) {
  const templates = await db.prepare(`
    SELECT id, template_name, template_content, created_at
    FROM prompt_templates 
    WHERE user_id = ? 
    ORDER BY created_at DESC
  `).bind(userId).all();

  return templates.results || [];
}

export async function deletePromptTemplate(db, userId, templateId) {
  await db.prepare(`
    DELETE FROM prompt_templates 
    WHERE id = ? AND user_id = ?
  `).bind(templateId, userId).run();
}

export async function updatePromptTemplate(db, userId, templateId, templateName, templateContent) {
  await db.prepare(`
    UPDATE prompt_templates 
    SET template_name = ?, template_content = ?
    WHERE id = ? AND user_id = ?
  `).bind(templateName, templateContent, templateId, userId).run();
}