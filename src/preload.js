const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cherry', {
  onCalendarEvent: callback => {
    const listener = (_event, id) => callback(id);
    ipcRenderer.on('cherry:calendar-event', listener);
    return () => ipcRenderer.removeListener('cherry:calendar-event', listener);
  },
  getState: () => ipcRenderer.invoke('cherry:state'),
  command: (action, payload) => ipcRenderer.invoke('cherry:command', action, payload),
  onState: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('cherry:state', listener);
    return () => ipcRenderer.removeListener('cherry:state', listener);
  },
  onFocusAddress: callback => {
    const listener = () => callback();
    ipcRenderer.on('cherry:focus-address', listener);
    return () => ipcRenderer.removeListener('cherry:focus-address', listener);
  },
  onPalette: callback => {
    const listener = () => callback();
    ipcRenderer.on('cherry:palette', listener);
    return () => ipcRenderer.removeListener('cherry:palette', listener);
  },
});
