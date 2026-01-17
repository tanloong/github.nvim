// content.js

console.log("content.js is running."); // 检查脚本是否加载

// 创建第二个按钮：Listen Editor
const button2 = document.createElement('button');
button2.id = 'listen_editor';
button2.textContent = 'Listen Editor';
button2.style.position = 'fixed';
button2.style.top = '10px';
button2.style.left = '10px'; // 放在 To Editor 按钮旁边
button2.style.padding = '10px 20px';
button2.style.backgroundColor = '#007bff';
button2.style.color = 'white';
button2.style.border = 'none';
button2.style.borderRadius = '5px';
button2.style.cursor = 'pointer';
button2.style.zIndex = '1000'; // 确保按钮在最上层

// SSE 连接状态
let eventSource = null;
let isListening = false;

function close_sse() {
  eventSource.close();
  eventSource = null;
  isListening = false;
  button2.textContent = 'Listen Editor';
  button2.style.backgroundColor = '#007bff';

  sendNotification('编辑器断连')
  console.log('SSE connection closed.');
}

function notify_server_to_end_sse_session() {
  fetch('http://127.0.0.1:9001/close_sse', {
    method: 'POST'
  }).then(function (res) {
    console.log(res);
  })
}

function toggle_sse() {
  if (isListening) {
    // 如果正在监听，关闭 SSE 连接
    if (eventSource) {
      close_sse();
      notify_server_to_end_sse_session()
    }
  } else {
    // 如果未监听，建立 SSE 连接
    eventSource = new EventSource('http://127.0.0.1:9001/sse');

    // 监听服务器推送的消息
    eventSource.onmessage = function (event) {
      console.log(event.data);
      let data = JSON.parse(event.data)[0]
      switch (data["action"]) {//{{{
        // case "put":
        //   editor2browser(data);
        //   break;
        case "close_sse":
          close_sse();
          break;
        case "fetch_content":
          fetch_content(data);
          break;
        default:
          console.log('Unknown action:', data["action"]);
          break;
      };
    }//}}}

    // 处理错误
    eventSource.onerror = function (error) {
      console.log('EventSource failed:', error);
      // 发生错误时关闭连接
      close_sse();
    };

    isListening = true;
    button2.textContent = 'Stop Listening';
    button2.style.backgroundColor = '#dc3545';
    sendNotification("已连接到编辑器")
    console.log('SSE connection established.');
  }
}

// 切换 SSE 连接
button2.addEventListener('click', toggle_sse);
window.addEventListener('beforeunload', () => {if (eventSource) eventSource.close();});

// 将按钮添加到页面中
document.body.appendChild(button2);
// CTRL+SHIFT+H
document.addEventListener('keydown', function (event) {
  if (event.ctrlKey && event.shiftKey && event.key === 'H') {
    event.preventDefault();
    toggle_sse();
  }
});

const changeEvent = new Event('change', {
  bubbles: true,    // 事件是否冒泡
  cancelable: true  // 事件是否可以取消
});
const clickEvent = new Event('click', {
  bubbles: true,    // 事件是否冒泡
  cancelable: true  // 事件是否可以取消
});

// function editor2browser(data) {
//   let root = get_root()
//   var section, subsection, section_head, section_body, section_tail, label, containers, elem
//   // 创建一个 input 事件
//   for (let i = 0; i < root.children.length; i++) {
//     section = root.children[i].children[0];
//     [section_head, section_body, section_tail] = section.children;
//     label = section_head.querySelector('span').textContent.trim();
//     if (label in data) { // find target section
//       containers = section_body.querySelectorAll(".neeko-container");
//       containers.forEach(container => {
//         if (container.querySelectorAll(".neeko-text").length !== 2) {return;}
//
//         subsection = container.querySelector(".neeko-text")?.textContent.trim();
//         if (subsection in data[label]) { // find target subsection
//           elem = container.querySelector("textarea");
//           if (typeof elem == 'undefined' || elem == null) {return;}
//           elem.value = data[label][subsection];
//           // 触发输入事件，模拟手输
//           elem.dispatchEvent(changeEvent);
//         }
//       });
//     }
//   };
// }

function nvim_log(msg, level = "INFO") {
  fetch('http://127.0.0.1:9001/log', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({msg: msg, level: level})
  })
}

// 提取通用功能
function extractTitleAndNumber() {
  let ret = {};
  let md_title_el = document.querySelector('.markdown-title');
  if (md_title_el) {
    ret.title = md_title_el.textContent.trim();
    let num_el = md_title_el.nextElementSibling;
    ret.num = num_el ? num_el.textContent.trim() : '#Unknown';
  } else {
    ret.title = 'Untitled';
    ret.num = '#Unknown';
  }
  return ret;
}

function extractComments(selector, getAuthorFn) {
  const commentContainers = Array.from(document.querySelectorAll(selector));
  const comments = [];

  for (const container of commentContainers) {
    const author = getAuthorFn(container);
    
    const contentEl = container.querySelector('.markdown-body');
    const content = contentEl ? contentEl.innerText.trim() : '';

    // 提取时间
    const timeEl = container.querySelector('relative-time');
    const timestamp = timeEl ? 
      (timeEl.getAttribute('datetime') || timeEl.title || timeEl.textContent) : 
      null;

    if (content) {
      comments.push({ author, content, timestamp });
    }
  }

  return comments;
}

// Issue 特定的作者提取函数
function getIssueAuthor(container) {
  let comment_header = container.querySelector("[data-testid='comment-header']");
  if (!comment_header) return 'Unknown';
  
  let author_lhs = comment_header.querySelector(".sr-only")?.textContent.trim().split(' ')[0] || 'Unknown';
  let author_rhs = '';
  
  const badgesContainer = comment_header.querySelector('[class*="BadgesGroupContainer"]');
  if (badgesContainer) {
    author_rhs = Array.from(badgesContainer.children)
      .map(child => child.textContent.trim())
      .join(', ');
  }
  
  return author_lhs + (author_rhs ? ` (${author_rhs})` : '');
}

// PR 特定的作者提取函数
function getPRAuthor(container) {
  let author_lhs = container.querySelector(".author")?.textContent.trim() || 'Unknown';
  let author_rhs = '';
  
  const dNoneElement = container.querySelector('.d-flex > .d-none');
  if (dNoneElement) {
    author_rhs = Array.from(dNoneElement.children)
      .map(child => child.textContent.trim())
      .join(', ');
  }
  
  return author_lhs + (author_rhs ? ` (${author_rhs})` : '');
}

// 改进的异步 expand 函数
async function expand_hidden_items(pr) {
  return new Promise((resolve) => {
    let selector = pr ? 
      'button.ajax-pagination-btn' : 
      'button[type="button"][data-testid="issue-timeline-load-more-load-top"]';
    
    let maxAttempts = 30;
    let attempts = 0;
    
    const intervalId = setInterval(() => {
      attempts++;
      const button = document.querySelector(selector);
      
      if (button) {
        // 检查按钮是否可用
        if (button.getAttribute('aria-disabled') !== 'true' && 
            button.getAttribute('data-loading') !== 'true' &&
            !button.disabled) {
          console.log(`找到按钮，点击中... (尝试 ${attempts})`);
          button.click();
        }
      } else {
        console.log('按钮已消失，停止点击');
        clearInterval(intervalId);
        resolve(true);
      }
      
      // 安全限制，防止无限循环
      if (attempts >= maxAttempts) {
        console.log('达到最大尝试次数，停止点击');
        clearInterval(intervalId);
        resolve(false);
      }
    }, 1500); // 稍微增加间隔，给页面加载时间
  });
}

function _fetch_issue() {
  let ret = extractTitleAndNumber();

  // 提取正文
  const issueBodyContainer = document.querySelector('.react-issue-body');
  if (issueBodyContainer) {
    const bodyMarkdown = issueBodyContainer.querySelector('.markdown-body');
    ret.body = bodyMarkdown ? bodyMarkdown.innerText.trim() : '';
  } else {
    ret.body = '';
  }

  // 提取评论
  ret.comments = extractComments('.react-issue-comment', getIssueAuthor);

  return ret;
}

function _fetch_pr() {
  let ret = extractTitleAndNumber();

  // 提取正文
  const bodyElement = document.querySelector('.timeline-comment-group .markdown-body');
  ret.body = bodyElement ? bodyElement.innerText.trim() : '';

  // 提取评论
  ret.comments = extractComments('.timeline-comment-group', getPRAuthor);

  return ret;
}

// 主函数
async function fetch_content(data) {
  try {
    let pr = window.location.pathname.includes('/pull/');
    
    console.log('开始展开隐藏内容...');
    const expandSuccess = await expand_hidden_items(pr);
    
    if (!expandSuccess) {
      console.warn('展开隐藏内容可能未完全完成，继续处理...');
    }
    
    console.log('开始提取内容...');
    let ret = pr ? _fetch_pr() : _fetch_issue();
    
    // 添加回调标识
    ret.callback = data["callback"];
    
    console.log('内容提取完成，发送到服务器...');
    
    // 发送给本地服务
    const response = await fetch('http://127.0.0.1:9001/fetch_content', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ret)
    });
    
    if (response.ok) {
      console.log('GitHub 内容已成功发送到服务器');
    } else {
      console.error('服务器响应错误:', response.status);
    }
    
  } catch (err) {
    console.error('处理过程中发生错误:', err);
  }
}

//////////////////////////////////NOTIFICATION//////////////////////////////////

// https://segmentfault.com/a/1190000041982599
function sendNotification(title, body, icon, callback) {
  // 先检查浏览器是否支持
  if (!('Notification' in window)) {
    // IE浏览器不支持发送Notification通知!
    return;
  }

  if (Notification.permission === 'denied') {
    // 如果用户已拒绝显示通知
    return;
  }

  if (Notification.permission === 'granted') {
    //用户已授权，直接发送通知
    notify();
  } else {
    // 默认，先向用户询问是否允许显示通知
    Notification.requestPermission(function (permission) {
      // 如果用户同意，就可以直接发送通知
      if (permission === 'granted') {
        notify();
      }
    });
  }

  function notify() {
    let notification = new Notification(title, {
      icon: icon,
      body: body
    });
    notification.onclick = function () {
      callback && callback();
      //console.log('单击通知框')
    }
    //notification.onclose = function () {
    //  console.log('关闭通知框');
    //};

    // 设置1秒后自动关闭通知
    setTimeout(() => {
      notification.close();
    }, 1000); // 1000毫秒 = 1秒
  }
}
