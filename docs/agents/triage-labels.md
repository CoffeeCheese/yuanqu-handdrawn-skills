# 分流标签

| 标准角色 | 本地状态字符串 | 含义 |
| --- | --- | --- |
| needs-triage | needs-triage | 等待维护者评估 |
| needs-info | needs-info | 等待补充信息 |
| ready-for-agent | ready-for-agent | 规格完整，可交给 Agent |
| ready-for-human | ready-for-human | 需要人工实现 |
| wontfix | wontfix | 不予处理 |

技能提及标准角色时，使用对应的本地状态字符串。
本地事项通过 `Status:` 行记录分流状态。
需要自定义名称时，修改“本地状态字符串”列。
