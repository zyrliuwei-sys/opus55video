# EvoLink 管理后台接入包

在 `/admin/settings` → **AI** 标签页加一张 **EvoLink** 卡片，和 OpenAI / Fal 一样：

- **Base URL**：默认 `https://direct.evolink.ai/v1`（兼容 OpenAI）
- **API Key**：在 <https://evolink.ai/dashboard/keys> 创建
- **Test 按钮**：调用 `GET /v1/models` 验证 Key，不消耗额度

保存后在服务端用 `configs.evolink_api_key` / `configs.evolink_base_url` 读取（和 `fal_api_key` 的读取方式一样）。

## 一键安装到其他项目

把整个 `integrations/evolink/` 文件夹复制到目标项目根目录，然后：

```bash
node integrations/evolink/install.mjs
```

也可以不复制，直接在当前项目里指定目标路径：

```bash
node integrations/evolink/install.mjs /path/to/other-project
```

之后运行 `pnpm build` 确认通过即可，不需要改数据库。

## 脚本会改哪些文件

| 文件                                        | 改动                                 |
| ------------------------------------------- | ------------------------------------ |
| `src/modules/config/settings.ts`            | 在 Fal 后面加 EvoLink 分组和两个字段 |
| `src/modules/config/settings-test-specs.ts` | 注册 Test 按钮                       |
| `src/modules/config/settings-test.ts`       | 增加 `testEvolink()`                 |
| `messages/en.json`、`messages/zh.json`      | 分组标题、描述、字段名翻译           |

- 改动前会把原文件备份到 `<目标项目>/.evolink-backup/<时间>/`，要撤销就把备份拷回去。
- 可以重复运行：已经包含 evolink 的文件会自动跳过。
- 要求目标项目是 ShipAny（TanStack 版），并且后台已有 Fal 配置（脚本以它为插入位置）。找不到插入位置时，脚本会报错退出，不会改动任何文件。
