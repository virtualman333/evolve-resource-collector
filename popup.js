// 格式化数字显示，自动转换为K/M单位
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  } else {
    return Math.round(num).toString();
  }
}

// 修复浮点数精度问题
function fixPrecision(num) {
  return Math.round(num * 1000) / 1000;
}

// 获取资源信息并更新UI
async function updateResourceInfo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        function translateNumber(text) {
          const match = text.match(/(\d+(?:\.\d+)?)\s*[KM]?/);
          if (!match) return 0;
          let count = parseFloat(match[1]);
          if (text.includes('K')) {
            count *= 1000;
          } else if (text.includes('M')) {
            count *= 1000000;
          }
          return count;
        }
        
        function getResourceInfo(elementId) {
          const element = document.getElementById(elementId);
          if (!element) return null;
          const text = element.textContent.trim();
          const parts = text.split('/');
          if (parts.length !== 2) return null;
          const hadNumber = translateNumber(parts[0]);
          const maxNumber = translateNumber(parts[1]);
          const needNumber = Math.max(0, maxNumber - hadNumber);
          return {
            had: hadNumber,
            max: maxNumber,
            need: needNumber
          };
        }
        
        return {
          food: getResourceInfo('cntFood'),
          lumber: getResourceInfo('cntLumber'),
          stone: getResourceInfo('cntStone')
        };
      }
    });
    
    const resourceData = result[0].result;
    
    // 更新UI显示，使用格式化函数
    if (resourceData.food) {
      const had = fixPrecision(resourceData.food.had);
      const max = fixPrecision(resourceData.food.max);
      const need = fixPrecision(resourceData.food.need);
      document.getElementById('foodInfo').textContent = 
        `${formatNumber(had)}/${formatNumber(max)} (需:${formatNumber(need)})`;
    } else {
      document.getElementById('foodInfo').textContent = '未找到';
    }
    
    if (resourceData.lumber) {
      const had = fixPrecision(resourceData.lumber.had);
      const max = fixPrecision(resourceData.lumber.max);
      const need = fixPrecision(resourceData.lumber.need);
      document.getElementById('lumberInfo').textContent = 
        `${formatNumber(had)}/${formatNumber(max)} (需:${formatNumber(need)})`;
    } else {
      document.getElementById('lumberInfo').textContent = '未找到';
    }
    
    if (resourceData.stone) {
      const had = fixPrecision(resourceData.stone.had);
      const max = fixPrecision(resourceData.stone.max);
      const need = fixPrecision(resourceData.stone.need);
      document.getElementById('stoneInfo').textContent = 
        `${formatNumber(had)}/${formatNumber(max)} (需:${formatNumber(need)})`;
    } else {
      document.getElementById('stoneInfo').textContent = '未找到';
    }
    
  } catch (error) {
    console.error('获取资源信息失败:', error);
    document.getElementById('foodInfo').textContent = '加载失败';
    document.getElementById('lumberInfo').textContent = '加载失败';
    document.getElementById('stoneInfo').textContent = '加载失败';
  }
}

// 更新进度条
function updateProgress(current, total) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  document.getElementById('progressFill').style.width = percentage + '%';
  document.getElementById('progressLabel').textContent = `进度: ${percentage}%`;
}

// 显示进度条
function showProgress() {
  document.getElementById('progressContainer').style.display = 'block';
  updateProgress(0, 100);
}

// 隐藏进度条
function hideProgress() {
  document.getElementById('progressContainer').style.display = 'none';
}

// 异步快速点击函数（带进度报告）
async function fastClick(elementId, count, totalClicks, currentProgress) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: (elementId, count) => {
      const element = document.getElementById(elementId);
      if (!element) return;
      const link = element.getElementsByTagName('a')[0];
      if (!link) return;
      
      // 使用同步方式快速点击，避免异步兼容性问题
      for (let i = 0; i <= count; i++) {
        try {
          link.click();
        } catch (e) {
          console.error('点击失败:', e);
        }
      }
    },
    args: [elementId, count]
  });
  
  // 更新进度
  currentProgress += count;
  updateProgress(currentProgress, totalClicks);
}

// 页面加载时获取资源信息
document.addEventListener('DOMContentLoaded', () => {
  updateResourceInfo();
  
  // 监听来自content script的进度更新消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'progressUpdate') {
      updateProgress(request.current, request.total);
    }
  });
});

// 点击按钮事件
document.getElementById('clickButton').addEventListener('click', async () => {
  try {
    // 先更新资源信息
    await updateResourceInfo();
    
    // 获取需要点击的次数
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        function translateNumber(text) {
          const match = text.match(/(\d+(?:\.\d+)?)\s*K?/);
          if (!match) return 0;
          let count = parseFloat(match[1]);
          if (text.includes('K')) {
            count *= 1000;
          }
          return count;
        }
        
        function getResourceCount(elementId) {
          const element = document.getElementById(elementId);
          if (!element) return 0;
          const hadNumberText = element.textContent.trim().split('/')[0];
          const maxNumberText = element.textContent.trim().split('/')[1];
          const hadNumber = translateNumber(hadNumberText);
          const maxNumber = translateNumber(maxNumberText);
          return maxNumber - hadNumber;
        }
        
        return {
          food: getResourceCount('cntFood'),
          lumber: getResourceCount('cntLumber'),
          stone: getResourceCount('cntStone')
        };
      }
    });
    
    const counts = result[0].result;
    
    // 计算总点击次数
    const totalClicks = counts.food + counts.lumber + counts.stone;
    
    // 显示进度条
    showProgress();
    updateProgress(0, totalClicks);
    
    // 禁用按钮
    document.getElementById('clickButton').disabled = true;
    document.getElementById('clickButton').textContent = '点击中...';
    
    // 顺序执行点击，以便更新进度
    let currentProgress = 0;
    await fastClick('city-food', counts.food, totalClicks, currentProgress);
    currentProgress += counts.food;
    
    await fastClick('city-lumber', counts.lumber, totalClicks, currentProgress);
    currentProgress += counts.lumber;
    
    await fastClick('city-stone', counts.stone, totalClicks, currentProgress);
    
    // 点击完成后更新资源信息
    setTimeout(updateResourceInfo, 1000);
    
    // 隐藏进度条并恢复按钮
    setTimeout(() => {
      hideProgress();
      document.getElementById('clickButton').disabled = false;
      document.getElementById('clickButton').textContent = '开始点击';
    }, 1500);
    
  } catch (error) {
    console.error('点击失败:', error);
    // 出错时恢复按钮状态
    document.getElementById('clickButton').disabled = false;
    document.getElementById('clickButton').textContent = '开始点击';
    hideProgress();
  }
});