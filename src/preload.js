const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('elysium', {
  onCalendarEvent: callback => {
    const listener = (_event, id) => callback(id);
    ipcRenderer.on('elysium:calendar-event', listener);
    return () => ipcRenderer.removeListener('elysium:calendar-event', listener);
  },
  getState: () => ipcRenderer.invoke('elysium:state'),
  command: (action, payload) => ipcRenderer.invoke('elysium:command', action, payload),
  onState: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('elysium:state', listener);
    return () => ipcRenderer.removeListener('elysium:state', listener);
  },
  onFocusAddress: callback => {
    const listener = () => callback();
    ipcRenderer.on('elysium:focus-address', listener);
    return () => ipcRenderer.removeListener('elysium:focus-address', listener);
  },
  onPalette: callback => {
    const listener = () => callback();
    ipcRenderer.on('elysium:palette', listener);
    return () => ipcRenderer.removeListener('elysium:palette', listener);
  },
  onFindOpen: callback => {
    const listener = () => callback();
    ipcRenderer.on('elysium:find-open', listener);
    return () => ipcRenderer.removeListener('elysium:find-open', listener);
  },
  onFoundInPage: callback => {
    const listener = (_event, result) => callback(result);
    ipcRenderer.on('elysium:found-in-page', listener);
    return () => ipcRenderer.removeListener('elysium:found-in-page', listener);
  },
  onToast: callback => {
    const listener = (_event, message) => callback(message);
    ipcRenderer.on('elysium:toast', listener);
    return () => ipcRenderer.removeListener('elysium:toast', listener);
  },
});
