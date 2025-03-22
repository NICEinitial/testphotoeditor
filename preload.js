// All of the Node.js APIs are available in the preload process.
// 使用正确的方式引入Electron模块
const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electron', {
  // 文件操作
  fileOps: {
    // 读取图片文件
    openImage: () => ipcRenderer.invoke('dialog:openImage'),
    // 保存图片
    saveImage: (dataUrl) => ipcRenderer.invoke('dialog:saveImage', dataUrl),
    // 下载远程图片
    fetchRemoteImage: (url) => ipcRenderer.invoke('fetch:remoteImage', url),
  },
  
  // 调试相关功能
  debug: {
    log: (message) => {
      console.log(message);
      ipcRenderer.send('debug:log', message);
    },
    error: (message) => {
      console.error(message);
      ipcRenderer.send('debug:error', message);
    }
  }
});

// 版本信息
window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };

  for (const dependency of ['chrome', 'node', 'electron']) {
    replaceText(`${dependency}-version`, process.versions[dependency]);
  }
}); 