/**
 * Secrets Loader — Optional, Inactive by Default
 *
 * This module provides a way to load API keys from environment variables
 * instead of hardcoding them. It is NOT used by default — the dashboard
 * works as-is without this file.
 *
 * HOW TO USE (when you're ready to transition):
 *
 * 1. Create .env.local from .env.local.example:
 *    cp .env.local.example .env.local
 *
 * 2. Fill in your actual values in .env.local
 *
 * 3. Use a bundler (Vite, Parcel, Webpack) that loads .env files, OR
 *    set environment variables before serving:
 *    SUPABASE_URL=https://... SUPABASE_ANON_KEY=eyJ... node serve.js
 *
 * 4. Import this module in your code:
 *    const { SUPABASE_URL, SUPABASE_ANON_KEY } = loadSecrets();
 *
 * CURRENT STATUS: Inactive (not imported anywhere by default)
 * The dashboard continues to use its existing configuration.
 */

/**
 * Load secrets from environment variables with fallbacks.
 * Returns an object with all configuration values.
 *
 * @returns {Object} Configuration object with API keys and settings
 */
function loadSecrets() {
  // Check if we're in a Node.js environment with process.env
  const env = (typeof process !== "undefined" && process.env) ? process.env : {};

  return {
    // ── Supabase ──────────────────────────────────────────────────────────────
    // The anon key is safe to expose in client code (limited by RLS)
    SUPABASE_URL: env.SUPABASE_URL || null,
    SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY || null,

    // ── Nedbank API (when approved) ───────────────────────────────────────────
    // These should ONLY be used in Edge Functions, never in browser code
    NEDBANK_CLIENT_ID: env.NEDBANK_CLIENT_ID || null,
    NEDBANK_CLIENT_SECRET: env.NEDBANK_CLIENT_SECRET || null,
    NEDBANK_WEBHOOK_SECRET: env.NEDBANK_WEBHOOK_SECRET || null,

    // ── Stitch Integration ────────────────────────────────────────────────────
    STITCH_CLIENT_ID: env.STITCH_CLIENT_ID || null,
    STITCH_CLIENT_SECRET: env.STITCH_CLIENT_SECRET || null,

    // ── Shopify ───────────────────────────────────────────────────────────────
    SHOPIFY_API_KEY: env.SHOPIFY_API_KEY || null,
    SHOPIFY_WEBHOOK_SECRET: env.SHOPIFY_WEBHOOK_SECRET || null,

    // ── Stripe ────────────────────────────────────────────────────────────────
    // Publishable key is safe for browser code, secret key is NOT
    STRIPE_PUBLISHABLE_KEY: env.STRIPE_PUBLISHABLE_KEY || null,
    STRIPE_WEBHOOK_SECRET: env.STRIPE_WEBHOOK_SECRET || null,

    // ── Email Notifications ───────────────────────────────────────────────────
    RESEND_API_KEY: env.RESEND_API_KEY || null,
    NOTIFICATION_FROM_EMAIL: env.NOTIFICATION_FROM_EMAIL || "noreply@masemula.co.za",

    // ── Application Settings ──────────────────────────────────────────────────
    NODE_ENV: env.NODE_ENV || "development",
    APP_URL: env.APP_URL || "http://localhost:3000",
  };
}

/**
 * Validate that required secrets are present.
 * Throws an error if any required secret is missing.
 *
 * @param {string[]} required - Array of required secret names
 * @returns {Object} Validated secrets object
 */
function requireSecrets(required = []) {
  const secrets = loadSecrets();
  const missing = required.filter((key) => !secrets[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required configuration: ${missing.join(", ")}\n` +
      `Copy .env.local.example to .env.local and fill in the values.`
    );
  }

  return secrets;
}

// Export for use in Node.js/bundler environments
if (typeof module !== "undefined" && module.exports) {
  module.exports = { loadSecrets, requireSecrets };
}

// Export for ES modules
if (typeof exports !== "undefined") {
  exports.loadSecrets = loadSecrets;
  exports.requireSecrets = requireSecrets;
}
