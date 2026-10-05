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
        { label: 'Print…', accelerator: 'CmdOrCtrl+P', click: () => actions.command('print') },
        { type: 'separator' },
        { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: () => actions.command('close-tab') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit', label: 'Exit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { type: 'separator' },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Find…', accelerator: 'CmdOrCtrl+F', click: () => actions.command('find') },
        { label: 'Find Next', accelerator: 'F3', click: () => actions.command('find-next') },
        { label: 'Find Previous', accelerator: 'Shift+F3', click: () => actions.command('find-previous') },
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
    {
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
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

module.exports = { buildMenu };
