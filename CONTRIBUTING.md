# 团队协作指南

## 团队统一提交入口

团队主仓库为 [x1t1h1/-](https://github.com/x1t1h1/-)，由 `x1t1h1` 维护。项目原型设计及主要内容由 `x1t1h1` 完成；各成员保留自己的实际贡献记录。

协作流程：成员把修改上传到本仓库的个人开发分支（单独存放本次修改），再发起 Pull Request（合并申请），由 `x1t1h1` 检查并确认后纳入 `main` 正式版本。成员自己的仓库如保留项目副本，应注明本项目来源并链接到上述主仓库。

仓库所有者在 GitHub 的 Settings → Collaborators 中邀请成员，成员接受邀请后才能直接上传开发分支。公开可访问不等于拥有上传权限。这里约定的是团队协作流程；是否启用限制直接修改 `main` 的保护规则，以 GitHub 实际设置为准。

### 已经下载过其他仓库的成员

先保存工作并查看当前状态、上传地址：

```powershell
git status
git remote -v
```

如果 `origin` 指向其他仓库，可在现有项目文件夹中改为团队主仓库并获取其版本记录：

```powershell
git remote set-url origin https://github.com/x1t1h1/-.git
git fetch origin
```

修改上传地址不会自动上传文件，也不会改写代码。切换分支前，应先把正在进行的修改保存为本地提交；不确定时请仓库维护者协助。若同步提示历史分叉或存在冲突，先共同核对，勿强制推送覆盖已有记录。

## 安装和启动

安装 Node.js（含 npm）与 Git。首次加入项目时下载团队主仓库并安装依赖：

```powershell
git clone https://github.com/x1t1h1/-.git thermolearn-demo
cd thermolearn-demo
npm.cmd ci
npm.cmd run dev
```

浏览器访问 http://127.0.0.1:5173。演示期间保持服务窗口开启，结束按 Ctrl+C。macOS/Linux 将 `npm.cmd` 替换为 `npm`。依赖锁定文件应保留，无需自行升级依赖。

## 一次修改的协作流程

1. 开始前阅读 README.md 与 AGENTS.md，确认修改范围。
2. 同步主分支并新建自己的功能分支：

```powershell
git switch main
git pull --ff-only origin main
git switch -c codex/your-change
```

3. 小范围修改后运行相关检查；提交前查看 `git status` 与 `git diff`，确认不包含私密资料。
4. 明确添加本次文件后提交，并推送功能分支：

```powershell
git add src/data/course.ts
git commit -m "说明本次修改的目的"
git push -u origin codex/your-change
```

上面的文件名和分支名是示例，替换为实际内容。然后在 GitHub 创建 Pull Request，确认目标仓库为 `x1t1h1/-`、目标分支为 `main`，由 `x1t1h1` 检查并确认后合并。没有写权限的成员可从主仓库创建 Fork（自己的项目副本），再向主仓库发起 Pull Request。

## 提交前检查

```powershell
node scripts/check-content.mjs
npm.cmd run typecheck
npm.cmd run build
```

内容、媒体或 PDF 变化需运行内容检查；TypeScript/Vue 变化需类型检查；页面结构、构建配置变化需构建。文档改完重读。UI 改动说明实际检查的浏览器尺寸，未实际运行时明确说明。

## 内容与资源

课程运行数据只改 `src/data/course.ts`，不要随意更改已有 ID；题目答案下标从 0 开始。网课变更同时维护目录快照和关联清单。本地媒体保持 `/static/media/` 访问方式，PDF 保持 `/static/courseware/`。

不要提交 node_modules、dist、账号凭证、密钥、原始申报 Word 或个人学习记录。新增教学资料需要确认来源与公开权限，不为第三方资料擅自附加开源许可。后端、AI 等规划功能必须标明尚未实现。
