module.exports = {
  apps: [{
    name: 'my-platform',
    script: 'node_modules/next/dist/bin/next',
    args: 'dev',
    cwd: 'c:\\git_repo\\homepageDev\\my-platform',
    watch: false,
    autorestart: false,
  }]
}
