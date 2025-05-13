const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

/**
 * Kelas untuk mengelola akun-akun yang digunakan dalam sistem
 */
class AccountManager {
  constructor(dbManager) {
    this.dbManager = dbManager;
    this.loadedAccounts = [];
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'airdrop-manager-secret-key';
    
    // Load accounts on initialization
    this.init();
  }
  
  async init() {
    try {
      await this.loadAccounts();
    } catch (error) {
      console.error('Error initializing AccountManager:', error);
    }
  }
  
  /**
   * Muat semua akun dari database
   */
  async loadAccounts() {
    try {
      this.loadedAccounts = await this.dbManager.findAll('accounts');
      return this.loadedAccounts;
    } catch (error) {
      console.error('Error loading accounts:', error);
      return [];
    }
  }
  
  /**
   * Dapatkan semua akun yang telah dimuat
   */
  async getAllAccounts() {
    return this.loadedAccounts.map(account => ({
      id: account._id,
      email: account.email,
      notes: account.notes,
      status: account.status || 'idle'
    }));
  }
  
  /**
   * Dapatkan akun berdasarkan ID
   */
  async getAccountById(id) {
    return this.loadedAccounts.find(account => account._id === id);
  }
  
  /**
   * Mengambil beberapa akun secara acak untuk digunakan dalam task
   */
  async getRandomAccounts(count) {
    // Pilih akun yang sedang tidak digunakan (idle)
    const availableAccounts = this.loadedAccounts.filter(acc => acc.status === 'idle' || !acc.status);
    
    if (availableAccounts.length < count) {
      throw new Error(`Hanya ada ${availableAccounts.length} akun yang tersedia dari ${count} yang diminta`);
    }
    
    // Acak urutan untuk memastikan kita tidak selalu mengambil akun yang sama
    const shuffled = [...availableAccounts].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }
  
  /**
   * Simpan akun baru atau update akun yang ada
   */
  async saveAccount(accountData) {
    try {
      // Jika ID ada, update akun yang sudah ada
      if (accountData.id) {
        const updatedAccount = {
          email: accountData.email,
          notes: accountData.notes
        };
        
        // Hanya update password jika ada nilai baru
        if (accountData.password) {
          updatedAccount.password = this.encryptPassword(accountData.password);
        }
        
        const result = await this.dbManager.update('accounts', accountData.id, updatedAccount);
        await this.loadAccounts(); // Reload accounts
        return result;
      } 
      // Jika tidak ada ID, buat akun baru
      else {
        if (!accountData.password) {
          throw new Error('Password diperlukan untuk akun baru');
        }
        
        const newAccount = {
          email: accountData.email,
          password: this.encryptPassword(accountData.password),
          notes: accountData.notes,
          status: 'idle',
          createdAt: new Date().toISOString()
        };
        
        const result = await this.dbManager.insert('accounts', newAccount);
        await this.loadAccounts(); // Reload accounts
        return result;
      }
    } catch (error) {
      console.error('Error saving account:', error);
      throw error;
    }
  }
  
  /**
   * Hapus akun berdasarkan ID
   */
  async deleteAccount(id) {
    try {
      await this.dbManager.remove('accounts', id);
      await this.loadAccounts(); // Reload accounts
      return { success: true };
    } catch (error) {
      console.error('Error deleting account:', error);
      throw error;
    }
  }
  
  /**
   * Update status akun
   */
  async updateAccountStatus(id, status) {
    try {
      await this.dbManager.update('accounts', id, { status });
      await this.loadAccounts(); // Reload accounts
      return { success: true };
    } catch (error) {
      console.error('Error updating account status:', error);
      throw error;
    }
  }
  
  /**
   * Enkripsi password untuk penyimpanan yang aman
   */
  encryptPassword(password) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(this.encryptionKey), iv);
    let encrypted = cipher.update(password);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }
  
  /**
   * Dekripsi password untuk penggunaan
   */
  decryptPassword(encryptedPassword) {
    const textParts = encryptedPassword.split(':');
    const iv = Buffer.from(textParts[0], 'hex');
    const encryptedText = Buffer.from(textParts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(this.encryptionKey), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  }
  
  /**
   * Import akun dari file CSV
   */
  async importFromCsv(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      
      // Skip header row if exists
      const startIndex = lines[0].toLowerCase().includes('email') ? 1 : 0;
      
      const accounts = [];
      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const [email, password, ...notesParts] = line.split(',');
        const notes = notesParts.join(',');
        
        if (email && password) {
          accounts.push({
            email: email.trim(),
            password: password.trim(),
            notes: notes ? notes.trim() : '',
            status: 'idle',
            createdAt: new Date().toISOString()
          });
        }
      }
      
      // Simpan akun-akun ke database
      if (accounts.length > 0) {
        for (const account of accounts) {
          account.password = this.encryptPassword(account.password);
          await this.dbManager.insert('accounts', account);
        }
        await this.loadAccounts(); // Reload accounts
      }
      
      return { success: true, count: accounts.length };
    } catch (error) {
      console.error('Error importing accounts from CSV:', error);
      throw error;
    }
  }
}

module.exports = AccountManager;