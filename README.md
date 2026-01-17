将 GitHub Issue 和 PR 页面加载到 Neovim buffer 里。

## 依赖

1. python

## 安装

1. 

```
git clone https://github.com/tanloong/github.nvim
```

2. 
在浏览器添加未打包的扩展程序，目录就是克隆下来的项目根目录。

3.

将项目根目录添加到 runtimepath:

```
let &runtimepath.=',/path/to/github.nvim'
```

4. 
运行 `:UpdateRemotePlugins` 来注册 python 插件提供的函数
运行 `lua require("bite")` 来加载 lua 插件

## 使用

打开一个 Neovim 实例，运行 `:B start_server` 开始监听 `localhost:9001` 端口，然后打开一个 GitHub Issue 或 PR 页面，点击左上角出现的 Listen editor 按钮，再回到 Neovim 运行 `:B fetch_content`，Issues/PR 内容就会加载到 Neovim 里。要关闭时，在 Neovim 运行 `:B stop_server`。
