const { app, dialog, Menu } = require('electron');

// actions: openDialog(), openRecent(path), clearRecent(), command(name)
function buildMenu({ recent, actions }) {
  const isMac = process.platform === 'darwin';

  const recentItems = recent.length
    ? [
        ...recent.map((filePath) => ({ label: filePath, click: () => actions.openRecent(filePath) })),
        { type: 'separator' },
        { label: 'Clear Recent Files', click: actions.clearRecent },
      ]
    : [{ label: 'No recent files', enabled: false }];

  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: actions.openDialog },
        { label: 'Open Recent', submenu: recentItems },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => actions.command('save') },
        { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: () => actions.command('save-as') },
        { label: 'Save Smaller Copy…', click: () => actions.command('save-smaller') },
        { label: 'Password…', click: () => actions.command('password') },
        { type: 'separator' },
        { label: 'Print…', accelerator: 'CmdOrCtrl+P', click: () => actions.command('print') },
        { type: 'separator' },
        { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: () => actions.command('close-tab') },
        { type: 'separator' },
        ...(isMac ? [{ role: 'close', accelerator: 'Shift+Cmd+W' }] : [{ role: 'quit', label: 'Exit' }]),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => actions.command('undo') },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Y', click: () => actions.command('redo') },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Shift+Z', visible: false, click: () => actions.command('redo') },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { type: 'separator' },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Find…', accelerator: 'CmdOrCtrl+F', click: () => actions.command('find') },
        { label: 'Find Next', accelerator: isMac ? 'Cmd+G' : 'F3', click: () => actions.command('find-next') },
        { label: 'Find Previous', accelerator: isMac ? 'Shift+Cmd+G' : 'Shift+F3', click: () => actions.command('find-previous') },
        { type: 'separator' },
        { label: 'Edit Text', accelerator: 'CmdOrCtrl+E', click: () => actions.command('edit-text') },
        { label: 'Redact', accelerator: 'CmdOrCtrl+Shift+X', click: () => actions.command('redact') },
        { label: 'Recognize Text (OCR)…', click: () => actions.command('ocr') },
        { label: 'Sign…', click: () => actions.command('sign') },
      ],
    },
    {
      label: 'Pages',
      submenu: [
        { label: 'Rotate Right', accelerator: 'CmdOrCtrl+R', click: () => actions.command('rotate-right') },
        { label: 'Rotate Left', accelerator: 'CmdOrCtrl+Shift+R', click: () => actions.command('rotate-left') },
        { type: 'separator' },
        { label: 'Copy Pages', click: () => actions.command('copy-pages') },
        { label: 'Cut Pages', click: () => actions.command('cut-pages') },
        { label: 'Paste Pages', click: () => actions.command('paste-pages') },
        { type: 'separator' },
        { label: 'Delete Pages', click: () => actions.command('delete-pages') },
        { label: 'Insert Blank Page', click: () => actions.command('insert-blank') },
        { label: 'Insert Pages from File…', click: () => actions.command('insert-from-file') },
        { label: 'Merge Files…', click: () => actions.command('merge-files') },
        { type: 'separator' },
        { label: 'Extract Pages…', click: () => actions.command('extract-pages') },
        { label: 'Split Document…', click: () => actions.command('split-document') },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', click: () => actions.command('zoom-in') },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', visible: false, click: () => actions.command('zoom-in') },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: () => actions.command('zoom-out') },
        { label: 'Actual Size', accelerator: 'CmdOrCtrl+0', click: () => actions.command('zoom-reset') },
        { label: 'Fit Width', accelerator: 'CmdOrCtrl+1', click: () => actions.command('fit-width') },
        { label: 'Fit Page', accelerator: 'CmdOrCtrl+2', click: () => actions.command('fit-page') },
        { type: 'separator' },
        { label: 'Show or Hide Sidebar', click: () => actions.command('toggle-sidebar') },
        { type: 'separator' },
        { label: 'Next Tab', accelerator: 'Ctrl+Tab', click: () => actions.command('next-tab') },
        { label: 'Previous Tab', accelerator: 'Ctrl+Shift+Tab', click: () => actions.command('prev-tab') },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(app.isPackaged ? [] : [{ type: 'separator' }, { role: 'toggleDevTools' }]),
      ],
    },
    // On Mac, About is in the Folio menu and the Window menu is standard.
    ...(isMac ? [{ role: 'windowMenu' }] : [{
      label: 'Help',
      submenu: [
        {
          label: 'About Folio',
          click: () => dialog.showMessageBox({
            type: 'info',
            title: 'About Folio',
            message: `Folio ${app.getVersion()}`,
            detail: 'A desktop PDF reader and editor.\nLicensed under AGPL-3.0.',
          }),
        },
      ],
    }]),
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

module.exports = { buildMenu };
