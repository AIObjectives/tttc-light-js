# 与城市对话

<!-- hy-mt2-i18n:start -->
[English](./README.md) | **中文** | [日本語](./README_ja.md) | [Español](./README_es.md)
<!-- hy-mt2-i18n:end -->


[Talk to the City (T3C)](https://ai.objectives.institute/talk-to-the-city) 是一款开源的、基于大语言模型的 SaaS 工具，它能够通过分析详细的定性数据来提升群体的讨论与决策质量。该工具会汇总各种反馈，并将相似的观点整理成由主主题和子主题构成的嵌套树结构。

**在线试用**：[https://talktothe.city/](https://talktothe.city/)

### 面向开发者

请参阅 [DEVELOPMENT.md](DEVELOPMENT.md)，其中包含以下方面的详细说明：

- 设置云服务依赖项（Firebase、GCS 等）
- 配置环境变量
- 在本地安装并运行所有服务

## 架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   next-client   │◄──►│ express-server  │◄──►│pipeline-worker  │
│   (前端)    │    │   (后端)     │    │ (大语言模型处理)│
│   端口：3000    │    │   端口：8080    │    │                 │
└─────────┬───────┘    └─────────┬───────┘    ┌─────────────────┘
          │                      │
          │                      │
          ▼                      ▼
       ┌─────────────────────────────────────┐
       │             公共模块                  │
       │         （共享类型、                │
       │      模式与实用工具）           │
       └─────────────────────────────────────┘
```

**外部服务**：Firebase（身份验证）、Google Cloud Storage（报告生成）、Redis（缓存）、Google Pub/Sub（任务调度）

## 示例数据

相关示例 CSV 文件位于 `examples/sample_csv_files/` 目录中：

- `reddit_climate_change_posts_500.csv`：关于气候变化的讨论帖子

预期的 CSV 格式如下：

```csv
id,interview,comment
1,participant_1,这是一条示例评论
2,participant_2，另一位参与者的回复
```

## 许可证

[![许可证](https://img.shields.io/badge/license-Apache%202-blue)](LICENSE.txt)

---

**有疑问吗？** 您如果有任何问题、反馈，或者有兴趣与我们携手开发具有重大影响力的应用，请通过 <hello@aiobjectives.org> 与我们联系。
