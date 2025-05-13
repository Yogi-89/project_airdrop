/**
 * Kelas untuk menganalisis dan melacak data airdrop
 */
class Analytics {
  constructor(dbManager) {
    this.dbManager = dbManager;
  }
  
  /**
   * Catat points yang diperoleh dari project
   */
  async recordPoints(accountId, projectUrl, points, details = {}) {
    try {
      const timestamp = new Date().toISOString();
      
      const pointEntry = {
        accountId,
        projectUrl,
        points,
        details,
        timestamp
      };
      
      // Simpan ke database
      await this.dbManager.insert('points', pointEntry);
      
      return { success: true };
    } catch (error) {
      console.error('Error recording points:', error);
      throw error;
    }
  }
  
  /**
   * Dapatkan points berdasarkan project
   */
  async getPointsByProject(projectUrl = null) {
    try {
      let query = {};
      if (projectUrl) {
        query = { projectUrl };
      }
      
      const allPoints = await this.dbManager.find('points', query);
      
      // Agregasi points berdasarkan project
      const projectPoints = {};
      
      for (const entry of allPoints) {
        const url = entry.projectUrl;
        
        if (!projectPoints[url]) {
          projectPoints[url] = {
            total: 0,
            accounts: new Set(),
            latestUpdate: null
          };
        }
        
        projectPoints[url].total += entry.points;
        projectPoints[url].accounts.add(entry.accountId);
        
        // Update timestamp terbaru
        const entryTime = new Date(entry.timestamp).getTime();
        const currentLatest = projectPoints[url].latestUpdate 
          ? new Date(projectPoints[url].latestUpdate).getTime() 
          : 0;
          
        if (entryTime > currentLatest) {
          projectPoints[url].latestUpdate = entry.timestamp;
        }
      }
      
      // Format hasil untuk dikembalikan
      const formattedResult = {};
      
      for (const [url, data] of Object.entries(projectPoints)) {
        formattedResult[url] = {
          total: data.total,
          activeAccounts: data.accounts.size,
          latestUpdate: data.latestUpdate
        };
      }
      
      return formattedResult;
    } catch (error) {
      console.error('Error getting points by project:', error);
      throw error;
    }
  }
  
  /**
   * Dapatkan points berdasarkan akun
   */
  async getPointsByAccount(accountId = null) {
    try {
      let query = {};
      if (accountId) {
        query = { accountId };
      }
      
      const allPoints = await this.dbManager.find('points', query);
      
      // Agregasi points berdasarkan akun
      const accountPoints = {};
      
      for (const entry of allPoints) {
        const id = entry.accountId;
        
        if (!accountPoints[id]) {
          accountPoints[id] = {
            total: 0,
            projects: new Set(),
            details: {}
          };
        }
        
        accountPoints[id].total += entry.points;
        accountPoints[id].projects.add(entry.projectUrl);
        
        // Tambahkan detail per project
        if (!accountPoints[id].details[entry.projectUrl]) {
          accountPoints[id].details[entry.projectUrl] = 0;
        }
        accountPoints[id].details[entry.projectUrl] += entry.points;
      }
      
      // Format hasil untuk dikembalikan
      const formattedResult = {};
      
      for (const [id, data] of Object.entries(accountPoints)) {
        formattedResult[id] = {
          total: data.total,
          projectsCount: data.projects.size,
          projectDetails: Object.entries(data.details).map(([url, points]) => ({
            url,
            points
          }))
        };
      }
      
      return formattedResult;
    } catch (error) {
      console.error('Error getting points by account:', error);
      throw error;
    }
  }
  
  /**
   * Dapatkan riwayat points untuk akun dan project tertentu
   */
  async getPointsHistory(accountId, projectUrl = null, limit = 100) {
    try {
      let query = { accountId };
      if (projectUrl) {
        query.projectUrl = projectUrl;
      }
      
      // Sort by timestamp desc and limit results
      const options = {
        sort: { timestamp: -1 },
        limit
      };
      
      const history = await this.dbManager.find('points', query, options);
      
      return history.map(entry => ({
        id: entry._id,
        accountId: entry.accountId,
        projectUrl: entry.projectUrl,
        points: entry.points,
        details: entry.details,
        timestamp: entry.timestamp
      }));
    } catch (error) {
      console.error('Error getting points history:', error);
      throw error;
    }
  }
  
  /**
   * Dapatkan statistik umum untuk dashboard
   */
  async getDashboardStats() {
    try {
      // Get all data needed for stats
      const allPoints = await this.dbManager.findAll('points');
      const allAccounts = await this.dbManager.findAll('accounts');
      
      // Menghitung statistik
      const totalAccounts = allAccounts.length;
      const activeAccounts = allAccounts.filter(a => a.status === 'active').length;
      
      // Points stats
      let totalPoints = 0;
      const projectsSet = new Set();
      const accountsWithPoints = new Set();
      
      for (const entry of allPoints) {
        totalPoints += entry.points;
        projectsSet.add(entry.projectUrl);
        accountsWithPoints.add(entry.accountId);
      }
      
      // Rata-rata points per akun
      const avgPointsPerAccount = accountsWithPoints.size > 0 
        ? totalPoints / accountsWithPoints.size 
        : 0;
      
      return {
        totalAccounts,
        activeAccounts,
        totalPoints,
        projectsCount: projectsSet.size,
        accountsWithPoints: accountsWithPoints.size,
        avgPointsPerAccount: parseFloat(avgPointsPerAccount.toFixed(2))
      };
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      throw error;
    }
  }
  
  /**
   * Catat log aktivitas untuk analisis
   */
  async logActivity(accountId, projectUrl, activity, status, details = {}) {
    try {
      const timestamp = new Date().toISOString();
      
      const activityLog = {
        accountId,
        projectUrl,
        activity,
        status,
        details,
        timestamp
      };
      
      // Simpan ke database
      await this.dbManager.insert('activity_logs', activityLog);
      
      return { success: true };
    } catch (error) {
      console.error('Error logging activity:', error);
      // Kegagalan log tidak perlu menyebabkan error di aplikasi utama
      return { success: false, error: error.message };
    }
  }
}

module.exports = Analytics;