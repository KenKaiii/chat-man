/**
 * First-Run Encryption Setup Wizard
 * Guides users through secure encryption configuration
 * Copyright (C) 2025 KenKai
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { getKeyManager } from './keyManager';
import * as readline from 'readline';
import { writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Interactive CLI setup wizard for encryption
 */
export class EncryptionSetupWizard {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  /**
   * Prompt user for input (async)
   */
  private question(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(prompt, (answer) => {
        resolve(answer);
      });
    });
  }

  /**
   * Prompt for password (hide input)
   */
  private async questionHidden(prompt: string): Promise<string> {
    process.stdout.write(prompt);

    return new Promise((resolve) => {
      const stdin = process.stdin;

      // Check if stdin is a TTY and setRawMode is available
      if (stdin.isTTY && typeof stdin.setRawMode === 'function') {
        // Use raw mode for hidden input (shows asterisks)
        stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding('utf8');

        let password = '';

        const onData = (char: string) => {
          switch (char) {
            case '\n':
            case '\r':
            case '\u0004': // Ctrl+D
              stdin.setRawMode(false);
              stdin.pause();
              stdin.removeListener('data', onData);
              process.stdout.write('\n');
              resolve(password);
              break;
            case '\u0003': // Ctrl+C
              stdin.setRawMode(false);
              stdin.pause();
              process.exit(0);
              break;
            case '\u007f': // Backspace
              if (password.length > 0) {
                password = password.slice(0, -1);
                process.stdout.write('\b \b');
              }
              break;
            default:
              password += char;
              process.stdout.write('*');
              break;
          }
        };

        stdin.on('data', onData);
      } else {
        // Fallback to readline (visible input)
        console.warn('\n⚠️  Warning: Password input will be VISIBLE (not running in TTY mode)');
        this.rl.question('', (answer) => {
          resolve(answer);
        });
      }
    });
  }

  /**
   * Save password to .env file automatically for convenience
   */
  private savePasswordToEnv(password: string): void {
    const envPath = join(process.cwd(), '.env');

    try {
      // Create or overwrite .env with password
      writeFileSync(envPath, `# Agent Man Configuration

# Your encryption password (auto-generated on first setup)
# Keep this file secure and never commit it to version control
CHAT_MAN_PASSWORD=${password}
`, { mode: 0o600 }); // Set restrictive permissions (owner read/write only)

      console.log('✅ Password saved to .env file (permissions: 600)');
      console.log('   Future restarts will use this password automatically\n');
    } catch (error) {
      console.log('⚠️  Failed to save .env file:', error instanceof Error ? error.message : 'Unknown');
      console.log('   You may need to manually create .env with: CHAT_MAN_PASSWORD=your-password\n');
    }
  }

  /**
   * Run the setup wizard
   */
  async run(): Promise<void> {
    console.log('\n=================================');
    console.log('  ENCRYPTION SETUP WIZARD');
    console.log('=================================\n');

    console.log('Chat Man uses AES-256-GCM encryption to protect your data.');
    console.log('This ensures GDPR and HIPAA compliance for sensitive information.\n');

    console.log('⚠️  IMPORTANT SECURITY NOTICE:');
    console.log('   - Your password encrypts ALL data in the database');
    console.log('   - If you forget your password, data CANNOT be recovered');
    console.log('   - Write down your password in a secure location');
    console.log('   - Use a password manager for best security\n');

    // Check if already setup
    const keyManager = getKeyManager();
    if (keyManager.isSetup()) {
      console.log('✅ Encryption is already configured.\n');
      const password = await this.questionHidden('Enter your password to unlock: ');
      const success = await keyManager.unlockWithPassword(password);

      if (success) {
        console.log('✅ Encryption unlocked successfully!\n');

        // Automatically save password to .env for seamless future restarts
        this.savePasswordToEnv(password);
      } else {
        console.log('❌ Incorrect password. Cannot proceed.\n');
        process.exit(1);
      }

      this.rl.close();
      return;
    }

    console.log('📋 Password Requirements:');
    console.log('   - At least 12 characters long');
    console.log('   - At least one uppercase letter (A-Z)');
    console.log('   - At least one lowercase letter (a-z)');
    console.log('   - At least one number (0-9)');
    console.log('   - At least one special character (!@#$%^&*...)\n');

    let passwordValid = false;
    let password = '';

    while (!passwordValid) {
      password = await this.questionHidden('Enter master password: ');
      const confirmPassword = await this.questionHidden('Confirm master password: ');

      if (password !== confirmPassword) {
        console.log('❌ Passwords do not match. Please try again.\n');
        continue;
      }

      try {
        // KeyManager will validate password strength
        await keyManager.initializeWithPassword(password);
        passwordValid = true;
        console.log('\n✅ Encryption initialized successfully!\n');
      } catch (error) {
        if (error instanceof Error) {
          console.log(`\n❌ ${error.message}\n`);
        }
      }
    }

    // Automatically save password to .env for seamless future restarts
    this.savePasswordToEnv(password);

    console.log('💡 TIP: Backup your password securely');
    console.log('   Consider using a password manager like 1Password, Bitwarden, or KeePass\n');

    console.log('✅ Setup complete! Your data is now protected with AES-256-GCM encryption.\n');

    this.rl.close();
  }

  /**
   * Quick unlock (non-interactive)
   */
  static async quickUnlock(password: string): Promise<boolean> {
    const keyManager = getKeyManager();

    if (!keyManager.isSetup()) {
      throw new Error('Encryption not setup. Run the setup wizard first.');
    }

    return await keyManager.unlockWithPassword(password);
  }

  /**
   * Check if setup is required
   */
  static needsSetup(): boolean {
    const keyManager = getKeyManager();
    return !keyManager.isSetup();
  }
}

/**
 * Run the setup wizard if needed, otherwise prompt for password
 */
export async function ensureEncryptionUnlocked(): Promise<void> {
  const keyManager = getKeyManager();

  // Check for environment variable (for automation/non-interactive mode)
  const envPassword = process.env.CHAT_MAN_PASSWORD;

  if (!keyManager.isSetup()) {
    // First time setup
    if (envPassword) {
      // Non-interactive setup using environment variable
      console.log('\n=================================');
      console.log('  ENCRYPTION SETUP (NON-INTERACTIVE)');
      console.log('=================================\n');
      console.log('🔑 Using password from CHAT_MAN_PASSWORD environment variable...');

      try {
        await keyManager.initializeWithPassword(envPassword);
        console.log('✅ Encryption initialized successfully!\n');
        console.log('⚠️  IMPORTANT: Backup your password securely!');
        console.log('   If you lose your password, data CANNOT be recovered.\n');
        return;
      } catch (error) {
        console.error('❌ Password does not meet security requirements:');
        if (error instanceof Error) {
          console.error(`   ${error.message}`);
        }
        console.error('\nPassword Requirements:');
        console.error('   - At least 12 characters long');
        console.error('   - At least one uppercase letter (A-Z)');
        console.error('   - At least one lowercase letter (a-z)');
        console.error('   - At least one number (0-9)');
        console.error('   - At least one special character (!@#$%^&*...)\n');
        process.exit(1);
      }
    } else {
      // Interactive setup wizard
      const wizard = new EncryptionSetupWizard();
      await wizard.run();
    }
  } else {
    // Prompt for password
    console.log('🔒 Database encryption is enabled');

    if (envPassword) {
      console.log('🔑 Using password from environment variable...');
      const success = await keyManager.unlockWithPassword(envPassword);

      if (!success) {
        console.error('❌ Invalid password in CHAT_MAN_PASSWORD environment variable');
        process.exit(1);
      }

      console.log('✅ Encryption unlocked from environment variable\n');
      return;
    }

    // Interactive password prompt
    const wizard = new EncryptionSetupWizard();
    await wizard.run();
  }
}
