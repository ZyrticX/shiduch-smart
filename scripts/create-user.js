/**
 * Script to create a user in Supabase Auth
 * Run with: node scripts/create-user.js
 * 
 * Make sure to set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment
 */

import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: Missing environment variables');
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  console.error('\nExample:');
  console.error('export SUPABASE_URL="https://your-project.supabase.co"');
  console.error('export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"');
  process.exit(1);
}

// Create admin client with service role key
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createUser() {
  const email = 'idf_2025@example.com';
  
  // Generate a secure random password
  const password = generateSecurePassword();
  
  console.log('\n🔐 Creating user...');
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}\n`);

  try {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        username: 'idf_2025'
      }
    });

    if (error) {
      // Check if user already exists
      if (error.message.includes('already registered') || error.message.includes('already exists')) {
        console.log('⚠️  User already exists. Updating password...');
        
        // Reset password for existing user
        const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(
          data?.user?.id || '',
          { password: password }
        );
        
        if (resetError) {
          // Try to get user by email first
          const { data: userData } = await supabaseAdmin.auth.admin.listUsers();
          const user = userData?.users?.find(u => u.email === email);
          
          if (user) {
            const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
              user.id,
              { password: password }
            );
            
            if (updateError) {
              console.error('❌ Error updating password:', updateError.message);
              process.exit(1);
            } else {
              console.log('✅ Password updated successfully!');
              console.log(`\n📧 Email: ${email}`);
              console.log(`🔑 Password: ${password}\n`);
              process.exit(0);
            }
          } else {
            console.error('❌ Could not find user to update');
            process.exit(1);
          }
        } else {
          console.log('✅ Password updated successfully!');
          console.log(`\n📧 Email: ${email}`);
          console.log(`🔑 Password: ${password}\n`);
          process.exit(0);
        }
      } else {
        console.error('❌ Error creating user:', error.message);
        process.exit(1);
      }
    } else {
      console.log('✅ User created successfully!');
      console.log(`\n📧 Email: ${email}`);
      console.log(`🔑 Password: ${password}`);
      console.log(`\n💡 Save these credentials securely!\n`);
      process.exit(0);
    }
  } catch (err) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
}

function generateSecurePassword() {
  // Generate a secure password with mix of letters, numbers, and symbols
  const length = 16;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  
  // Ensure at least one of each type
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
  password += '0123456789'[Math.floor(Math.random() * 10)];
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)];
  
  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

createUser();

