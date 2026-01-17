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


function fetch_content(data) {
  const ret = {};

  // --- 1. 提取 Issue 标题 ---
  const titleEl = document.querySelector('h1[data-component="PH_Title"] bdi.markdown-title');
  ret.title = titleEl ? titleEl.textContent.trim() : 'Untitled';

  // --- 2. 提取 Issue 正文（第一个 .react-issue-body）---
  const issueBodyContainer = document.querySelector('.react-issue-body');
  if (issueBodyContainer) {
    const bodyMarkdown = issueBodyContainer.querySelector('.markdown-body');
    ret.body = bodyMarkdown ? bodyMarkdown.innerText.trim() : '';
  } else {
    ret.body = '';
  }

  // --- 3. 提取所有评论（包括 issue body 之后的所有）---
  const commentContainers = Array.from(document.querySelectorAll('.react-issue-comment'));
  ret.comments = [];

  for (const container of commentContainers) {
    let comment_header = container.querySelector("[data-testid='comment-header']");
    let author_lhs = comment_header.querySelector(".sr-only").textContent; 
    let author_rhs = Array.from(comment_header.querySelector('[class*="BadgesGroupContainer"]').children).map(child => child.textContent.trim()).join(', ');
    const author = author_lhs + ('(' + author_rhs + ')' ? ` (${author_rhs})` : '');
    
    const contentEl = container.querySelector('.markdown-body');
    const content = contentEl ? contentEl.innerText.trim() : '';

    // 尝试提取时间（相对时间文本）
    const timeEl = container.querySelector('relative-time');
    const timestamp = timeEl ? timeEl.getAttribute('datetime') || timeEl.title || timeEl.textContent : null;

    if (content) {
      ret.comments.push({ author, content, timestamp });
    }
  }

  // --- 4. 添加回调标识 ---
  ret.callback = data["callback"];
  console.log(ret);

  // --- 5. 发送给本地服务 ---
  fetch('http://127.0.0.1:9001/fetch_content', {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ret)
  }).then(function (res) {
    console.log('GitHub issue content sent to server:', res.ok);
  }).catch(err => {
    console.error('Failed to send issue content:', err);
  });
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
