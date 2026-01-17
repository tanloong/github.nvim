#!/usr/bin/env lua

local autocmd = vim.api.nvim_create_autocmd
local augroup = vim.api.nvim_create_augroup

local _H = {}
local M = {
  _H = _H,
  _orig_mappings = {},
  _is_mappings_on = false,
  _match_ids = {},
  cmd = {},
}

---@param key string
---@param mode string|string[]
---@return nil
_H.store_orig_mapping = function(key, mode)
  if type(mode) == "string" then
    table.insert(M._orig_mappings, vim.fn.maparg(key, mode, false, true))
  else
    for _, m in ipairs(mode) do
      table.insert(M._orig_mappings, vim.fn.maparg(key, m, false, true))
    end
  end
end

M.cmd.start_server = vim.fn["BiteStartServer"]
M.cmd.stop_server = vim.fn["BiteStopServer"]

---Turns on/off interval audio.
M.cmd.toggle = function() vim.fn["BiteSendData"] { action = "toggle" } end

M.cmd.back = function() vim.fn["BiteSendData"] { action = "back", count = vim.v.count1 } end

_H.callback_dict2buf = function(data, buf)
  if buf == nil then buf = 0 end

  local lines = {}

  -- Title
  table.insert(lines, "# " .. (data.title or "Untitled") .. " " .. (data.num or "#Unknown number"))
  table.insert(lines, "")

  -- Body
  if data.body and data.body ~= "" then
    table.insert(lines, "## Issue Description")
    table.insert(lines, "")

    for line in data.body:gmatch "[^\r\n]+" do
      table.insert(lines, line)
    end
    table.insert(lines, "")
  end

  -- Comments
  if data.comments and #data.comments > 0 then
    table.insert(lines, "## Comments (" .. tostring(#data.comments) .. ")")
    table.insert(lines, "")

    for i, comment in ipairs(data.comments) do
      local author = comment.author or "unknown"
      local timestamp = comment.timestamp or ""
      local content = comment.content or ""

      table.insert(lines, string.format("### Comment %d @%s %s", i, author, timestamp))
      table.insert(lines, "")

      for line in content:gmatch "[^\r\n]+" do
        table.insert(lines, line)
        table.insert(lines, "")
      end
    end
  end

  vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)
end

M.cmd.fetch_content = function()
  vim.fn["BiteSendData"] { action = "fetch_content", callback = "callback_dict2buf" }
end

_H.callback = function(data)
  local func = _H[data.callback]
  if func == nil then func = M.cmd[data.callback] end
  if func == nil then
    vim.notify("找不到回调函数: " .. data.callback, vim.log.levels.ERROR)
    return
  end
  data.callback = nil
  func(data)
end

---@param section string|integer
---@param subsection string|nil
_H.jump_to = function(section, subsection)
  vim.fn.search(string.format("^# %s$", section), "cw")
  if subsection ~= nil then
    vim.fn.search(string.format("^## %s$", subsection), "cW")
  end
end

local opt = { buffer = true, nowait = true, noremap = true }
M.config = {
  keymaps = {
    { "n", "<space>", M.cmd.toggle, opt },
    { "n", "<c-s-h>", vim.fn["BiteToggleServer"], opt },
  }
}

M.cmd.enable_keybindings = function()
  if M._is_mappings_on then
    vim.notify "Keybindings already on, nothing to do"
    return
  end
  if M.config.keymaps == nil then return end

  local mode, lhs, rhs, opts
  for _, entry in ipairs(M.config.keymaps) do
    mode, lhs, rhs, opts = unpack(entry)
    _H.store_orig_mapping(lhs, mode)
    vim.keymap.set(mode, lhs, rhs, opts)
  end

  vim.notify "Keybindings on"
  M._is_mappings_on = true
end

M.cmd.disable_keybindings = function()
  if not M._is_mappings_on then
    vim.notify "Keybindings already off, nothing to do"
    return
  end

  if M.config.keymaps ~= nil then
    local mode, lhs, _
    for _, entry in ipairs(M.config.keymaps) do
      mode, lhs, _, _ = unpack(entry)
      pcall(vim.api.nvim_buf_del_keymap, 0, mode, lhs)
    end
  end
  for _, mapargs in ipairs(M._orig_mappings) do
    if next(mapargs) ~= nil then
      mapargs.buffer = true
      vim.fn.mapset(mapargs)
    end
  end
  vim.notify "Keybindings off"
  M._is_mappings_on = false
  M._orig_mappings = {}
end

M.cmd.reload = function()
  local pkg_name = "bite"
  for k, _ in pairs(package.loaded) do
    if k:sub(1, #pkg_name) == pkg_name then package.loaded[k] = nil end
  end
  vim.api.nvim_del_user_command "B"
  require(pkg_name)
  vim.print(pkg_name .. " reloaded at " .. os.date "%H:%M:%S")
end

vim.api.nvim_create_user_command("B", function(a)
  ---@type string[]
  local actions = a.fargs
  local cmd = M.cmd[actions[1]]
  if cmd ~= nil then
    table.remove(actions, 1)
    return cmd(unpack(actions))
  end
end, {
  complete = function(_, line)
    local args = vim.split(vim.trim(line), "%s+")
    if vim.tbl_count(args) > 2 then
      return
    end
    table.remove(args, 1)
    ---@type string
    local prefix = table.remove(args, 1)
    if prefix and line:sub(-1) == " " then
      return
    end
    local cmds = vim.tbl_keys(M.cmd)
    if not prefix then
      return cmds
    else
      return vim.fn.matchfuzzy(cmds, prefix)
    end
  end,
  nargs = "*"
})

return M
