const { dialog } = require('@electron/remote')
const fs = require('fs')

async function handleOpenFileOrFolder(mode = 'file') {
  const properties = mode === 'folder' ? ['openDirectory'] : ['openFile']
  const filters = mode === 'folder' ? [] : [{ name: 'Images', extensions: ['jpg', 'png'] }]

  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties,
    filters
  })

  if (canceled || filePaths.length === 0) {
    return null
  }

  const selectedPath = filePaths[0]
  const stat = fs.statSync(selectedPath)

  return {
    path: selectedPath,
    type: stat.isDirectory() ? 'directory' : 'file'
  }
}

async function handleErrorOpen(content) {
  dialog.showErrorBox('Error', content)
}

window.electronAPI = {
  openFileOrFolder: (mode) => handleOpenFileOrFolder(mode),
  showError: (content) => handleErrorOpen(content)
}
