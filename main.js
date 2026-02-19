const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.loadURL("http://localhost:5173");
  //  win.loadFile(path.join(__dirname,'vite-project', 'dist', 'index.html'));
 
};
app.whenReady().then(() => {
    require('./database/database.js');
    require('./database/gastos.js');
     require('./IA/cerebro.js');
    createWindow()
})
console.log("DB PATH:", app.getPath("userData"));

