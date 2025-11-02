// Script to check environment variables in Vercel build
// This will run during build time and show what env vars are available

console.log('=== Environment Variables Check ===');
console.log('Build time environment check:');

const envVars = {
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || 'NOT SET',
  VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY ? 'SET (hidden)' : 'NOT SET',
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ? 'SET (hidden)' : 'NOT SET',
};

console.log(JSON.stringify(envVars, null, 2));

// Check all VITE_ and NEXT_PUBLIC_ vars
const allViteVars = Object.keys(process.env).filter(k => k.startsWith('VITE_') || k.startsWith('NEXT_PUBLIC_'));
console.log('\nAll VITE_ and NEXT_PUBLIC_ variables found:');
allViteVars.forEach(key => {
  const value = process.env[key];
  console.log(`${key}: ${value && value.length > 20 ? value.substring(0, 20) + '...' : value || 'NOT SET'}`);
});

console.log('\n=== End Environment Check ===');

