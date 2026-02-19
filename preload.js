const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
 ping: () => ipcRenderer.invoke('ping'),
 addReserva: (reserva) => ipcRenderer.invoke('add-reserva', reserva),
})