# Banyan 浏览器检查

在目标站点根目录调用已安装的 `swban.cmd`。参数、默认值和页面要求以任务的
`--help` 为准，检查范围见 Skill 的[浏览器说明](../.agents/skills/swaw-banyan/references/browser-site.md)。

```text
swban ensure/browser                                         #准备 Chromium
swban check/browser/site <build>                             #检查代表页面
swban check/browser/site <build> --updates                   #检查 SW 更新
swban check/browser/site <build> --updates --site <source>   #指定更新构建源码
swban check/browser/site <build> --trace --out <report>      #保存报告和 trace
swban check/browser/pwa/disable <enabled> --next <disabled>  #检查 SW 停用
swban check/browser/csp <build> --page <path>                #检查指定页面 CSP
swban check/browser/site --help                              #查看参数
```

检查服务已完成的构建，并应用其生成的 `_headers`。报告列出所选路径、失败项和
跳过范围；代表页面检查不覆盖每个页面或全部任务。普通 UI 检查阻止 SW，
需要实际 worker 的 PWA 和预取检查单独启用。

`--updates` 读取源码站点的正常配置，只覆盖构建版本，临时构建新版。
源码和受检产物须来自同一站点及配置。测试两次实际代码变化时，给单项 PWA
任务传入两份构建。默认临时产物在结束时清理；报告按 `--out` 选择保留位置。

派生配色角色及引擎敏感行为使用单项检查；已有 `.webkit` 入口复用同一契约。
业务文案、账户、品牌和专用旅程留在消费站，组合方式见
[任务维护](../.agents/skills/swaw-banyan/references/tasks.md#compose-a-site-suite)。
主题源码与故障 fixture 见 [tests/README.md](../tests/README.md)。
