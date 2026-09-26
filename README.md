# Nanaki

保留原站 Slate 的深灰页头、浅灰正文与整体风格，首页入口使用深灰色，右侧展示立体旋转的缺边六边形。公开首页 + 带密码的「具象内容」。纯静态网页，继续使用原来的 GitHub Pages 网址。

## 本地查看

```powershell
cd D:\Workspace-1\xfyan0408.github.io
npm install
npm run preview
```

打开 <http://127.0.0.1:4173>，点击「具象内容」查看密码页。

当前 `private/index.html` 已使用选定的访问密码加密，解锁后只有标注为「预览内容」的示例。添加正式内容时，编辑仓库外的私密正文并重新生成加密页面。

## 修改内容

- 公开首页：`index.html`
- 原站 Slate 样式：`assets/css/style.css`（从现有线上网站保存）
- 私密入口和密码表单的补充样式：`assets/site.css`
- 首页六边形的立体旋转：`assets/hexagon.js`（原生 SVG，无额外依赖；支持减少动态效果）
- 密码页外观：`tools/password-template.html`
- 私密正文：**仓库外**的 `D:\Workspace-1\xfyan0408-private\index.html`

私密正文改好后运行：

```powershell
npm run lock
```

根据提示输入访问密码，生成 `private/index.html`。使用至少 16 位的随机密码。密码无需写进代码、命令参数或 Git；StatiCrypt 也支持通过本地环境变量 `STATICRYPT_PASSWORD` 接收密码。

再运行 `npm run preview`，确认空密码、错误密码不能解锁，正确密码显示预期内容。刷新页面或点击「锁定」会重新锁定，不记住密码。

## 发布范围

本地预览服务只提供首页、加密页和样式，不提供草稿、Git 元数据或维护工具。

私密原文保存在仓库外，只发布加密后的 HTML。不要把原文、密码、私密图片或 PDF 提交到公开仓库；单独上传的附件不会自动得到密码保护。已经公开过的历史内容不能通过后加密码撤回。

`.nojekyll` 让 GitHub Pages 直接发布静态页面，不需要服务器、数据库或账号系统。保留 `_config.yml` 作为旧主题配置，不参与新页面渲染。

页面加密使用 [StatiCrypt 3.5.4](https://github.com/robinmoisson/staticrypt)。
