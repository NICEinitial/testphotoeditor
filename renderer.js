// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process because
// `nodeIntegration` is turned off and `contextIsolation` is turned on.
// Use `preload.js` to selectively enable features needed in the rendering
// process.

// 图片编辑器主逻辑
document.addEventListener('DOMContentLoaded', () => {
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
    const canvas = new fabric.Canvas('editor-canvas', {
      width: 800,
      height: 600,
      backgroundColor: '#ffffff'
    });
    
    document.getElementById('canvas-message').style.display = 'none';
    debug.log('Canvas 初始化完成');
    
    // 当前状态
    let currentImage = null;
    
    // 工具栏功能
    
    // 打开图片
    document.getElementById('open-image').addEventListener('click', async () => {
      try {
        const result = await window.electron.fileOps.openImage();
        if (result) {
          debug.log(`打开图片: ${result.path}`);
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
    function loadImageToCanvas(src) {
      fabric.Image.fromURL(src, (img) => {
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
          selectable: true
        });
        
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
        
        currentImage = img;
        debug.log(`图片已加载，尺寸: ${imgWidth}x${imgHeight}，缩放比: ${scale}`);
      }, (error) => {
        debug.error(`加载图片失败: ${error}`);
      });
    }
    
    // 图像滤镜效果
    
    // 亮度调整
    document.getElementById('filter-brightness').addEventListener('click', () => {
      if (!currentImage) {
        debug.error('请先打开图片');
        return;
      }
      
      // 创建一个简单的对话框来替代 prompt
      const value = 0.1; // 默认值
      const dialog = document.createElement('div');
      dialog.innerHTML = `
        <div style="background: white; padding: 20px; border-radius: 5px; box-shadow: 0 0 10px rgba(0,0,0,0.3); position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1000;">
          <h3>调整亮度</h3>
          <input type="range" id="brightness-slider" min="-1" max="1" step="0.1" value="${value}" style="width: 100%;">
          <div id="brightness-value">${value}</div>
          <div style="display: flex; justify-content: space-between; margin-top: 10px;">
            <button id="cancel-brightness">取消</button>
            <button id="apply-brightness">应用</button>
          </div>
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
      
      // 创建一个简单的对话框来替代 prompt
      const value = 0.1; // 默认值
      const dialog = document.createElement('div');
      dialog.innerHTML = `
        <div style="background: white; padding: 20px; border-radius: 5px; box-shadow: 0 0 10px rgba(0,0,0,0.3); position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1000;">
          <h3>调整对比度</h3>
          <input type="range" id="contrast-slider" min="-1" max="1" step="0.1" value="${value}" style="width: 100%;">
          <div id="contrast-value">${value}</div>
          <div style="display: flex; justify-content: space-between; margin-top: 10px;">
            <button id="cancel-contrast">取消</button>
            <button id="apply-contrast">应用</button>
          </div>
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
      
      // 创建一个简单的对话框来替代 prompt
      const value = 0.1; // 默认值
      const dialog = document.createElement('div');
      dialog.innerHTML = `
        <div style="background: white; padding: 20px; border-radius: 5px; box-shadow: 0 0 10px rgba(0,0,0,0.3); position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1000;">
          <h3>调整饱和度</h3>
          <input type="range" id="saturation-slider" min="-1" max="1" step="0.1" value="${value}" style="width: 100%;">
          <div id="saturation-value">${value}</div>
          <div style="display: flex; justify-content: space-between; margin-top: 10px;">
            <button id="cancel-saturation">取消</button>
            <button id="apply-saturation">应用</button>
          </div>
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
    }
    
    // 裁剪功能
    document.getElementById('crop-image').addEventListener('click', () => {
      if (!currentImage) {
        debug.error('请先打开图片');
        return;
      }
      
      // 开始裁剪模式
      debug.log('进入裁剪模式');
      alert('裁剪功能: 使用选择工具选中图片区域，然后按回车键确认裁剪');
      
      // 创建裁剪矩形
      const cropRect = new fabric.Rect({
        left: 100,
        top: 100,
        width: 200,
        height: 200,
        fill: 'transparent',
        stroke: 'red',
        strokeWidth: 2,
        strokeDashArray: [5, 5]
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
            
            // 将裁剪后的图像加载回主画布
            fabric.Image.fromURL(tempCanvas.toDataURL(), (croppedImg) => {
              canvas.remove(cropRect);
              canvas.remove(img);
              
              canvas.add(croppedImg);
              canvas.setActiveObject(croppedImg);
              canvas.renderAll();
              
              currentImage = croppedImg;
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
      
      // 创建一个简单的对话框来替代 prompt
      const value = 90; // 默认值
      const dialog = document.createElement('div');
      dialog.innerHTML = `
        <div style="background: white; padding: 20px; border-radius: 5px; box-shadow: 0 0 10px rgba(0,0,0,0.3); position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1000;">
          <h3>旋转图像</h3>
          <input type="range" id="rotate-slider" min="0" max="360" step="1" value="${value}" style="width: 100%;">
          <div id="rotate-value">${value}°</div>
          <div style="display: flex; justify-content: space-between; margin-top: 10px;">
            <button id="cancel-rotate">取消</button>
            <button id="apply-rotate">应用</button>
          </div>
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
        currentImage.rotate(value);
        canvas.renderAll();
        debug.log(`图片已旋转 ${value} 度`);
        document.body.removeChild(dialog);
      });
    });
    
    // 绘画工具
    document.getElementById('draw-tool').addEventListener('click', () => {
      // 切换自由绘画模式
      const isDrawingMode = !canvas.isDrawingMode;
      canvas.isDrawingMode = isDrawingMode;
      
      if (isDrawingMode) {
        canvas.freeDrawingBrush.width = 5;
        canvas.freeDrawingBrush.color = '#ff0000';
        debug.log('已开启绘画模式');
      } else {
        debug.log('已关闭绘画模式');
      }
    });
    
    // 添加文字
    document.getElementById('add-text').addEventListener('click', () => {
      // 创建一个简单的对话框来替代 prompt
      const dialog = document.createElement('div');
      dialog.innerHTML = `
        <div style="background: white; padding: 20px; border-radius: 5px; box-shadow: 0 0 10px rgba(0,0,0,0.3); position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1000;">
          <h3>添加文字</h3>
          <input type="text" id="text-input" value="示例文字" style="width: 100%;">
          <div style="display: flex; justify-content: space-between; margin-top: 10px;">
            <button id="cancel-text">取消</button>
            <button id="apply-text">添加</button>
          </div>
        </div>
      `;
      document.body.appendChild(dialog);
      
      document.getElementById('cancel-text').addEventListener('click', () => {
        document.body.removeChild(dialog);
      });
      
      document.getElementById('apply-text').addEventListener('click', () => {
        const text = document.getElementById('text-input').value;
        if (!text) {
          document.body.removeChild(dialog);
          return;
        }
        
        const textObj = new fabric.Text(text, {
          left: 100,
          top: 100,
          fontFamily: 'sans-serif',
          fontSize: 30,
          fill: '#000000'
        });
        
        canvas.add(textObj);
        canvas.setActiveObject(textObj);
        canvas.renderAll();
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
      
      // 使用自定义对话框替代 prompt
      const dialog = document.createElement('div');
      dialog.innerHTML = `
        <div style="background: white; padding: 20px; border-radius: 5px; box-shadow: 0 0 10px rgba(0,0,0,0.3); position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1000;">
          <h3>选择贴纸</h3>
          <div style="display: flex; gap: 10px; margin-top: 10px;">
            ${stickers.map((sticker, index) => `
              <div class="sticker-option" data-index="${index}" style="cursor: pointer; border: 1px solid #ccc; padding: 5px; text-align: center;">
                <img src="${sticker.url}" style="width: 50px; height: 50px;">
                <div>${sticker.name}</div>
              </div>
            `).join('')}
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 10px;">
            <button id="cancel-sticker">取消</button>
          </div>
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
          
          fabric.Image.fromURL(sticker.url, (img) => {
            img.set({
              left: 100,
              top: 100,
              scaleX: 0.5,
              scaleY: 0.5
            });
            
            canvas.add(img);
            canvas.setActiveObject(img);
            canvas.renderAll();
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
        // 调用 SiliconFlow API
        const apiKey = 'sk-bpxknhfednxmnjkxqkbjpegbivbhlxjmijxiocjbedfhciyt';
        const response = await fetch('https://api.siliconflow.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'deepseek-ai/Janus-Pro-7B',
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
          loadImageToCanvas(imageUrl);
          
          statusEl.textContent = '图像生成成功';
          statusEl.style.color = 'green';
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