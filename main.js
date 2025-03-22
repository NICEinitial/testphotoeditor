const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios'); // 添加 axios 用于网络请求

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow;

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
  
  // 输出一些调试信息
  console.log('应用路径:', app.getAppPath());
  console.log('__dirname:', __dirname);
};

// 处理打开图片对话框
ipcMain.handle('dialog:openImage', async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: '图片', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] }
      ]
    });
    
    if (canceled) {
      return null;
    } else {
      try {
        const imagePath = filePaths[0];
        console.log('选择的图片路径:', imagePath);
        
        const imageBuffer = fs.readFileSync(imagePath);
        const extension = path.extname(imagePath).substring(1).toLowerCase();
        
        return {
          path: imagePath,
          data: `data:image/${extension};base64,${imageBuffer.toString('base64')}`
        };
      } catch (error) {
        console.error('读取图片失败:', error);
        return null;
      }
    }
  } catch (error) {
    console.error('打开图片对话框失败:', error);
    return null;
  }
});

// 处理远程图片下载
ipcMain.handle('fetch:remoteImage', async (event, url) => {
  try {
    console.log('开始下载远程图片:', url);
    
    // 下载图片
    const response = await axios.get(url, { 
      responseType: 'arraybuffer',
      // 某些服务可能需要User-Agent
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    // 获取MIME类型
    const contentType = response.headers['content-type'] || 'image/png';
    
    // 转换为Base64
    const base64 = Buffer.from(response.data).toString('base64');
    
    // 创建data URI
    const dataURI = `data:${contentType};base64,${base64}`;
    
    console.log('远程图片下载完成，已转换为data URI');
    return dataURI;
  } catch (error) {
    console.error('下载远程图片失败:', error);
    return null;
  }
});

// 处理保存图片对话框
ipcMain.handle('dialog:saveImage', async (event, dataUrl) => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog({
      filters: [
        { name: '图片', extensions: ['png', 'jpg', 'jpeg'] }
      ]
    });
    
    if (!canceled && filePath) {
      try {
        // 从 data URL 提取 base64 数据并保存
        const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(filePath, buffer);
        return { success: true, path: filePath };
      } catch (error) {
        console.error('保存图片失败:', error);
        return { success: false, error: error.message };
      }
    } else {
      return { success: false, error: '用户取消了保存操作' };
    }
  } catch (error) {
    console.error('保存图片对话框失败:', error);
    return { success: false, error: error.message };
  }
});

// 调试日志处理
ipcMain.on('debug:log', (event, message) => {
  console.log('[DEBUG]', message);
});

ipcMain.on('debug:error', (event, message) => {
  console.error('[ERROR]', message);
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(createWindow);

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here. 