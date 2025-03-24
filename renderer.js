// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process because
// `nodeIntegration` is turned off and `contextIsolation` is turned on.
// Use `preload.js` to selectively enable features needed in the rendering
// process.

// 图片编辑器主逻辑
document.addEventListener('DOMContentLoaded', () => {
  // 调试面板折叠功能
  const debugPanel = document.getElementById('debug-panel');
  const toggleDebugBtn = document.getElementById('toggle-debug');
  const debugHeader = document.querySelector('.debug-header');
  
  // 切换调试面板折叠状态
  function toggleDebugPanel() {
    debugPanel.classList.toggle('collapsed');
    toggleDebugBtn.textContent = debugPanel.classList.contains('collapsed') ? '展开' : '折叠';
  }
  
  // 绑定事件监听
  if (toggleDebugBtn) {
    toggleDebugBtn.addEventListener('click', toggleDebugPanel);
  }
  
  if (debugHeader) {
    debugHeader.addEventListener('click', (e) => {
      // 确保点击不是在按钮上
      if (e.target !== toggleDebugBtn) {
        toggleDebugPanel();
      }
    });
  }
  
  // 调试工具
  const debug = {
    log: (message) => {
      console.log(message);
      const debugContent = document.getElementById('debug-content');
      if (debugContent) {
        const time = new Date().toLocaleTimeString();
        debugContent.innerHTML += `[${time}] ${message}\n`;
        debugContent.scrollTop = debugContent.scrollHeight;
      }
      if (window.electron && window.electron.debug) {
        window.electron.debug.log(message);
      }
    },
    error: (message) => {
      console.error(message);
      const debugContent = document.getElementById('debug-content');
      if (debugContent) {
        const time = new Date().toLocaleTimeString();
        debugContent.innerHTML += `<span style="color:red">[${time}] ERROR: ${message}</span>\n`;
        debugContent.scrollTop = debugContent.scrollHeight;
      }
      if (window.electron && window.electron.debug) {
        window.electron.debug.error(message);
      }
    }
  };

  debug.log('图片编辑器已加载');

  // 检查fabric是否已加载
  if (typeof fabric === 'undefined') {
    debug.error('Fabric.js 库未加载！请检查路径是否正确');
    document.getElementById('canvas-message').textContent = '图像编辑功能不可用，请查看控制台错误信息';
    document.getElementById('canvas-message').style.color = 'red';
    document.getElementById('canvas-message').style.display = 'block';
    return;
  }

  // Canvas 和 Fabric.js 初始化
  try {
    // 获取容器宽高以便更好地适应
    const container = document.querySelector('.canvas-container');
    const containerWidth = container.clientWidth - 40; // 减去padding
    const containerHeight = container.clientHeight - 40; // 减去padding
    
    // 计算适当的画布尺寸，同时保持4:3比例
    let canvasWidth = Math.min(containerWidth, 1200);
    let canvasHeight = Math.min(containerHeight, 900);
    
    // 如果高度限制更严格，按高度计算宽度
    if (canvasHeight / canvasWidth < 0.75) { // 3/4 = 0.75
      canvasWidth = canvasHeight / 0.75;
    } else { // 否则按宽度计算高度
      canvasHeight = canvasWidth * 0.75;
    }
    
    const canvas = new fabric.Canvas('editor-canvas', {
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true
    });
    
    // 窗口大小改变时调整canvas大小
    window.addEventListener('resize', () => {
      const container = document.querySelector('.canvas-container');
      const containerWidth = container.clientWidth - 40;
      const containerHeight = container.clientHeight - 40;
      
      let newWidth = Math.min(containerWidth, 1200);
      let newHeight = Math.min(containerHeight, 900);
      
      if (newHeight / newWidth < 0.75) {
        newWidth = newHeight / 0.75;
      } else {
        newHeight = newWidth * 0.75;
      }
      
      // 调整canvas大小
      canvas.setWidth(newWidth);
      canvas.setHeight(newHeight);
      canvas.renderAll();
      
      debug.log(`Canvas大小已调整为 ${newWidth}x${newHeight}`);
    });
    
    document.getElementById('canvas-message').style.display = 'none';
    debug.log(`Canvas 初始化完成，尺寸: ${canvasWidth}x${canvasHeight}`);
    
    // 当前状态
    let currentImage = null;
    
    // 历史记录管理
    const historyManager = {
      history: [],  // 存储历史操作
      currentIndex: -1, // 当前历史位置
      maxHistoryItems: 20, // 最大历史条目数量
      
      // 添加操作到历史记录
      addAction(action) {
        // 如果我们在历史中间进行了操作，清除后面的历史
        if (this.currentIndex < this.history.length - 1) {
          this.history = this.history.slice(0, this.currentIndex + 1);
        }
        
        // 添加新操作
        this.history.push(action);
        
        // 如果超过最大限制，删除最旧的记录
        if (this.history.length > this.maxHistoryItems) {
          this.history.shift();
        } else {
          this.currentIndex++;
        }
        
        // 更新UI
        this.updateHistoryUI();
        this.updateButtons();
      },
      
      // 撤销操作
      undo() {
        if (this.currentIndex >= 0) {
          this.currentIndex--;
          this.applyHistoryState();
          this.updateHistoryUI();
          this.updateButtons();
        }
      },
      
      // 重做操作
      redo() {
        if (this.currentIndex < this.history.length - 1) {
          this.currentIndex++;
          this.applyHistoryState();
          this.updateHistoryUI();
          this.updateButtons();
        }
      },
      
      // 应用历史状态
      applyHistoryState() {
        if (this.currentIndex >= 0 && this.currentIndex < this.history.length) {
          const state = this.history[this.currentIndex];
          canvas.loadFromJSON(state.canvasState, () => {
            canvas.renderAll();
            
            // 历史记录中的对象恢复后需要更新currentImage引用
            if (state.hasImage) {
              currentImage = canvas.getObjects().find(obj => obj.type === 'image');
            } else {
              currentImage = null;
            }
            
            // 恢复图层管理器的状态
            layerManager.setLayersFromObjects(canvas.getObjects());
          });
        } else if (this.currentIndex === -1) {
          // 清空画布
          canvas.clear();
          currentImage = null;
          layerManager.clearLayers();
        }
      },
      
      // 更新历史记录UI
      updateHistoryUI() {
        const historyList = document.getElementById('history-list');
        if (!historyList) return;
        
        historyList.innerHTML = '';
        
        this.history.forEach((action, index) => {
          const item = document.createElement('div');
          item.className = `list-group-item history-item ${index === this.currentIndex ? 'active' : ''}`;
          item.innerHTML = `
            <div class="history-text">${action.name}</div>
            <span class="badge bg-secondary history-index">#${index + 1}</span>
          `;
          
          // 点击历史记录项跳转到该状态
          item.addEventListener('click', () => {
            this.currentIndex = index;
            this.applyHistoryState();
            this.updateHistoryUI();
            this.updateButtons();
          });
          
          historyList.appendChild(item);
        });
        
        // 滚动到当前位置
        if (this.currentIndex >= 0) {
          const activeItem = historyList.querySelector('.active');
          if (activeItem) {
            activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
      },
      
      // 更新按钮状态
      updateButtons() {
        const undoBtn = document.getElementById('undo-action');
        const redoBtn = document.getElementById('redo-action');
        
        if (undoBtn) {
          undoBtn.disabled = this.currentIndex < 0;
        }
        
        if (redoBtn) {
          redoBtn.disabled = this.currentIndex >= this.history.length - 1;
        }
      },
      
      // 保存当前画布状态
      saveCanvasState(actionName) {
        const canvasState = JSON.stringify(canvas);
        const hasImage = !!currentImage;
        
        this.addAction({
          name: actionName,
          canvasState: canvasState,
          hasImage: hasImage,
          timestamp: new Date().getTime()
        });
      }
    };
    
    // 图层管理
    const layerManager = {
      layers: [], // 存储图层信息
      maxLayers: 20, // 最大图层数量
      activeLayerIndex: -1, // 当前活动图层索引
      
      // 初始化默认图层
      init() {
        this.addLayer('背景图层');
        this.updateLayersUI();
      },
      
      // 添加新图层
      addLayer(name) {
        if (this.layers.length >= this.maxLayers) {
          debug.error(`已达到最大图层数量 ${this.maxLayers}`);
          return false;
        }
        
        const newLayer = {
          id: Date.now() + Math.floor(Math.random() * 1000),
          name: name || `图层 ${this.layers.length + 1}`,
          visible: true,
          locked: false,
          objects: []
        };
        
        this.layers.push(newLayer);
        this.activeLayerIndex = this.layers.length - 1;
        this.updateLayersUI();
        return true;
      },
      
      // 删除当前选中的图层
      deleteActiveLayer() {
        if (this.activeLayerIndex < 0 || this.layers.length <= 1) {
          debug.error('无法删除唯一的图层');
          return false;
        }
        
        // 从画布移除该图层的所有对象
        const layerToDelete = this.layers[this.activeLayerIndex];
        layerToDelete.objects.forEach(objId => {
          const obj = this.findObjectById(objId);
          if (obj) {
            canvas.remove(obj);
          }
        });
        
        // 删除图层
        this.layers.splice(this.activeLayerIndex, 1);
        
        // 更新活动图层
        this.activeLayerIndex = Math.min(this.activeLayerIndex, this.layers.length - 1);
        
        this.updateLayersUI();
        canvas.renderAll();
        return true;
      },
      
      // 切换图层可见性
      toggleLayerVisibility(index) {
        if (index >= 0 && index < this.layers.length) {
          const layer = this.layers[index];
          layer.visible = !layer.visible;
          
          // 更新画布中对象的可见性
          layer.objects.forEach(objId => {
            const obj = this.findObjectById(objId);
            if (obj) {
              obj.visible = layer.visible;
            }
          });
          
          this.updateLayersUI();
          canvas.renderAll();
        }
      },
      
      // 设置活动图层
      setActiveLayer(index) {
        if (index >= 0 && index < this.layers.length) {
          this.activeLayerIndex = index;
          this.updateLayersUI();
          
          // 仅允许活动图层的对象可选
          canvas.getObjects().forEach(obj => {
            const layerIndex = this.getLayerIndexByObjectId(obj.id);
            obj.selectable = layerIndex === this.activeLayerIndex && !this.layers[layerIndex].locked;
          });
          
          canvas.renderAll();
        }
      },
      
      // 添加对象到当前活动图层
      addObjectToActiveLayer(obj) {
        if (this.activeLayerIndex < 0) {
          debug.error('没有活动图层');
          return false;
        }
        
        // 确保对象有唯一ID
        if (!obj.id) {
          obj.id = Date.now() + Math.floor(Math.random() * 1000);
        }
        
        this.layers[this.activeLayerIndex].objects.push(obj.id);
        this.updateLayersUI();
        return true;
      },
      
      // 从画布对象重建图层
      setLayersFromObjects(objects) {
        // 清空所有图层中的对象
        this.layers.forEach(layer => {
          layer.objects = [];
        });
        
        // 为每个对象分配图层
        objects.forEach(obj => {
          if (!obj.id) {
            obj.id = Date.now() + Math.floor(Math.random() * 1000);
          }
          
          // 尝试找到对象所属的图层
          const layerIndex = this.getLayerIndexByObjectId(obj.id);
          if (layerIndex >= 0) {
            this.layers[layerIndex].objects.push(obj.id);
          } else {
            // 如果找不到图层，添加到活动图层
            if (this.activeLayerIndex >= 0) {
              this.layers[this.activeLayerIndex].objects.push(obj.id);
            } else if (this.layers.length > 0) {
              // 或者添加到第一个图层
              this.layers[0].objects.push(obj.id);
            }
          }
        });
        
        this.updateLayersUI();
      },
      
      // 根据对象ID找到对象
      findObjectById(objId) {
        return canvas.getObjects().find(obj => obj.id === objId);
      },
      
      // 获取对象所在的图层索引
      getLayerIndexByObjectId(objId) {
        for (let i = 0; i < this.layers.length; i++) {
          if (this.layers[i].objects.includes(objId)) {
            return i;
          }
        }
        return -1;
      },
      
      // 清空所有图层
      clearLayers() {
        const keepFirstLayer = this.layers.length > 0;
        
        if (keepFirstLayer) {
          // 保留第一个图层但清空其中的对象
          this.layers = [{ 
            ...this.layers[0],
            objects: [] 
          }];
          this.activeLayerIndex = 0;
        } else {
          this.layers = [];
          this.activeLayerIndex = -1;
          this.init(); // 重新初始化一个默认图层
        }
        
        this.updateLayersUI();
      },
      
      // 更新图层UI
      updateLayersUI() {
        const layersList = document.getElementById('layers-list');
        if (!layersList) return;
        
        layersList.innerHTML = '';
        
        // 倒序显示图层（顶层图层显示在上面）
        [...this.layers].reverse().forEach((layer, reversedIndex) => {
          const actualIndex = this.layers.length - 1 - reversedIndex;
          const item = document.createElement('div');
          item.className = `list-group-item layer-item ${actualIndex === this.activeLayerIndex ? 'active' : ''}`;
          item.innerHTML = `
            <div class="layer-visibility" data-visible="${layer.visible}">
              <i class="bi ${layer.visible ? 'bi-eye-fill' : 'bi-eye-slash'}"></i>
            </div>
            <div class="layer-name">${layer.name}</div>
            <span class="badge bg-secondary layer-index">#${actualIndex + 1}</span>
          `;
          
          // 点击图层项设置为活动图层
          item.addEventListener('click', (e) => {
            if (!e.target.classList.contains('layer-visibility') && !e.target.closest('.layer-visibility')) {
              this.setActiveLayer(actualIndex);
            }
          });
          
          // 点击可见性图标切换可见性
          const visibilityIcon = item.querySelector('.layer-visibility');
          visibilityIcon.addEventListener('click', () => {
            this.toggleLayerVisibility(actualIndex);
          });
          
          layersList.appendChild(item);
        });
      }
    };
    
    // 工具栏功能
    
    // 初始化图层和历史记录
    layerManager.init();
    historyManager.saveCanvasState('初始状态');
    
    // 绑定历史记录按钮事件
    document.getElementById('undo-action').addEventListener('click', () => {
      historyManager.undo();
    });
    
    document.getElementById('redo-action').addEventListener('click', () => {
      historyManager.redo();
    });
    
    // 绑定图层按钮事件
    document.getElementById('add-layer').addEventListener('click', () => {
      if (layerManager.addLayer()) {
        historyManager.saveCanvasState('添加图层');
      }
    });
    
    document.getElementById('delete-layer').addEventListener('click', () => {
      if (layerManager.deleteActiveLayer()) {
        historyManager.saveCanvasState('删除图层');
      }
    });
    
    // 监听Canvas对象修改事件
    canvas.on('object:modified', () => {
      historyManager.saveCanvasState('修改对象');
    });
    
    canvas.on('object:added', (e) => {
      // 为新添加的对象设置ID并添加到当前活动图层
      if (e.target && !e.target.id) {
        e.target.id = Date.now() + Math.floor(Math.random() * 1000);
        layerManager.addObjectToActiveLayer(e.target);
      }
    });
    
    canvas.on('object:removed', () => {
      // 在对象移除后更新图层
      layerManager.setLayersFromObjects(canvas.getObjects());
    });
    
    // 打开图片
    document.getElementById('open-image').addEventListener('click', async () => {
      try {
        const result = await window.electron.fileOps.openImage();
        if (result) {
          debug.log(`打开图片: ${result.path}`);
          
          // 保存当前状态，在加载新图片前
          historyManager.saveCanvasState('打开图片前');
          
          loadImageToCanvas(result.data);
        }
      } catch (error) {
        debug.error(`打开图片出错: ${error}`);
      }
    });
    
    // 保存图片
    document.getElementById('save-image').addEventListener('click', async () => {
      try {
        const dataUrl = canvas.toDataURL({
          format: 'png',
          quality: 0.8
        });
        const result = await window.electron.fileOps.saveImage(dataUrl);
        if (result.success) {
          debug.log(`图片已保存至: ${result.path}`);
        } else {
          debug.error(`保存图片失败: ${result.error}`);
        }
      } catch (error) {
        debug.error(`保存图片出错: ${error}`);
      }
    });
    
    // 加载图片到画布
    async function loadImageToCanvas(src) {
      try {
        // 检查是否是远程URL（以http开头）
        if (src.startsWith('http')) {
          debug.log('检测到远程图片URL，开始下载转换');
          
          const statusEl = document.getElementById('ai-status');
          if (statusEl) {
            statusEl.textContent = '正在下载远程图片...';
            statusEl.style.color = 'blue';
          }
          
          try {
            // 通过main进程下载远程图片并转换为data URI
            const dataUrl = await window.electron.fileOps.fetchRemoteImage(src);
            if (dataUrl) {
              debug.log('远程图片下载成功，加载到画布');
              loadImageFromDataUrl(dataUrl);
              
              if (statusEl) {
                statusEl.textContent = '图像加载成功';
                statusEl.style.color = 'green';
              }
            } else {
              debug.error('无法加载远程图片');
              if (statusEl) {
                statusEl.textContent = '无法加载远程图片';
                statusEl.style.color = 'red';
              }
            }
          } catch (error) {
            debug.error(`加载远程图片失败: ${error}`);
            if (statusEl) {
              statusEl.textContent = `加载远程图片失败: ${error}`;
              statusEl.style.color = 'red';
            }
          }
        } else {
          // 对于本地图片或已经是data URI的情况，直接加载
          loadImageFromDataUrl(src);
        }
      } catch (error) {
        debug.error(`加载图片失败: ${error}`);
      }
    }
    
    // 实际加载图片到画布的函数
    function loadImageFromDataUrl(dataUrl) {
      fabric.Image.fromURL(dataUrl, (img) => {
        // 清除画布
        canvas.clear();
        
        // 调整图片大小以适应画布
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const imgWidth = img.width;
        const imgHeight = img.height;
        
        let scale = 1;
        if (imgWidth > canvasWidth || imgHeight > canvasHeight) {
          const scaleX = canvasWidth / imgWidth;
          const scaleY = canvasHeight / imgHeight;
          scale = Math.min(scaleX, scaleY) * 0.9;  // 留一些边距
        }
        
        img.scale(scale);
        img.set({
          left: (canvasWidth - imgWidth * scale) / 2,
          top: (canvasHeight - imgHeight * scale) / 2,
          selectable: true,
          id: Date.now() + Math.floor(Math.random() * 1000) // 给图片添加ID
        });
        
        // 清空图层并创建新的图层用于图片
        layerManager.clearLayers();
        layerManager.addLayer('图片图层');
        
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
        
        currentImage = img;
        
        // 将图片添加到活动图层
        layerManager.addObjectToActiveLayer(img);
        
        // 保存加载图片后的状态
        historyManager.saveCanvasState('加载图片');
        
        debug.log(`图片已加载，尺寸: ${imgWidth}x${imgHeight}，缩放比: ${scale}`);
      }, (error) => {
        debug.error(`加载图片失败: ${error}`);
      });
    }
    
    // 图像滤镜效果
    
    // 应用滤镜到当前图像
    function applyFilter(filter) {
      if (!currentImage) return;
      
      const filtersArray = currentImage.filters || [];
      const filterType = filter.type;
      
      // 移除同类型的旧滤镜
      const newFilters = filtersArray.filter(f => f.type !== filterType);
      newFilters.push(filter);
      
      currentImage.filters = newFilters;
      currentImage.applyFilters();
      canvas.renderAll();
      
      // 保存应用滤镜后的状态
      historyManager.saveCanvasState(`应用${filterType}滤镜`);
    }
    
    // 亮度调整
    document.getElementById('filter-brightness').addEventListener('click', () => {
      if (!currentImage) {
        debug.error('请先打开图片');
        return;
      }
      
      // 创建一个Bootstrap风格的对话框
      const dialog = document.createElement('div');
      dialog.className = 'custom-dialog';
      dialog.innerHTML = `
        <h3>调整亮度</h3>
        <div class="mb-3">
          <label for="brightness-slider" class="form-label">亮度值: <span id="brightness-value">0.1</span></label>
          <input type="range" class="form-range" id="brightness-slider" min="-1" max="1" step="0.1" value="0.1">
        </div>
        <div class="custom-dialog-buttons">
          <button id="cancel-brightness" class="btn btn-secondary">取消</button>
          <button id="apply-brightness" class="btn btn-primary">应用</button>
        </div>
      `;
      document.body.appendChild(dialog);
      
      const slider = document.getElementById('brightness-slider');
      const valueDisplay = document.getElementById('brightness-value');
      
      slider.addEventListener('input', () => {
        valueDisplay.textContent = slider.value;
      });
      
      document.getElementById('cancel-brightness').addEventListener('click', () => {
        document.body.removeChild(dialog);
      });
      
      document.getElementById('apply-brightness').addEventListener('click', () => {
        const value = parseFloat(slider.value);
        applyFilter(new fabric.Image.filters.Brightness({
          brightness: value
        }));
        debug.log(`已应用亮度滤镜: ${value}`);
        document.body.removeChild(dialog);
      });
    });
    
    // 对比度调整
    document.getElementById('filter-contrast').addEventListener('click', () => {
      if (!currentImage) {
        debug.error('请先打开图片');
        return;
      }
      
      // 创建一个Bootstrap风格的对话框
      const dialog = document.createElement('div');
      dialog.className = 'custom-dialog';
      dialog.innerHTML = `
        <h3>调整对比度</h3>
        <div class="mb-3">
          <label for="contrast-slider" class="form-label">对比度值: <span id="contrast-value">0.1</span></label>
          <input type="range" class="form-range" id="contrast-slider" min="-1" max="1" step="0.1" value="0.1">
        </div>
        <div class="custom-dialog-buttons">
          <button id="cancel-contrast" class="btn btn-secondary">取消</button>
          <button id="apply-contrast" class="btn btn-primary">应用</button>
        </div>
      `;
      document.body.appendChild(dialog);
      
      const slider = document.getElementById('contrast-slider');
      const valueDisplay = document.getElementById('contrast-value');
      
      slider.addEventListener('input', () => {
        valueDisplay.textContent = slider.value;
      });
      
      document.getElementById('cancel-contrast').addEventListener('click', () => {
        document.body.removeChild(dialog);
      });
      
      document.getElementById('apply-contrast').addEventListener('click', () => {
        const value = parseFloat(slider.value);
        applyFilter(new fabric.Image.filters.Contrast({
          contrast: value
        }));
        debug.log(`已应用对比度滤镜: ${value}`);
        document.body.removeChild(dialog);
      });
    });
    
    // 饱和度调整
    document.getElementById('filter-saturation').addEventListener('click', () => {
      if (!currentImage) {
        debug.error('请先打开图片');
        return;
      }
      
      // 创建一个Bootstrap风格的对话框
      const dialog = document.createElement('div');
      dialog.className = 'custom-dialog';
      dialog.innerHTML = `
        <h3>调整饱和度</h3>
        <div class="mb-3">
          <label for="saturation-slider" class="form-label">饱和度值: <span id="saturation-value">0.1</span></label>
          <input type="range" class="form-range" id="saturation-slider" min="-1" max="1" step="0.1" value="0.1">
        </div>
        <div class="custom-dialog-buttons">
          <button id="cancel-saturation" class="btn btn-secondary">取消</button>
          <button id="apply-saturation" class="btn btn-primary">应用</button>
        </div>
      `;
      document.body.appendChild(dialog);
      
      const slider = document.getElementById('saturation-slider');
      const valueDisplay = document.getElementById('saturation-value');
      
      slider.addEventListener('input', () => {
        valueDisplay.textContent = slider.value;
      });
      
      document.getElementById('cancel-saturation').addEventListener('click', () => {
        document.body.removeChild(dialog);
      });
      
      document.getElementById('apply-saturation').addEventListener('click', () => {
        const value = parseFloat(slider.value);
        applyFilter(new fabric.Image.filters.Saturation({
          saturation: value
        }));
        debug.log(`已应用饱和度滤镜: ${value}`);
        document.body.removeChild(dialog);
      });
    });
    
    // 裁剪功能
    document.getElementById('crop-image').addEventListener('click', () => {
      if (!currentImage) {
        debug.error('请先打开图片');
        return;
      }
      
      // 保存裁剪前的状态
      historyManager.saveCanvasState('裁剪前');
      
      // 开始裁剪模式
      debug.log('进入裁剪模式');
      
      // 使用Bootstrap提示
      const alertDiv = document.createElement('div');
      alertDiv.className = 'alert alert-info position-absolute top-0 start-50 translate-middle-x mt-3';
      alertDiv.style.zIndex = 1050;
      alertDiv.innerHTML = `
        <i class="bi bi-info-circle me-2"></i>裁剪功能: 使用选择工具选中图片区域，然后按<kbd>Enter</kbd>键确认裁剪
        <button type="button" class="btn-close" aria-label="Close"></button>
      `;
      document.body.appendChild(alertDiv);
      
      const closeButton = alertDiv.querySelector('.btn-close');
      closeButton.addEventListener('click', () => {
        document.body.removeChild(alertDiv);
      });
      
      // 自动在几秒后关闭提示
      setTimeout(() => {
        if (document.body.contains(alertDiv)) {
          document.body.removeChild(alertDiv);
        }
      }, 5000);
      
      // 创建裁剪矩形
      const cropRect = new fabric.Rect({
        left: 100,
        top: 100,
        width: 200,
        height: 200,
        fill: 'transparent',
        stroke: '#007bff',
        strokeWidth: 2,
        strokeDashArray: [5, 5],
        id: Date.now() + Math.floor(Math.random() * 1000)
      });
      
      canvas.add(cropRect);
      canvas.setActiveObject(cropRect);
      
      // 裁剪确认处理
      function confirmCrop(e) {
        if (e.key === 'Enter') {
          try {
            const rect = cropRect;
            const img = currentImage;
            
            // 获取裁剪区域相对于图像的坐标
            const imgElement = img.getElement();
            const imgLeft = img.left;
            const imgTop = img.top;
            const imgScale = img.scaleX;
            
            const cropX = (rect.left - imgLeft) / imgScale;
            const cropY = (rect.top - imgTop) / imgScale;
            const cropWidth = rect.width / imgScale;
            const cropHeight = rect.height / imgScale;
            
            // 创建临时 canvas 进行裁剪
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = cropWidth;
            tempCanvas.height = cropHeight;
            
            // 绘制裁剪区域
            tempCtx.drawImage(
              imgElement,
              cropX, cropY, cropWidth, cropHeight,
              0, 0, cropWidth, cropHeight
            );
            
            // 获取当前图层索引
            const layerIndex = layerManager.getLayerIndexByObjectId(currentImage.id);
            
            // 将裁剪后的图像加载回主画布
            fabric.Image.fromURL(tempCanvas.toDataURL(), (croppedImg) => {
              canvas.remove(cropRect);
              canvas.remove(img);
              
              // 为裁剪后的图像设置ID
              croppedImg.id = Date.now() + Math.floor(Math.random() * 1000);
              
              canvas.add(croppedImg);
              canvas.setActiveObject(croppedImg);
              canvas.renderAll();
              
              currentImage = croppedImg;
              
              // 将裁剪后的图像添加到相同的图层
              if (layerIndex >= 0) {
                layerManager.layers[layerIndex].objects.push(croppedImg.id);
                layerManager.updateLayersUI();
              } else {
                layerManager.addObjectToActiveLayer(croppedImg);
              }
              
              // 保存裁剪后的状态
              historyManager.saveCanvasState('裁剪图片');
              
              debug.log(`图片已裁剪至 ${cropWidth}x${cropHeight}`);
            });
          } catch (error) {
            debug.error(`裁剪失败: ${error}`);
          }
          
          // 移除事件监听
          window.removeEventListener('keydown', confirmCrop);
        }
      }
      
      window.addEventListener('keydown', confirmCrop);
    });
    
    // 旋转功能
    document.getElementById('rotate-image').addEventListener('click', () => {
      if (!currentImage) {
        debug.error('请先打开图片');
        return;
      }
      
      // 创建一个Bootstrap风格的对话框
      const dialog = document.createElement('div');
      dialog.className = 'custom-dialog';
      dialog.innerHTML = `
        <h3>旋转图像</h3>
        <div class="mb-3">
          <label for="rotate-slider" class="form-label">旋转角度: <span id="rotate-value">90°</span></label>
          <input type="range" class="form-range" id="rotate-slider" min="0" max="360" step="1" value="90">
        </div>
        <div class="custom-dialog-buttons">
          <button id="cancel-rotate" class="btn btn-secondary">取消</button>
          <button id="apply-rotate" class="btn btn-primary">应用</button>
        </div>
      `;
      document.body.appendChild(dialog);
      
      const slider = document.getElementById('rotate-slider');
      const valueDisplay = document.getElementById('rotate-value');
      
      slider.addEventListener('input', () => {
        valueDisplay.textContent = slider.value + '°';
      });
      
      document.getElementById('cancel-rotate').addEventListener('click', () => {
        document.body.removeChild(dialog);
      });
      
      document.getElementById('apply-rotate').addEventListener('click', () => {
        const value = parseFloat(slider.value);
        
        // 保存旋转前的状态
        historyManager.saveCanvasState('旋转前');
        
        currentImage.rotate(value);
        canvas.renderAll();
        debug.log(`图片已旋转 ${value} 度`);
        
        // 保存旋转后的状态
        historyManager.saveCanvasState('旋转图片');
        
        document.body.removeChild(dialog);
      });
    });
    
    // 绘画工具
    document.getElementById('draw-tool').addEventListener('click', () => {
      // 切换自由绘画模式
      const isDrawingMode = !canvas.isDrawingMode;
      canvas.isDrawingMode = isDrawingMode;
      
      if (isDrawingMode) {
        // 保存绘画前的状态
        historyManager.saveCanvasState('开始绘画');
        
        canvas.freeDrawingBrush.width = 5;
        canvas.freeDrawingBrush.color = '#ff0000';
        debug.log('已开启绘画模式');
        
        // 当绘画结束时保存状态
        canvas.on('path:created', () => {
          // 为新创建的路径添加ID并关联到当前图层
          const path = canvas.getObjects().pop();
          if (path && !path.id) {
            path.id = Date.now() + Math.floor(Math.random() * 1000);
            layerManager.addObjectToActiveLayer(path);
          }
          historyManager.saveCanvasState('绘画');
        });
      } else {
        debug.log('已关闭绘画模式');
        // 移除事件监听
        canvas.off('path:created');
      }
    });
    
    // 添加文字
    document.getElementById('add-text').addEventListener('click', () => {
      // 创建一个Bootstrap风格的对话框
      const dialog = document.createElement('div');
      dialog.className = 'custom-dialog';
      dialog.innerHTML = `
        <h3>添加文字</h3>
        <div class="mb-3">
          <input type="text" id="text-input" class="form-control" value="示例文字" placeholder="输入要添加的文字">
        </div>
        <div class="mb-3">
          <label for="text-color" class="form-label">文字颜色</label>
          <input type="color" id="text-color" class="form-control form-control-color" value="#000000">
        </div>
        <div class="custom-dialog-buttons">
          <button id="cancel-text" class="btn btn-secondary">取消</button>
          <button id="apply-text" class="btn btn-primary">添加</button>
        </div>
      `;
      document.body.appendChild(dialog);
      
      document.getElementById('cancel-text').addEventListener('click', () => {
        document.body.removeChild(dialog);
      });
      
      document.getElementById('apply-text').addEventListener('click', () => {
        const text = document.getElementById('text-input').value;
        const textColor = document.getElementById('text-color').value;
        
        if (!text) {
          document.body.removeChild(dialog);
          return;
        }
        
        // 保存添加文字前的状态
        historyManager.saveCanvasState('添加文字前');
        
        const textObj = new fabric.Text(text, {
          left: 100,
          top: 100,
          fontFamily: 'sans-serif',
          fontSize: 30,
          fill: textColor,
          id: Date.now() + Math.floor(Math.random() * 1000)
        });
        
        canvas.add(textObj);
        canvas.setActiveObject(textObj);
        canvas.renderAll();
        
        // 将文字对象添加到当前活动图层
        layerManager.addObjectToActiveLayer(textObj);
        
        // 保存添加文字后的状态
        historyManager.saveCanvasState('添加文字');
        
        debug.log('已添加文字对象');
        document.body.removeChild(dialog);
      });
    });
    
    // 添加贴纸 (模拟数据)
    document.getElementById('add-sticker').addEventListener('click', () => {
      // 模拟贴纸数据
      const stickers = [
        { name: '笑脸', url: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0MCIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLXdpZHRoPSIzIiBmaWxsPSJ5ZWxsb3ciIC8+PGNpcmNsZSBjeD0iMzAiIGN5PSI0MCIgcj0iNSIgZmlsbD0iYmxhY2siIC8+PGNpcmNsZSBjeD0iNzAiIGN5PSI0MCIgcj0iNSIgZmlsbD0iYmxhY2siIC8+PHBhdGggZD0iTSAzMCA2MCBRIDUwIDgwIDcwIDYwIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjMiIGZpbGw9InRyYW5zcGFyZW50IiAvPjwvc3ZnPg==' },
        { name: '爱心', url: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cGF0aCBkPSJNIDUwIDkwIEwgMTUgNTAgQSAyMCAyMCAwIDAgMSA1MCAxMCBBIDIwIDIwIDAgMCAxIDg1IDUwIEwgNTAgOTAiIGZpbGw9InJlZCIgLz48L3N2Zz4=' },
        { name: '星星', url: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cGF0aCBkPSJNIDUwIDEwIEwgNjEgNDQgTCA5OCA0NCBMIDY4IDY0IEwgNzkgOTggTCA1MCA3OCBMIDIxIDk4IEwgMzIgNjQgTCAyIDQ0IEwgMzkgNDQgTCA1MCAxMCIgZmlsbD0iZ29sZCIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9zdmc+' }
      ];
      
      // 使用Bootstrap风格对话框
      const dialog = document.createElement('div');
      dialog.className = 'custom-dialog';
      dialog.innerHTML = `
        <h3>选择贴纸</h3>
        <div class="sticker-grid">
          ${stickers.map((sticker, index) => `
            <div class="sticker-option card h-100" data-index="${index}">
              <img src="${sticker.url}" class="card-img-top p-2" alt="${sticker.name}">
              <div class="card-body p-2 text-center">
                <h5 class="card-title m-0 fs-6">${sticker.name}</h5>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="custom-dialog-buttons">
          <button id="cancel-sticker" class="btn btn-secondary">取消</button>
        </div>
      `;
      document.body.appendChild(dialog);
      
      document.getElementById('cancel-sticker').addEventListener('click', () => {
        document.body.removeChild(dialog);
      });
      
      // 为每个贴纸选项添加点击事件
      document.querySelectorAll('.sticker-option').forEach(option => {
        option.addEventListener('click', () => {
          const index = parseInt(option.dataset.index);
          const sticker = stickers[index];
          
          // 保存添加贴纸前的状态
          historyManager.saveCanvasState('添加贴纸前');
          
          fabric.Image.fromURL(sticker.url, (img) => {
            img.set({
              left: 100,
              top: 100,
              scaleX: 0.5,
              scaleY: 0.5,
              id: Date.now() + Math.floor(Math.random() * 1000)
            });
            
            canvas.add(img);
            canvas.setActiveObject(img);
            canvas.renderAll();
            
            // 将贴纸添加到当前活动图层
            layerManager.addObjectToActiveLayer(img);
            
            // 保存添加贴纸后的状态
            historyManager.saveCanvasState(`添加贴纸: ${sticker.name}`);
            
            debug.log(`已添加贴纸: ${sticker.name}`);
          });
          
          document.body.removeChild(dialog);
        });
      });
    });
    
    // AI 生成图像功能
    document.getElementById('generate-image').addEventListener('click', async () => {
      const prompt = document.getElementById('ai-prompt').value.trim();
      if (!prompt) {
        debug.error('请输入图像描述');
        return;
      }
      
      const statusEl = document.getElementById('ai-status');
      statusEl.textContent = '正在生成图像...';
      statusEl.style.color = 'blue';
      
      debug.log(`开始生成图像，提示词: "${prompt}"`);
      
      try {
        // 保存生成图像前的状态
        historyManager.saveCanvasState('生成AI图像前');
        
        // 调用 SiliconFlow API
        const apiKey = 'sk-bpxknhfednxmnjkxqkbjpegbivbhlxjmijxiocjbedfhciyt';
        const response = await fetch('https://api.siliconflow.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'Kwai-Kolors/Kolors',
            prompt: prompt,
            seed: Math.floor(Math.random() * 9999999999) + 1
          })
        });
        
        if (!response.ok) {
          throw new Error(`API 错误: ${response.status}`);
        }
        
        const result = await response.json();
        debug.log('图像生成成功');
        
        // 根据API返回格式获取图像URL
        if (result.images && result.images.length > 0 && result.images[0].url) {
          const imageUrl = result.images[0].url;
          await loadImageToCanvas(imageUrl);
          
          statusEl.textContent = '图像生成成功';
          statusEl.style.color = 'green';
          
          // 生成后，画布会被更新并在loadImageToCanvas中保存状态
        } else {
          throw new Error('API返回的数据格式不正确');
        }
      } catch (error) {
        debug.error(`生成图像失败: ${error.message}`);
        statusEl.textContent = `生成失败: ${error.message}`;
        statusEl.style.color = 'red';
      }
    });
  } catch (error) {
    debug.error(`初始化Canvas失败: ${error}`);
    document.getElementById('canvas-message').textContent = `初始化Canvas失败: ${error}`;
    document.getElementById('canvas-message').style.color = 'red';
    document.getElementById('canvas-message').style.display = 'block';
  }
}); 