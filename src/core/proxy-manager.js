const axios = require('axios');
const crypto = require('crypto');

/**
 * Kelas untuk mengelola dan merotasi proxy
 */
class ProxyManager {
  constructor(dbManager) {
    this.dbManager = dbManager;
    this.proxies = [];
    this.lastTestTime = {};
    this.testInterval = 3600000; // Test proxy setiap 1 jam
    
    // Inisialisasi proxy dari database
    this.init();
  }
  
  async init() {
    try {
      await this.loadProxies();
    } catch (error) {
      console.error('Error initializing ProxyManager:', error);
    }
  }
  
  /**
   * Muat daftar proxy dari database
   */
  async loadProxies() {
    try {
      this.proxies = await this.dbManager.findAll('proxies');
      return this.proxies;
    } catch (error) {
      console.error('Error loading proxies:', error);
      return [];
    }
  }
  
  /**
   * Tambahkan proxy baru ke sistem
   */
  async addProxy(proxyData) {
    try {
      // Validasi format proxy
      if (!this.validateProxyFormat(proxyData.address)) {
        throw new Error('Format proxy tidak valid. Harap gunakan format ip:port');
      }
      
      // Cek apakah proxy sudah ada
      const existingProxy = this.proxies.find(p => p.address === proxyData.address);
      if (existingProxy) {
        throw new Error('Proxy dengan alamat ini sudah ada dalam sistem');
      }
      
      // Encrypt password jika disediakan
      let encryptedPassword = null;
      if (proxyData.password) {
        encryptedPassword = this.encryptPassword(proxyData.password);
      }
      
      // Test koneksi terlebih dahulu
      const proxyStatus = await this.testProxy(proxyData);
      
      // Persiapkan objek proxy untuk disimpan
      const newProxy = {
        address: proxyData.address,
        username: proxyData.username || null,
        password: encryptedPassword,
        type: 'http', // Default ke HTTP
        status: proxyStatus.success ? 'active' : 'error',
        lastTest: new Date().toISOString(),
        lastUsed: null,
        useCount: 0,
        createdAt: new Date().toISOString()
      };
      
      // Simpan proxy ke database
      const result = await this.dbManager.insert('proxies', newProxy);
      
      // Reload proxies
      await this.loadProxies();
      
      return result;
    } catch (error) {
      console.error('Error adding proxy:', error);
      throw error;
    }
  }
  
  /**
   * Dapatkan daftar semua proxy
   */
  async getAllProxies() {
    return this.proxies.map(proxy => ({
      id: proxy._id,
      address: proxy.address,
      username: proxy.username,
      status: proxy.status,
      lastTest: proxy.lastTest,
      useCount: proxy.useCount
    }));
  }
  
  /**
   * Dapatkan proxy acak yang aktif
   */
  async getRandomProxy() {
    try {
      // Filter hanya proxy yang aktif
      const activeProxies = this.proxies.filter(p => p.status === 'active');
      
      if (activeProxies.length === 0) {
        return null;
      }
      
      // Pilih proxy secara acak
      const randomIndex = Math.floor(Math.random() * activeProxies.length);
      const selectedProxy = { ...activeProxies[randomIndex] };
      
      // Dekripsi password jika ada
      if (selectedProxy.password) {
        selectedProxy.password = this.decryptPassword(selectedProxy.password);
      }
      
      // Update statistik penggunaan
      await this.updateProxyUsage(selectedProxy._id);
      
      return {
        address: selectedProxy.address,
        username: selectedProxy.username,
        password: selectedProxy.password
      };
    } catch (error) {
      console.error('Error getting random proxy:', error);
      return null;
    }
  }
  
  /**
   * Update statistik penggunaan proxy
   */
  async updateProxyUsage(proxyId) {
    try {
      // Dapatkan proxy yang akan diupdate
      const proxy = this.proxies.find(p => p._id === proxyId);
      if (!proxy) return;
      
      // Update count dan timestamp
      const updateData = {
        lastUsed: new Date().toISOString(),
        useCount: (proxy.useCount || 0) + 1
      };
      
      await this.dbManager.update('proxies', proxyId, updateData);
    } catch (error) {
      console.error(`Error updating proxy usage: ${error.message}`);
    }
  }
  
  /**
   * Test proxy untuk memastikan berfungsi
   */
  async testProxy(proxyData) {
    try {
      const proxyAddress = proxyData.address;
      
      // Skip test jika sudah ditest baru-baru ini
      const now = Date.now();
      if (this.lastTestTime[proxyAddress] && 
          now - this.lastTestTime[proxyAddress] < this.testInterval) {
        return { success: true, message: 'Proxy sudah ditest baru-baru ini' };
      }
      
      // Persiapkan konfigurasi proxy untuk axios
      const [host, port] = proxyAddress.split(':');
      
      const axiosConfig = {
        proxy: {
          host,
          port: parseInt(port),
          protocol: 'http'
        },
        timeout: 10000 // 10 detik timeout
      };
      
      // Tambahkan auth jika username/password disediakan
      if (proxyData.username && proxyData.password) {
        axiosConfig.proxy.auth = {
          username: proxyData.username,
          password: proxyData.password
        };
      }
      
      // Test dengan mengakses google
      await axios.get('https://www.google.com', axiosConfig);
      
      // Update waktu test terakhir
      this.lastTestTime[proxyAddress] = now;
      
      return { success: true, message: 'Proxy berfungsi dengan baik' };
    } catch (error) {
      console.error(`Proxy test failed: ${error.message}`);
      return { 
        success: false, 
        message: `Proxy test gagal: ${error.message}` 
      };
    }
  }
  
  /**
   * Test semua proxy dan update status
   */
  async testAllProxies() {
    try {
      for (const proxy of this.proxies) {
        const testResult = await this.testProxy({
          address: proxy.address,
          username: proxy.username,
          password: proxy.password ? this.decryptPassword(proxy.password) : null
        });
        
        // Update status proxy
        await this.dbManager.update('proxies', proxy._id, {
          status: testResult.success ? 'active' : 'error',
          lastTest: new Date().toISOString()
        });
      }
      
      // Reload proxies
      await this.loadProxies();
      
      return { success: true, message: 'Semua proxy telah ditest' };
    } catch (error) {
      console.error('Error testing all proxies:', error);
      throw error;
    }
  }
  
  /**
   * Hapus proxy dari sistem
   */
  async deleteProxy(proxyId) {
    try {
      await this.dbManager.remove('proxies', proxyId);
      
      // Reload proxies
      await this.loadProxies();
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting proxy:', error);
      throw error;
    }
  }
  
  /**
   * Validasi format alamat proxy
   */
  validateProxyFormat(address) {
    // Format proxy yang valid: ip:port
    const regex = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d{1,5})$/;
    return regex.test(address);
  }
  
  /**
   * Enkripsi password untuk disimpan dengan aman
   */
  encryptPassword(password) {
    const encryptionKey = process.env.ENCRYPTION_KEY || 'airdrop-manager-secret-key';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(encryptionKey), iv);
    let encrypted = cipher.update(password);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }
  
  /**
   * Dekripsi password untuk penggunaan
   */
  decryptPassword(encryptedPassword) {
    const encryptionKey = process.env.ENCRYPTION_KEY || 'airdrop-manager-secret-key';
    const textParts = encryptedPassword.split(':');
    const iv = Buffer.from(textParts[0], 'hex');
    const encryptedText = Buffer.from(textParts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(encryptionKey), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  }
}

module.exports = ProxyManager;