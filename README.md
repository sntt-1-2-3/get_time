# 拾光 · 生活记录

简洁温暖的个人记录应用，支持便签、照片、心情、目标和步骤、日历、月度回顾、Markdown 年终手记、备份和提醒。

## iPhone 使用

用 Safari 打开发布后的 HTTPS 网址，点击“分享 → 添加到主屏幕”。添加后，从手机桌面的拾光图标联网打开一次，等界面和资源加载完成，再断网使用。应用资源完成缓存后可离线打开；首次安装和获取新版本需要联网。

数据保存在当前设备的 IndexedDB 中，不会上传到 GitHub。电脑、Safari 和主屏幕应用之间不会自动同步，请定期导出完整备份。

从旧的拾光网址迁移时，先在旧版“备份与设置”里导出完整备份，再到新网址导入。不同网址的浏览器存储彼此独立，旧数据不会自动出现在新网址。

iPhone 网页应用打开时可以显示到期提醒，关闭后错过的提醒将在下次打开时补提醒。当前版本没有后台推送服务。

## 发布独立 GitHub Pages 网站

1. 解压离线包。包里的 index.html、app.js、styles.css、service-worker.js、manifest.webmanifest、app-icon.png、icon.svg、.nojekyll 和 README.md 都是发布文件。
2. 打开准备好的 GitHub 仓库，点击 Add file → Upload files，将解压后的文件上传到仓库根目录，然后点击 Commit changes。不要直接上传 ZIP；根目录应当直接看得到 index.html。
3. 进入 Settings → Pages。在 Build and deployment 下，将 Source 设为 Deploy from a branch，Branch 选择 main，目录选择 / (root)，点击 Save。若仓库默认分支不是 main，就选择实际上传文件的分支。
4. 等 GitHub 发布完成后，Pages 页面会显示网站地址。使用这个网站地址，不要使用仓库的 github.com 地址。
5. 按上面的 iPhone 使用步骤添加到主屏幕。

GitHub 免费账号通常需要使用公开仓库开启 Pages。代码和示例记录会公开；你后来在应用中写的个人记录不会随代码上传。官方说明：https://docs.github.com/en/pages/quickstart

如果网站刚发布时返回 404，可以稍后刷新，并在仓库的 Actions 页面查看 Pages 发布是否完成。不要把旧版的个人备份文件上传到仓库；请在应用内导入它。

## 放入已有 GitHub Pages 网站

将这些应用文件放在已有发布分支的独立 shiguang 目录中，保留原网站首页和发布配置。所有资源路径均为相对路径，Service Worker 的缓存和控制范围仅限当前应用目录。

本项目没有构建步骤、外部字体、统计工具或第三方运行时请求。仅应用代码需要发布，不要把个人备份文件上传到公开仓库。
