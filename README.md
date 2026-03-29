# Galgame Launcher

沉浸式 Galgame 启动器，为视觉小说玩家打造。

## 特性

- **沉浸式焦点视图** — 全屏视频/背景 + Logo + 一键启动，5秒无操作自动隐藏 UI
- **Steam 风格游戏库** — 竖版 2:3 封面网格，3D 翘起悬浮效果
- **自动获取资源** — 从 Bangumi、VNDB、SteamGridDB 自动下载封面、Logo、背景
- **视频自动转码** — 不支持的格式 (WMV/MPEG/MKV 等) 自动转码为 H.264 MP4
- **主题色跟随** — 从游戏封面提取主色调，动态调整全局强调色
- **浮动粒子特效** — 氛围光粒子，颜色跟随主题色
- **毛玻璃 UI** — 封面条和菜单使用半透明毛玻璃效果
- **游戏管理** — 右键菜单更改封面/背景/视频/Logo/exe/改名/隐藏

## 截图

> 截图待添加

## 下载

前往 [Releases](https://github.com/zerotwo254/galgame-launcher/releases) 下载最新版本。

## 使用方法

1. 解压到任意位置
2. 运行 `Galgame Launcher.exe`
3. 首次启动选择游戏库文件夹（如 `D:\galgame`）
4. 等待扫描完成，封面和 Logo 会自动下载
5. 点击底部封面切换游戏，右下角按钮启动

## 技术栈

- Electron 33 + React 18 + Vite 6
- Tailwind CSS + Framer Motion + Zustand
- FFmpeg (视频转码)

## 开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
# 输出: dist/win-unpacked/
```

## License

MIT
