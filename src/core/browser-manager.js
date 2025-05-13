const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { randomUserAgent } = require('../utils/fingerprint-tools');
const proxyChain = require('proxy-chain');
const path = require('path');
const fs = require('fs');

// Register stealth plugin
puppeteer.use(StealthPlugin());

/**
 * Kelas untuk mengelola browser dan sesi browsing
 */
class BrowserManager {
  constructor(proxyManager) {
    this.proxyManager = proxyManager;
    this.browsers = new Map(); // Menyimpan semua instance browser yang berjalan
    this.activeSessions = new Map(); // Menyimpan semua sesi aktif
    this.config = {
      maxConcurrent: 5,
      browserMemory: 512,
      defaultViewport: { width: 1366, height: 768 },
      headless: 'new' // Menggunakan Headless mode baru Chromium
    };
    
    // Directory untuk menyimpan data profil browser
    this.profilesDir = path.join(process.cwd(), 'browser_profiles');
    
    // Pastikan directory profiles ada
    if (!fs.existsSync(this.profilesDir)) {
      fs.mkdirSync(this.profilesDir, { recursive: true });
    }
  }
  
  /**
   * Perbarui konfigurasi browser
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }
  
  /**
   * Buat instance browser baru dengan Puppeteer
   */
  async createBrowser(sessionId, useProxy = true, options = {}) {
    try {
      if (this.browsers.size >= this.config.maxConcurrent) {
        throw new Error(`Maksimum ${this.config.maxConcurrent} browser sudah berjalan. Tutup beberapa untuk melanjutkan.`);
      }
      
      // Setup profile directory untuk browser ini
      const profileDir = path.join(this.profilesDir, sessionId);
      if (!fs.existsSync(profileDir)) {
        fs.mkdirSync(profileDir, { recursive: true });
      }
      
      // Setup proxy jika diminta
      let proxyServer = null;
      if (useProxy) {
        const proxy = await this.proxyManager.getRandomProxy();
        if (!proxy) {
          console.warn('Tidak ada proxy tersedia, menggunakan koneksi langsung');
        } else {
          // Format proxy untuk Puppeteer
          let proxyUrl;
          if (proxy.username && proxy.password) {
            proxyUrl = `http://${proxy.username}:${proxy.password}@${proxy.address}`;
          } else {
            proxyUrl = `http://${proxy.address}`;
          }
          
          // Gunakan proxy-chain untuk menangani autentikasi
          proxyServer = await proxyChain.anonymizeProxy(proxyUrl);
        }
      }
      
      // Setup argumen browser
      const args = [
        `--disable-extensions`,
        `--disable-dev-shm-usage`,
        `--no-sandbox`,
        `--disable-setuid-sandbox`,
        `--no-first-run`,
        `--no-zygote`,
        `--deterministic-fetch`,
        `--disable-features=IsolateOrigins,site-per-process`,
        `--user-agent=${randomUserAgent()}`,
      ];
      
      // Tambahkan memory limit jika diset
      if (this.config.browserMemory > 0) {
        args.push(`--js-flags=--max-old-space-size=${this.config.browserMemory}`);
      }
      
      // Tambahkan proxy jika ada
      if (proxyServer) {
        args.push(`--proxy-server=${proxyServer}`);
      }
      
      // Gabungkan dengan opsi tambahan
      const browserOptions = {
        headless: this.config.headless,
        args,
        userDataDir: profileDir,
        defaultViewport: this.config.defaultViewport,
        ignoreHTTPSErrors: true,
        ...options
      };
      
      // Launch browser
      const browser = await puppeteer.launch(browserOptions);
      
      // Simpan informasi browser dan proxy
      this.browsers.set(sessionId, {
        browser,
        proxyServer,
        startTime: new Date(),
        profileDir
      });
      
      // Setup event ketika browser ditutup
      browser.on('disconnected', () => {
        this.cleanupSession(sessionId);
      });
      
      return browser;
    } catch (error) {
      console.error(`Error saat membuat browser: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Dapatkan browser yang sudah ada atau buat yang baru jika belum ada
   */
  async getBrowser(sessionId, useProxy = true, options = {}) {
    if (this.browsers.has(sessionId)) {
      return this.browsers.get(sessionId).browser;
    }
    
    return this.createBrowser(sessionId, useProxy, options);
  }
  
  /**
   * Buat halaman baru dengan konfigurasi yang sesuai
   */
  async createPage(sessionId, useProxy = true, options = {}) {
    try {
      const browser = await this.getBrowser(sessionId, useProxy, options);
      const page = await browser.newPage();
      
      // Setup pengaturan halaman
      await page.setDefaultNavigationTimeout(60000); // 60 detik timeout
      await page.setRequestInterception(true);
      
      // Listener untuk intercept request
      page.on('request', (request) => {
        // Block resource yang tidak diperlukan untuk meningkatkan kinerja
        const resourceType = request.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          request.abort();
        } else {
          request.continue();
        }
      });
      
      // Simpan page dalam active sessions
      if (!this.activeSessions.has(sessionId)) {
        this.activeSessions.set(sessionId, []);
      }
      this.activeSessions.get(sessionId).push(page);
      
      return page;
    } catch (error) {
      console.error(`Error saat membuat halaman: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Tutup sesi dan browser tertentu
   */
  async closeSession(sessionId) {
    try {
      if (this.browsers.has(sessionId)) {
        const { browser, proxyServer } = this.browsers.get(sessionId);
        
        // Tutup browser
        if (browser && browser.isConnected()) {
          await browser.close();
        }
        
        // Bersihkan proxy server jika ada
        if (proxyServer) {
          await proxyChain.closeAnonymizedProxy(proxyServer);
        }
        
        this.cleanupSession(sessionId);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Error saat menutup sesi: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Bersihkan resource sesi
   */
  cleanupSession(sessionId) {
    if (this.browsers.has(sessionId)) {
      this.browsers.delete(sessionId);
    }
    
    if (this.activeSessions.has(sessionId)) {
      this.activeSessions.delete(sessionId);
    }
  }
  
  /**
   * Tutup semua browser yang berjalan
   */
  async closeAllBrowsers() {
    try {
      const sessionIds = [...this.browsers.keys()];
      
      for (const sessionId of sessionIds) {
        await this.closeSession(sessionId);
      }
      
      this.browsers.clear();
      this.activeSessions.clear();
      
      return true;
    } catch (error) {
      console.error(`Error saat menutup semua browser: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Dapatkan jumlah browser yang aktif
   */
  getActiveBrowsersCount() {
    return this.browsers.size;
  }
  
  /**
   * Cek apakah masih bisa menambah browser baru
   */
  canAddMoreBrowsers() {
    return this.browsers.size < this.config.maxConcurrent;
  }
  
  /**
   * Setup browser spesifik untuk airdrop tertentu
   */
  async setupAirdropBrowser(accountId, projectUrl, options = {}) {
    const sessionId = `account_${accountId}_${Date.now()}`;
    
    try {
      const page = await this.createPage(sessionId, true, options);
      
      // Navigate to the project URL
      await page.goto(projectUrl, { waitUntil: 'networkidle2' });
      
      return {
        sessionId,
        page
      };
    } catch (error) {
      // Pastikan untuk membersihkan jika terjadi error
      await this.closeSession(sessionId);
      throw error;
    }
  }
}

module.exports = BrowserManager;