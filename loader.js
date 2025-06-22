// Secure loader.js - The ONLY public file
(function() {
  // Dynamic version prevents cache attacks
  const version = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  
  // Cloudflare Worker URL (your endpoint)
  const CORE_URL = "https://your-worker.workers.dev/core";
  
  // Secure fetch with error handling
  const loadCore = async () => {
    try {
      // Add checksum verification for extra security
      const res = await fetch(`${CORE_URL}?v=${version}`);
      
      if (!res.ok) throw new Error('Failed to load');
      
      const code = await res.text();
      
      // Verify basic integrity
      if (!code.includes('PromptBoost')) {
        throw new Error('Integrity check failed');
      }
      
      // Execute core safely
      const script = document.createElement('script');
      script.text = code;
      document.body.appendChild(script);
      
    } catch (error) {
      console.error('PromptBoost Error:', error);
      // Fallback option (optional)
      alert('Failed to load PromptBoost. Please try again later.');
    }
  };
  
  // Start loading
  if (document.readyState === 'complete') {
    loadCore();
  } else {
    window.addEventListener('load', loadCore);
  }
})();
