# Skills 文件夹说明

这个文件夹用于存放自定义的 Claude Code Skills。

## 什么是 Skills？

Skills 是可以被 Claude Code 调用的自定义命令或工作流。你可以在这里编写特定于项目的自动化任务。

## 如何创建 Skill？

1. 在此文件夹创建一个 `.md` 文件
2. 文件名即为 skill 名称（例如 `deploy.md` → `/deploy` 命令）
3. 在文件中编写 skill 的说明和步骤

## Skill 文件格式示例

```markdown
# Deploy Skill

部署应用到生产环境

## 步骤

1. 运行测试确保所有测试通过
2. 构建生产版本
3. 上传到服务器
4. 重启服务

## 注意事项

- 部署前确保已提交所有更改
- 检查环境变量配置
```

## 使用方法

在 Claude Code 中输入 `/skill-name` 即可调用对应的 skill。

## 项目相关 Skills 建议

你可以为这个项目创建以下 skills：

- `test.md` - 运行所有测试
- `build.md` - 构建生产版本
- `deploy.md` - 部署到服务器
- `cache-clear.md` - 清除所有缓存
- `db-migrate.md` - 数据库迁移

根据项目需要自由添加！
