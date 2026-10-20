1. 文档和对话回复，请尽量使用 ASD-STE100 风格
2. help 是面向用户，保持简洁是重要的产品体验，能用代码防范（例如 xxx 命令参数不能为空，必须满足...之类）或在代码中注释的，就别在文档里说
3. help 文档，考虑用户打印时能每条命令 + 说明只占据一行、且排版对齐、美观：
   ```text
   <command> <arguments>  #<description>
   <command> <arguments>  #<description>
   ```
4. 开发和测试优先将临时过程文件放在系统临时目录下的 `swaw/banyan/<task>/`，完成后只清理本任务的过程文件；保留 CLI 固定目录和缓存，不要写仓库的 `.git`
5. 项目尚未发布，不要保留旧命令、配置或数据格式的兼容及自动迁移等逻辑；必要时一次性手动整理本机数据。
6. Changelog 只记录用户可见的变化、配置要求和实际修复，合并同类条目；不记录测试细节、测试夹具、纯内部重构、文件整理或开发过程。
7. 检测、测试用例方法脚本，先考虑是否可以通用化，放入 swaw-banyan skill，然后再考虑放站点 tests/
8. 使用 PATH 命令 gitbw.cmd .help、  ghbw.cmd .help 替代 git、gh（GitHub CLI）命令操作当前仓库
