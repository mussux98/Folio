// The single list of every IPC message. If it isn't listed here, it doesn't exist.
// CommonJS so the main process can load it. The sandboxed preload can't require
// local files, so it repeats these names and a test keeps both lists identical.
module.exports = Object.freeze({
  // renderer -> main, awaits a reply
  APP_READY: 'app:ready',
  DIALOG_OPEN: 'dialog:open',
  FILE_OPEN: 'file:open',
  FILE_READ: 'file:read',
  PRINT_RUN: 'print:run',
  DIALOG_SAVE: 'dialog:save',
  DIALOG_ASK_SAVE: 'dialog:ask-save',
  FILE_WRITE: 'file:write',
  WINDOW_CLOSE: 'window:close',
  SIGNATURES_LIST: 'signatures:list',
  SIGNATURES_ADD: 'signatures:add',
  SIGNATURES_REMOVE: 'signatures:remove',
  FONTS_FIND: 'fonts:find',
  PAGES_PICK_FILES: 'pages:pick-files',
  PAGES_PICK_PARTS: 'pages:pick-parts',
  // renderer -> main, fire and forget
  SESSION_SAVE: 'session:save',
  VIEW_SAVE: 'view:save',
  LINK_OPEN: 'link:open',
  DIRTY_SET: 'dirty:set',
  // main -> renderer
  FILE_OPENED: 'file:opened',
  MENU_COMMAND: 'menu:command',
});
