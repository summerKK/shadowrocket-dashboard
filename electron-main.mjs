import { app, BrowserWindow, shell, Menu } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer, stopServer } from './server.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow = null;
let currentPort = 8787;

async function createWindow(port) {
  currentPort = port;
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1020,
    minHeight: 680,
    title: 'Shadowrocket Connections Dashboard',
    icon: path.join(__dirname, 'build', 'icon.png'),
    backgroundColor: '#090d16',
    titleBarStyle: 'hiddenInset',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  // Load local dashboard with electron flag
  await mainWindow.loadURL(`http://127.0.0.1:${port}?electron=1`);

  // Open external links in user's default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac
      ? [
          {
            label: 'Shadowrocket Dashboard',
            submenu: [
              { role: 'about', label: '关于 Shadowrocket Dashboard' },
              { type: 'separator' },
              { role: 'services', label: '系统服务' },
              { type: 'separator' },
              { role: 'hide', label: '隐藏应用' },
              { role: 'hideOthers', label: '隐藏其他' },
              { role: 'unhide', label: '显示全部' },
              { type: 'separator' },
              { role: 'quit', label: '退出 Shadowrocket Dashboard' },
            ],
          },
        ]
      : []),
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载页面' },
        { role: 'forceReload', label: '强制刷新' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '切换全屏' },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'zoom', label: '缩放' },
        { role: 'close', label: '关闭窗口' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: 'GitHub 开源仓库',
          click: async () => {
            await shell.openExternal('https://github.com/summerKK/shadowrocket-dashboard');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(async () => {
  setupMenu();

  try {
    const { port } = await startServer(8787).catch(async () => {
      // If 8787 is occupied, listen on any free port
      return await startServer(0);
    });
    await createWindow(port);
  } catch (err) {
    console.error('Failed to launch application:', err);
    app.quit();
  }

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow(currentPort);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  await stopServer();
});
