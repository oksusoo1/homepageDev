module.exports = {
  apps: [{
    name: 'my-platform',
    script: 'C:\\Windows\\System32\\cmd.exe',
    args: '/c npm run dev',
    cwd: 'c:\\git_repo\\homepageDev\\my-platform',
    watch: false,
    autorestart: false,
  }]
}
