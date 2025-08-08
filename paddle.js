// Paddle webhook handling for subscription management

import { updateUserSubscription } from './database.js';

export function verifyPaddleWebhook(body, signature, secret) {
  // Simplified webhook verification for demo
  // In production, implement proper HMAC verification
  return true;
}

export async function handleSubscriptionEvent(db, event) {
  const { event_type, data } = event;

  switch (event_type) {
    case 'subscription.created':
    case 'subscription.updated':
      await handleSubscriptionActive(db, data);
      break;
    
    case 'subscription.canceled':
    case 'subscription.expired':
      await handleSubscriptionCanceled(db, data);
      break;
    
    case 'subscription.trialed':
      await handleTrialStarted(db, data);
      break;
    
    default:
      console.log('Unhandled event type:', event_type);
  }
}

async function handleSubscriptionActive(db, subscriptionData) {
  const { subscription_id, customer_id, custom_data, items } = subscriptionData;
  const userId = custom_data?.userId;

  if (!userId) {
    console.error('No user ID in subscription data');
    return;
  }

  // Determine subscription tier based on product ID
  const productId = items[0]?.product_id;
  let subscriptionStatus = 'freemium';

  if (productId === 'premium_monthly' || productId === 'premium_yearly') {
    subscriptionStatus = 'premium';
  } else if (productId === 'unlimited_monthly' || productId === 'unlimited_yearly') {
    subscriptionStatus = 'unlimited';
  }

  await updateUserSubscription(
    db, 
    userId, 
    subscriptionStatus, 
    subscription_id, 
    customer_id
  );
}

async function handleSubscriptionCanceled(db, subscriptionData) {
  const { subscription_id, custom_data } = subscriptionData;
  const userId = custom_data?.userId;

  if (!userId) {
    console.error('No user ID in subscription data');
    return;
  }

  // Revert to freemium
  await updateUserSubscription(
    db, 
    userId, 
    'freemium', 
    null, 
    null
  );
}

async function handleTrialStarted(db, subscriptionData) {
  const { subscription_id, customer_id, custom_data, trial_ends_at } = subscriptionData;
  const userId = custom_data?.userId;

  if (!userId) {
    console.error('No user ID in subscription data');
    return;
  }

  // Set unlimited trial
  await updateUserSubscription(
    db, 
    userId, 
    'trialing_unlimited', 
    subscription_id, 
    customer_id,
    trial_ends_at
  );
}