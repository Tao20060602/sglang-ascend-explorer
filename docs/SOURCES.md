# 来源、边界与解释方法

## 固定源码

- [SGLang](https://github.com/sgl-project/sglang/tree/66cac6b79ccffa13c108297fad8a43ddc49d06f8)：`66cac6b79ccffa13c108297fad8a43ddc49d06f8`
- [sgl-kernel-npu](https://github.com/sgl-project/sgl-kernel-npu/tree/6fba476a4c4387fdbb4aec09f0619415b9495f0d)：`6fba476a4c4387fdbb4aec09f0619415b9495f0d`

图中的每个模块链接到相应的固定版本文件或行。文字是个人工程解释，具体运行路径应继续沿源码条件追踪。

## 核心入口

| 问题                           | 源码                                                                                                                                                                                   |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 调度如何选择本轮工作           | [`Scheduler`](https://github.com/sgl-project/sglang/blob/66cac6b79ccffa13c108297fad8a43ddc49d06f8/python/sglang/srt/managers/scheduler.py#L3889)                                       |
| 批次如何进入模型               | [`TpModelWorker`](https://github.com/sgl-project/sglang/blob/66cac6b79ccffa13c108297fad8a43ddc49d06f8/python/sglang/srt/managers/tp_worker.py#L622)                                    |
| 后端何时创建                   | [`ModelRunner`](https://github.com/sgl-project/sglang/blob/66cac6b79ccffa13c108297fad8a43ddc49d06f8/python/sglang/srt/model_executor/model_runner.py#L1105)                            |
| 设备差异怎样接入               | [`SRTPlatform`](https://github.com/sgl-project/sglang/blob/66cac6b79ccffa13c108297fad8a43ddc49d06f8/python/sglang/srt/platforms/interface.py#L73)                                      |
| Attention 名称怎样选择实现     | [`attention_registry.py`](https://github.com/sgl-project/sglang/blob/66cac6b79ccffa13c108297fad8a43ddc49d06f8/python/sglang/srt/layers/attention/attention_registry.py#L141)           |
| 序列长度与页表从哪来           | [`init_forward_metadata`](https://github.com/sgl-project/sglang/blob/66cac6b79ccffa13c108297fad8a43ddc49d06f8/python/sglang/srt/hardware_backend/npu/attention/ascend_backend.py#L534) |
| 普通 MHA Decode 的候选内核调用 | [`_npu_paged_attention`](https://github.com/sgl-project/sglang/blob/66cac6b79ccffa13c108297fad8a43ddc49d06f8/python/sglang/srt/hardware_backend/npu/attention/ascend_backend.py#L3310) |
| KV 如何写入                    | [`set_kv_buffer`](https://github.com/sgl-project/sglang/blob/66cac6b79ccffa13c108297fad8a43ddc49d06f8/python/sglang/srt/hardware_backend/npu/memory_pool_npu.py#L263)                  |
| NPU 图怎么创建                 | [`NPUGraphRunner`](https://github.com/sgl-project/sglang/blob/66cac6b79ccffa13c108297fad8a43ddc49d06f8/python/sglang/srt/hardware_backend/npu/graph_runner/npu_graph_runner.py#L160)   |
| ModelSlim 如何选择量化方法     | [`ModelSlimConfig`](https://github.com/sgl-project/sglang/blob/66cac6b79ccffa13c108297fad8a43ddc49d06f8/python/sglang/srt/layers/quantization/modelslim/modelslim.py#L91)              |

## 解释边界

1. 这些是逻辑交互关系。配置箭头不表示每一轮推理都执行初始化；资源约束箭头不表示某个读取函数直接调用容量配置函数。
2. 部分节点组合了多个职责，便于学习；源码中可能分布在多个类或文件。图中代表性入口不等于完整实现枚举。
3. 普通 MHA eager Decode 的分页 Attention 是一个教学切入点；FIA、FA、MLA、稀疏 Attention、投机验证等具有不同分支。
4. A/C/S 表示当前假设下的改动范围。保持模型语义，不代表内部所有实现固定；需要核对，也不代表一定要改代码。
5. 四个案例是根据接口依赖整理的工程推演。正确性、容量与性能仍需目标设备验证；没有使用虚构的性能数字。

## 术语

- **Prefill**：处理输入或新增的一批 token，建立相应状态。
- **Decode**：自回归生成阶段的执行。
- **KV Cache**：保存历史 K/V 等模型状态，减少重复计算。
- **Block table**：用于索引分页缓存的逻辑页到物理页映射信息。
- **TTFT**：首 token 延迟；需要拆分排队、预处理和设备计算。
- **TPOT**：生成阶段平均每个输出 token 的时间；与端到端测量口径一起记录。
- **TP / EP / PD**：张量并行、expert 并行、Prefill/Decode 分离；覆盖不同职责。

## 模型视角与缓存波及面（2026-10-27）

模型配置与 SGLang 实现分别固定版本；“模型发布存在”“该提交有分支”“目标昇腾组合能正确且高效运行”是三个不同的证据层次。

| 模型视角                 | 官方固定配置                                                                                                                        | 图中区别                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| DeepSeek V4.1-Flash-1017 | [1bae0e1088](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash-1017/blob/1bae0e1088993b9b82de08f59de5be5a34e42170/config.json) | CED / CSA2、共享全局 KV、本层 SWA、Indexer、压缩状态、DSpark                  |
| GLM-5.3                  | [ba32f8c19c](https://huggingface.co/zai-org/GLM-5.3/blob/ba32f8c19c8738e2c57c71798c601d477a7bf844/config.json)                      | MLA 主缓存、DSA Index-K、Top-K 共享、NextN；不是 GLM-5.3-Flash                |
| Kimi K3                  | [f831ab6681](https://huggingface.co/moonshotai/Kimi-K3/blob/f831ab66814297da540d832a5235f8e904f29d06/config.json)                   | KDA 递推/卷积状态与 Gated MLA 历史缓存；AttnRes 是层间残差；该配置 NextN 为 0 |

可复核的关键边界：

- DeepSeek：[共享 KV owner 映射](https://github.com/sgl-project/sglang/blob/66cac6b79ccffa13c108297fad8a43ddc49d06f8/python/sglang/srt/mem_cache/deepseek_v4_memory_pool.py#L1820)。[Ascend Attention](https://github.com/sgl-project/sglang/blob/66cac6b79ccffa13c108297fad8a43ddc49d06f8/python/sglang/srt/hardware_backend/npu/attention/ascend_dsv4_backend.py#L2076) 及 [NPU pool](https://github.com/sgl-project/sglang/blob/66cac6b79ccffa13c108297fad8a43ddc49d06f8/python/sglang/srt/hardware_backend/npu/dsv4/dsv4_memory_pool.py#L484) 仍有 ratio 0/4/128 假设，而该 V4.1 配置包含 1/2。修改白名单不能替代完整适配。
- GLM：[模型类入口](https://github.com/sgl-project/sglang/blob/66cac6b79ccffa13c108297fad8a43ddc49d06f8/python/sglang/srt/models/glm4_moe.py#L1284)；[Top-K 共享判断](https://github.com/sgl-project/sglang/blob/66cac6b79ccffa13c108297fad8a43ddc49d06f8/python/sglang/srt/configs/model_config.py#L489) 不表示主 KV 共享。[compact Index-K 条件](https://github.com/sgl-project/sglang/blob/66cac6b79ccffa13c108297fad8a43ddc49d06f8/python/sglang/srt/mem_cache/kv_cache_configurator.py#L131) 显式限制 NPU PD / HiCache，是设备布局优化波及传输与 host pool 的具体例子。
- Kimi：[层类型选择](https://github.com/sgl-project/sglang/blob/66cac6b79ccffa13c108297fad8a43ddc49d06f8/python/sglang/srt/models/kimi_k3.py#L2502)；[Ascend KDA 状态布局](https://github.com/sgl-project/sglang/blob/66cac6b79ccffa13c108297fad8a43ddc49d06f8/python/sglang/srt/hardware_backend/npu/attention/ascend_kda_backend.py#L98) 与 [verify scratch / 回滚](https://github.com/sgl-project/sglang/blob/66cac6b79ccffa13c108297fad8a43ddc49d06f8/python/sglang/srt/hardware_backend/npu/attention/ascend_kda_backend.py#L332) 需独立于 MLA 页表核查。只改 MLA KV 精度不能自动扩展为递推状态量化。

影响路径是根据上述接口和状态依赖推导的 review 范围；不是自动源码依赖分析，也不意味着每个黄色模块都必须改代码。普通 MHA 示例仅在通用接口视角展开，避免冒充三个模型的实际 Attention 路径。
